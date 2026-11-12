import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

async function project(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-blueprint-')); t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await initProject({ cwd, name: 'shop' }); return openProject({ cwd });
}

test('blueprints say what a ticket of a kind should have and what is still empty', async t => {
  const p = await project(t);
  assert.deepEqual((await p.blueprints.list()).map(b => b.kind), ['task', 'feature', 'bug', 'decision']);
  const bug = await p.tickets.create({ title: 'Cart loses items', kind: 'bug' });
  let e = await p.blueprints.expected(bug.id);
  assert.deepEqual(e.missing, ['repro', 'acceptance']); assert.deepEqual(e.optional, ['why', 'files']);
  await p.tickets.update(bug.id, { repro: { steps: ['Add an item', 'Reload'], actual: 'Cart is empty' }, acceptance: [{ text: 'Items survive a reload', met: false }] });
  e = await p.blueprints.expected(bug.id);
  assert.deepEqual(e.missing, []);
  // acceptance is expected of leaves only
  const parent = await p.tickets.create({ title: 'Checkout', why: 'People want to pay' });
  assert.deepEqual((await p.blueprints.expected(parent.id)).missing, ['acceptance']);
  await p.tickets.create({ title: 'Payment form', parentId: parent.id, why: 'Card data', acceptance: [{ text: 'A card can be entered', met: false }] });
  assert.deepEqual((await p.blueprints.expected(parent.id)).missing, []);
  // done tickets are left alone; check reports the rest in one warning
  const loose = await p.tickets.create({ title: 'Loose end' });
  assert.deepEqual((await p.blueprints.check()).map(r => r.ticketId), [loose.id]);
  const check = await p.check();
  assert.equal(check.warnings.filter(w => w.code === 'BLUEPRINT_FIELDS_MISSING').length, 1);
  await p.tickets.update(loose.id, { status: 'done' });
  assert.deepEqual(await p.blueprints.check(), []);
  assert.ok((await p.context(bug.id, { budget: 1e9 })).expected === undefined);
  // options have no blueprint
  const d = await p.decisions.ask('Which shop system?', { options: ['A', 'B'] });
  assert.equal((await p.blueprints.expected(d.options[0].id)).blueprint, null);
});

test('a project blueprint changes what is expected and can carry a description template', async t => {
  const p = await project(t);
  const { file } = await p.blueprints.init('bug');
  assert.equal(file, '.heist/blueprints/bug.json');
  await assert.rejects(p.blueprints.init('bug'), { code: 'CONFLICT' });
  const abs = path.join(p.root, file);
  await fs.writeFile(abs, JSON.stringify({ kind: 'bug', template: '## Seen where\n\n## What happens\n', expects: [{ field: 'description', hint: 'Where and what' }, { field: 'size', optional: true }] }));
  const bug = await p.tickets.create({ title: 'Cart loses items', kind: 'bug' });
  assert.equal(bug.description, '## Seen where\n\n## What happens\n');
  assert.deepEqual((await p.blueprints.expected(bug.id)).missing, ['description'], 'an untouched template does not count as filled');
  await p.tickets.update(bug.id, { description: '## Seen where\nCart page\n' });
  assert.deepEqual((await p.blueprints.expected(bug.id)).missing, []);
  assert.equal((await p.tickets.create({ title: 'Other', kind: 'bug', description: 'Mine' })).description, 'Mine');
  await fs.writeFile(abs, JSON.stringify({ kind: 'bug', expects: [{ field: 'nope' }] }));
  await assert.rejects(p.blueprints.list(), { code: 'VALIDATION' });
  await fs.writeFile(abs, JSON.stringify({ name: 'bug', items: [{ id: 'a', title: 'A' }] }));
  await assert.rejects(p.blueprints.list(), /checklists/);
});
