import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject, normalizeSchema } from '../src/index.js';

async function project(t) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist design ')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd, name: 'Shop' }); return openProject({ cwd }); }
const codes = r => r.errors.map(e => e.code);

async function shop(p) {
  await p.types.set('User', { email: 'string', firstName: 'string', lastName: 'string' });
  await p.components.create({ kind: 'service', name: 'UserService' });
  await p.components.create({ kind: 'method', name: 'getUser', parentId: 'UserService' });
  await p.contracts.set('UserService.getUser', { input: { userId: 'string' }, output: 'User' });
  await p.components.create({ kind: 'service', name: 'CartService' });
  await p.components.create({ kind: 'method', name: 'addItem', parentId: 'CartService' });
  await p.contracts.set('addItem', { input: { userId: 'string', sku: 'string' }, output: { items: [{ sku: 'string', qty: 'integer' }] } });
  const provider = await p.tickets.create({ title: 'Build UserService' });
  const consumer = await p.tickets.create({ title: 'Cart: add item' });
  await p.codePlan.add(provider.id, 'implements', 'UserService');
  await p.codePlan.add(consumer.id, 'implements', 'CartService.addItem');
  await p.codePlan.add(consumer.id, 'consumes', 'UserService.getUser', { requires: ['userId', 'email:string'], provides: ['userId'] });
  return { provider, consumer };
}

test('schema shorthand normalises to the JSON Schema subset', () => {
  assert.deepEqual(normalizeSchema({ id: 'string', nick: 'string?', 'age?': 'integer', tags: 'string[]', owner: 'User', items: [{ sku: 'string' }] }), {
    type: 'object', required: ['id', 'tags', 'owner', 'items'], properties: { id: { type: 'string' }, nick: { type: 'string' }, age: { type: 'integer' }, tags: { type: 'array', items: { type: 'string' } }, owner: { $ref: 'User' }, items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] } } } });
  assert.deepEqual(normalizeSchema({ type: 'object', properties: { a: 'number' }, required: ['a'] }), { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] });
  assert.throws(() => normalizeSchema('str ing'), { code: 'VALIDATION' });
});

test('check finds a consumer requirement the provider contract does not return', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  const r = await p.check();
  assert.equal(r.valid, false); assert.deepEqual(codes(r), ['REQUIRED_FIELD_MISSING']);
  assert.equal(r.errors[0].ticketId, consumer.id); assert.equal(r.errors[0].field, 'userId');
  assert.match(r.errors[0].message, /returns: email, firstName, lastName/);
  await p.types.set('User', { userId: 'string', email: 'string', firstName: 'string', lastName: 'string' });
  assert.equal((await p.check()).valid, true);
});

test('check reports types, missing input, nested paths, unknown refs and kind rules', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  await p.types.set('User', { userId: 'integer', email: 'string', address: { city: 'string' }, firstName: 'string', lastName: 'string' });
  await p.codePlan.add(consumer.id, 'consumes', 'UserService.getUser', { requires: ['userId:string', 'address.city', 'address.zip'], provides: [] });
  const r = await p.check();
  assert.deepEqual(codes(r).sort(), ['INPUT_NOT_PROVIDED', 'REQUIRED_FIELD_MISSING', 'REQUIRED_FIELD_TYPE']);
  await p.components.create({ kind: 'method', name: 'orphan' });
  await p.components.create({ kind: 'class', name: 'Empty' });
  await p.contracts.set('orphan', { output: 'Missing' });
  const r2 = await p.check();
  assert.ok(codes(r2).includes('METHOD_WITHOUT_OWNER') && codes(r2).includes('UNKNOWN_TYPE'));
  assert.ok(r2.warnings.some(w => w.code === 'NO_METHODS'));
});

test('contracts are central and versioned; changes list affected consumers', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  assert.equal((await p.contracts.get('UserService.getUser')).version, 1);
  assert.equal((await p.contracts.set('UserService.getUser', { output: 'User' })).version, 1, 'no change, no bump');
  assert.equal((await p.contracts.set('UserService.getUser', { input: { userId: 'string', withAddress: 'boolean?' } })).version, 2);
  assert.equal((await p.contracts.list()).length, 2);
  const change = await p.tickets.create({ title: 'Extend getUser' });
  await p.codePlan.add(change.id, 'changes', 'UserService.getUser');
  const w = (await p.check()).warnings.find(x => x.code === 'CHANGE_AFFECTS_CONSUMERS');
  assert.deepEqual(w.consumers, [consumer.id]);
});

test('consumers wait for provider tickets in next and readiness', async t => {
  const p = await project(t); const { provider, consumer } = await shop(p);
  const first = await p.next({ limit: 10 });
  assert.deepEqual(first.map(x => x.id), [provider.id]); assert.equal(first[0].unblocks, 1);
  await assert.rejects(() => p.claim(consumer.id, { agent: 'a' }), /waits for provider/);
  const done = await p.finish(provider.id, {});
  assert.deepEqual(done.unblocked.map(x => x.id), [consumer.id]);
});

test('provider/consumer cycles are reported', async t => {
  const p = await project(t); const { provider, consumer } = await shop(p);
  await p.codePlan.add(provider.id, 'consumes', 'CartService.addItem', { requires: ['items'] });
  assert.ok(codes(await p.check()).includes('DEPENDENCY_CYCLE'));
});

