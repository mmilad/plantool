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
  const bug = await p.tickets.create({ title: 'Cart loses items', kind: 'bug', description: 'Items vanish from the cart on the cart page.' });
  let e = await p.blueprints.expected(bug.id);
  assert.deepEqual(e.missing, ['repro', 'acceptance']); assert.deepEqual(e.optional, ['todos', 'why', 'files']);
  await p.tickets.update(bug.id, { repro: { steps: ['Add an item', 'Reload'], actual: 'Cart is empty' }, acceptance: [{ text: 'Items survive a reload', met: false }] });
  e = await p.blueprints.expected(bug.id);
  assert.deepEqual(e.missing, []);
  // acceptance is expected of leaves only
  const parent = await p.tickets.create({ title: 'Checkout', description: 'Paying for the cart.', why: 'People want to pay' });
  assert.deepEqual((await p.blueprints.expected(parent.id)).missing, ['acceptance']);
  await p.tickets.create({ title: 'Payment form', description: 'Card fields.', parentId: parent.id, why: 'Card data', todos: [{ text: 'Build the form', met: false }], refs: ['PR 4'], acceptance: [{ text: 'A card can be entered', met: false }] });
  assert.deepEqual((await p.blueprints.expected(parent.id)).missing, []);
  // views get the values in blueprint order, then filled fields the blueprint does not name
  const form = (await p.tickets.list({ limit: Infinity })).find(x => x.title === 'Payment form'); const view = await p.blueprints.expected(form.id);
  assert.deepEqual(view.items.filter(i => i.value !== undefined).map(i => i.field), ['description', 'why', 'todos', 'acceptance']);
  assert.equal(view.items.find(i => i.field === 'todos').type, 'checklist'); assert.deepEqual(view.others.map(o => o.field), ['refs']);
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

test('blueprints are changed through the API: sections, a new project field, template and reset', async t => {
  const p = await project(t);
  const added = await p.blueprints.expect('bug', 'severity', { type: 'enum', values: ['low', 'high'], label: 'Severity', hint: 'How bad is it', before: 'repro' });
  assert.equal(added.created, true);
  assert.deepEqual(added.expects.slice(0, 3).map(e => e.field), ['description', 'severity', 'repro']);
  assert.deepEqual(p.config.fields, [{ name: 'severity', type: 'enum', label: 'Severity', values: ['low', 'high'], kinds: ['bug'] }]);
  const bug = await p.tickets.create({ title: 'Cart loses items', kind: 'bug', description: 'Seen on the cart page.' });
  assert.ok((await p.blueprints.expected(bug.id)).missing.includes('severity'));
  await p.tickets.update(bug.id, { properties: { severity: 'high' } });
  const view = await p.blueprints.expected(bug.id);
  assert.ok(!view.missing.includes('severity')); assert.equal(view.items.find(i => i.field === 'severity').value, 'high');
  assert.equal(view.editable.find(f => f.field === 'severity').custom, true);
  // change an existing section, drop one, set a template
  assert.equal((await p.blueprints.expect('bug', 'why', { optional: false, hint: 'Who suffers' })).expects.find(e => e.field === 'why').optional, false);
  await assert.rejects(p.blueprints.expect('bug', 'why', { type: 'list' }), { code: 'VALIDATION' });
  await assert.rejects(p.blueprints.expect('bug', '9lives'), { code: 'VALIDATION' });
  await assert.rejects(p.blueprints.expect('bug', 'why', { before: 'nope' }), { code: 'VALIDATION' });
  assert.ok(!(await p.blueprints.drop('bug', 'files')).expects.some(e => e.field === 'files'));
  await assert.rejects(p.blueprints.drop('bug', 'files'), { code: 'VALIDATION' });
  assert.ok((await p.blueprints.describe('bug')).available.some(a => a.field === 'files'));
  assert.equal((await p.blueprints.save('bug', { template: '## Seen where' })).template, '## Seen where');
  assert.equal((await p.tickets.create({ title: 'Another', kind: 'bug' })).description, '## Seen where');
  // reset returns to the built-in; the project field stays
  assert.equal((await p.blueprints.reset('bug')).reset, true); assert.equal((await p.blueprints.reset('bug')).reset, false);
  assert.equal((await p.blueprints.describe('bug')).source, 'built-in'); assert.equal(p.config.fields.length, 1);
  await assert.rejects(p.blueprints.save('story', {}), { code: 'VALIDATION' });
});
