import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

async function project(t) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-bp-')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd }); return openProject({ cwd }); }

test('blueprints resolve inheritance, suggest by title and expand a ticket into child tickets', async t => {
  const p = await project(t);
  const header = await p.blueprints.get('header');
  assert.ok(header.items.some(i => i.id === 'logo') && header.items.some(i => i.id === 'a11y' && i.from === 'ui-component'));
  const h = await p.tickets.create({ title: 'Site header' });
  assert.equal((await p.blueprints.suggest(h.id))[0].name, 'header');
  assert.deepEqual(await p.blueprints.suggest((await p.tickets.create({ title: 'Database migrations' })).id), []);
  assert.equal((await p.blueprints.suggest((await p.tickets.create({ title: 'Trade offers', kind: 'feature' })).id))[0].name, 'feature');
  const dry = await p.blueprints.apply(h.id, 'header', { dryRun: true });
  assert.ok(dry.create.every(i => !i.optional)); assert.equal((await p.tickets.get(h.id)).blueprint, undefined);
  const r = await p.blueprints.apply(h.id, 'header');
  assert.equal(r.created.length, dry.create.length);
  const child = await p.tickets.get(r.created[0].id);
  assert.equal(child.parentId, h.id); assert.deepEqual(child.origin, { blueprint: 'header', item: r.created[0].item });
  assert.deepEqual(r.coverage.missing, []); assert.ok(r.coverage.undecided.includes('cart'));
  // re-applying never duplicates; --only adds an optional item
  assert.equal((await p.blueprints.apply(h.id, 'header')).created.length, 0);
  assert.equal((await p.blueprints.apply(h.id, 'header', { only: ['cart'] })).created.length, 1);
  await assert.rejects(p.blueprints.skip(h.id, 'sticky', ' '), { code: 'VALIDATION' });
  const c = await p.blueprints.skip(h.id, 'sticky', 'static header');
  assert.equal(c.items.find(i => i.id === 'sticky').state, 'skipped');
  assert.equal((await p.blueprints.skip(h.id, 'sticky', null)).items.find(i => i.id === 'sticky').state, 'open');
  await assert.rejects(p.blueprints.apply(h.id, 'footer'), { code: 'CONFLICT' });
  // an item can be answered on the ticket itself instead of becoming a ticket; attaching creates nothing
  const feat = await p.tickets.create({ title: 'Trade offers', kind: 'feature' });
  const attached = await p.blueprints.apply(feat.id, 'feature', { only: [] });
  assert.equal(attached.created.length, 0); assert.equal(attached.coverage.missing.length, 5);
  await assert.rejects(p.blueprints.answer(feat.id, 'tests', ''), { code: 'VALIDATION' });
  const ans = await p.blueprints.answer(feat.id, 'tests', 'see acceptance');
  assert.equal(ans.items.find(i => i.id === 'tests').state, 'answered'); assert.ok(!ans.missing.includes('tests'));
  assert.equal((await p.blueprints.apply(feat.id, 'feature')).created.length, 4);
  assert.equal((await p.blueprints.answer(feat.id, 'tests', null)).items.find(i => i.id === 'tests').state, 'open');
  const ctx = await p.context(h.id, { budget: 1e9 });
  assert.equal(ctx.blueprint.name, 'header'); assert.ok(ctx.blueprint.undecided.includes('sticky'));
  const check = await p.check();
  assert.ok(check.warnings.some(w => w.code === 'BLUEPRINT_UNDECIDED'));
});

test('project blueprints in .heist/blueprints override built-ins and are validated', async t => {
  const p = await project(t);
  const r = await p.blueprints.init('header');
  const file = path.join(p.root, r.file); const bp = JSON.parse(await fs.readFile(file, 'utf8'));
  bp.items.push({ id: 'language', title: 'Language switch in the header' }); await fs.writeFile(file, JSON.stringify(bp));
  assert.ok((await p.blueprints.get('header')).items.some(i => i.id === 'language'));
  assert.equal((await p.blueprints.list()).find(b => b.name === 'header').source, 'project');
  await assert.rejects(p.blueprints.init('header'), { code: 'CONFLICT' });
  await fs.writeFile(path.join(p.dir, 'blueprints', 'bad.json'), JSON.stringify({ name: 'bad', items: [{ id: 'X Y', title: 'x' }] }));
  await assert.rejects(p.blueprints.list(), { code: 'VALIDATION' });
});

test('product blueprint orders its items: the stack waits for the platform, the UI structure waits for stack and features', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist order ')); t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await initProject({ cwd, name: 'Shop' }); const p = await openProject({ cwd });
  const root = await p.tickets.create({ title: 'Shop app' });
  const r = await p.blueprints.apply(root.id, 'product');
  const byItem = new Map(r.created.map(c => [c.item, c.id]));
  const rels = await p.relations.list();
  const has = (from, to) => rels.some(x => x.type === 'blocks' && x.sourceId === byItem.get(from) && x.targetId === byItem.get(to));
  assert.ok(has('platform', 'stack')); assert.ok(has('stack', 'ui-structure')); assert.ok(has('core-features', 'ui-structure'));
  assert.ok(has('goal', 'platform'));
  assert.ok(!has('ui-structure', 'stack'));
});