test('context packets include the resolved code plan and referenced types', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  const ctx = await p.context(consumer.id, { budget: 20000 });
  assert.equal(ctx.codePlan.consumes[0].name, 'UserService.getUser');
  assert.deepEqual(ctx.codePlan.consumes[0].requires, ['userId', 'email:string']);
  assert.ok(ctx.codePlan.types.User); assert.equal(ctx.readiness.ready, false);
  const small = await p.context(consumer.id, { budget: 600 });
  assert.ok(Buffer.byteLength(JSON.stringify(small, null, 2)) <= 600 || small.codePlan === null);
});

test('validate catches dangling code-plan and contract references; names resolve safely', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  assert.equal((await p.validate()).valid, true);
  await p.components.create({ kind: 'module', name: 'billing' }); await p.components.create({ kind: 'service', name: 'UserService', parentId: 'billing' });
  assert.equal((await p.components.resolve('UserService')).parentId, null, 'exact qualified name wins');
  const nested = await p.components.resolve('billing.UserService'); assert.ok(nested.parentId);
  await p.components.create({ kind: 'method', name: 'getUser', parentId: nested.id });
  await assert.rejects(() => p.components.resolve('getUser'), /ambiguous/);
  await assert.rejects(() => p.components.create({ kind: 'method', name: 'getUser', parentId: nested.id }), { code: 'CONFLICT' });
  const comp = await p.components.resolve('CartService.addItem');
  await fs.rm(path.join(p.dir, 'components', comp.id.slice(0, 2), `${comp.id}.json`));
  const v = await p.validate();
  assert.equal(v.valid, false);
  assert.ok(v.errors.some(e => e.includes(`Ticket ${consumer.id} codePlan.implements`)) && v.errors.some(e => e.includes('Contract')));
});

test('contract changes are classified and affected consumers reported', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  await p.types.set('User', { userId: 'string', email: 'string', firstName: 'string', lastName: 'string' });
  const preview = await p.contracts.set('UserService.getUser', { output: { userId: 'string', firstName: 'string', lastName: 'string', nickname: 'string?' } , dryRun: true });
  assert.equal(preview.impact.breaking, true);
  assert.deepEqual(preview.impact.changes.filter(c => c.breaking).map(c => `${c.side}.${c.path} ${c.change}`), ['output.email removed']);
  assert.ok(preview.impact.changes.some(c => c.path === 'nickname' && c.change === 'added' && !c.breaking));
  assert.deepEqual(preview.impact.affectedConsumers.map(a => a.ticketId), [consumer.id]);
  assert.equal((await p.contracts.get('UserService.getUser')).version, 1, 'dry run writes nothing');
  const input = await p.contracts.set('UserService.getUser', { input: { userId: 'string', tenant: 'string' } });
  assert.deepEqual(input.impact.changes.map(c => [c.path, c.change, c.breaking]), [['tenant', 'added-required', true]]);
  assert.deepEqual(input.impact.affectedConsumers.map(a => a.ticketId), [consumer.id], 'consumer provides only userId');
  assert.equal(input.version, 2); assert.equal((await p.contracts.get('UserService.getUser')).history[0].version, 1);
  const widen = await p.contracts.set('UserService.getUser', { input: { userId: 'string', tenant: 'string?' } });
  assert.equal(widen.impact.breaking, false);
});

test('type changes report impact through every contract that uses the type', async t => {
  const p = await project(t); const { consumer } = await shop(p);
  await p.types.set('User', { userId: 'string', email: 'string', firstName: 'string', lastName: 'string' });
  const r = await p.types.set('User', { userId: 'integer', email: 'string?', firstName: 'string', lastName: 'string' });
  assert.equal(r.version, 3);
  assert.deepEqual(r.impact.changes.filter(c => c.breaking).map(c => `${c.path} ${c.change}`).sort(), ['email now-optional', 'userId type']);
  assert.deepEqual(r.impact.affectedConsumers.map(a => a.ticketId), [consumer.id]);
  const unrelated = await p.types.set('User', { userId: 'integer', email: 'string?', firstName: 'string', lastName: 'string', avatar: 'string?' });
  assert.equal(unrelated.impact.breaking, false); assert.equal(unrelated.impact.affectedConsumers.length, 0);
});

test('a mock unblocks the consumer that needs only a mock; a full consumer still waits for the full provider', async t => {
  const p = await project(t);
  await p.types.set('User', { userId: 'string' });
  await p.components.create({ kind: 'service', name: 'UserService' });
  await p.components.create({ kind: 'method', name: 'getUser', parentId: 'UserService' });
  await p.contracts.set('UserService.getUser', { input: { userId: 'string' }, output: 'User' });
  const mock = await p.tickets.create({ title: 'Mock UserService' });
  const full = await p.tickets.create({ title: 'Implement UserService' });
  const cart = await p.tickets.create({ title: 'Cart works against the mock' });
  const checkout = await p.tickets.create({ title: 'Checkout needs the real service' });
  await p.codePlan.add(mock.id, 'implements', 'UserService', { stage: 'mock' });
  await p.codePlan.add(full.id, 'implements', 'UserService');
  await p.codePlan.add(cart.id, 'consumes', 'UserService.getUser', { needs: 'mock' });
  await p.codePlan.add(checkout.id, 'consumes', 'UserService.getUser');
  assert.equal((await p.context(cart.id)).readiness.ready, false);
  await p.tickets.update(mock.id, { status: 'done' }, { force: true });
  assert.equal((await p.context(cart.id)).readiness.ready, true);
  assert.equal((await p.context(checkout.id)).readiness.ready, false);
  await p.tickets.update(full.id, { status: 'done' }, { force: true });
  assert.equal((await p.context(checkout.id)).readiness.ready, true);
  await assert.rejects(p.codePlan.add(cart.id, 'implements', 'UserService', { needs: 'mock' }), { code: 'VALIDATION' });
});
