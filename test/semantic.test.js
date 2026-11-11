import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';
import { splitText, cacheDir, openCache, closeCaches } from '../src/semantic.js';

process.env.HEIST_EMBEDDER = 'hash';
async function setup(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-sem-home-')); const prev = process.env.HEIST_HOME; process.env.HEIST_HOME = home;
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-sem-'));
  t.after(async () => { closeCaches(); process.env.HEIST_HOME = prev; await fs.rm(home, { recursive: true, force: true }); await fs.rm(cwd, { recursive: true, force: true }); });
  await initProject({ cwd, name: 'Shop' }); return openProject({ cwd });
}

test('splitText keeps paragraphs together and bounds chunk length', () => {
  const parts = splitText('First paragraph.\n\nSecond paragraph.\n\n' + 'Long sentence. '.repeat(80), 200);
  assert.equal(parts[0], 'First paragraph. Second paragraph.');
  assert.ok(parts.every(x => x.length <= 200)); assert.ok(parts.length > 3);
});

test('index builds incrementally, survives deletes and lives outside the repository', async t => {
  const p = await setup(t);
  const header = await p.tickets.create({ title: 'Header' });
  const nav = await p.tickets.create({ title: 'Main navigation', parentId: header.id, description: 'Links to shop, blog and contact.' });
  await p.tickets.create({ title: 'Shopping cart total', description: 'Sum line items and taxes.' });
  await p.comments.add(nav.id, { body: 'Use a burger menu on mobile.' });
  await p.documents.create('goals', { title: 'Launch', body: '## Navigation\nEasy to find pages.' });
  assert.equal((await p.semantic.status()).available, false);
  const first = await p.semantic.update(); assert.equal(first.sources, 5); assert.ok(first.embedded >= 5);
  assert.ok(await fs.access(path.join(cacheDir(p.config.projectId), 'db.sqlite')).then(() => true));
  assert.equal(await fs.access(path.join(p.dir, 'db.sqlite')).then(() => true, () => false), false);
  const again = await p.semantic.update(); assert.equal(again.changed, 0); assert.equal(again.embedded, 0);
  await p.tickets.update(nav.id, { description: 'Links to shop, blog, contact and imprint.' });
  const third = await p.semantic.update(); assert.equal(third.changed, 1);
  const extra = await p.tickets.create({ title: 'Temporary' }); await p.semantic.update();
  await fs.rm(path.join(p.dir, 'tickets', extra.id.slice(0, 2), extra.id + '.json'));
  const afterDelete = await p.semantic.update(); assert.equal(afterDelete.sources, 5);
  const st = await p.semantic.status(); assert.equal(st.available, true); assert.equal(st.mode, 'hybrid'); assert.ok(st.generation >= 3);
});

test('semantic, hybrid and similar search rank related texts and fall back to keywords', async t => {
  const p = await setup(t);
  const header = await p.tickets.create({ title: 'Header' });
  const nav = await p.tickets.create({ title: 'Header navigation menu', parentId: header.id });
  const other = await p.tickets.create({ title: 'Navigation menu at the top' });
  await p.tickets.create({ title: 'Invoice PDF export' });
  const fallback = await p.semantic.hybrid('navigation');
  assert.equal(fallback.mode, 'keyword'); assert.match(fallback.fallbackReason, /not been built|not built/);
  await p.semantic.update();
  const sem = await p.semantic.search('navigation menu', { types: ['ticket'] });
  assert.ok(sem.hits.findIndex(h => h.id === other.id) < sem.hits.findIndex(h => h.title === 'Invoice PDF export'));
  const hybrid = await p.semantic.hybrid('navigation');
  assert.equal(hybrid.mode, 'hybrid'); assert.ok(hybrid.hits.some(h => h.matchedBy.includes('semantic')));
  const similar = await p.semantic.similar(p.ticketKey(nav), { minScore: 0, minStrength: -Infinity });
  assert.equal(similar[0].id, other.id, 'closest unrelated-by-hierarchy ticket first'); assert.ok(!similar.some(s => s.id === header.id), 'ancestors are excluded');
  await assert.rejects(() => p.semantic.search('   '), { code: 'VALIDATION' });
});

test('a corrupt cache database is moved aside and rebuilt', async t => {
  const p = await setup(t); await p.tickets.create({ title: 'A' });
  closeCaches(); const dir = cacheDir(p.config.projectId); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, 'db.sqlite'), 'not a database');
  const db = await openCache(p.config.projectId); assert.ok(db);
  assert.ok((await fs.readdir(dir)).some(f => f.startsWith('db.sqlite.broken-')));
  assert.equal((await p.semantic.update()).sources, 1);
});

test('relatedByEmbedding flags tickets that stand out, also in groups, needs enough tickets and returns nothing when the model is missing', async t => {
  const { relatedByEmbedding, robustStrengths, HINT_STRENGTH, MIN_HINT_POPULATION } = await import('../src/semantic.js');
  // Titles about trading point the same way as the new ticket; every other title is a little off, each by a different amount.
  const fake = { async embed(texts) { return texts.map(x => { const n = Number(/\d+/.exec(x)?.[0] ?? 0); return x.toLocaleLowerCase().includes('trade') ? Float32Array.from([1, 0.05]) : Float32Array.from([1, 1 + n / 40]); }); } };
  const p = { config: {} };
  const ticket = { title: 'Trade offer flow' };
  const filler = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, title: `Unrelated work ${i}` }));
  const one = await relatedByEmbedding(p, ticket, [...filler, { id: 'dup', title: 'Trade offer review' }], { embedder: fake });
  assert.deepEqual(one.map(h => h.ticket.id), ['dup']);
  assert.ok(one[0].strength >= HINT_STRENGTH);
  // A group of related tickets does not hide its members.
  const group = ['a', 'b', 'c'].map(id => ({ id, title: `Trade screen ${id}` }));
  assert.deepEqual((await relatedByEmbedding(p, ticket, [...filler, ...group], { embedder: fake })).map(h => h.ticket.id).sort(), ['a', 'b', 'c']);
  // Nothing stands out among the unrelated ones.
  assert.deepEqual(await relatedByEmbedding(p, ticket, filler, { embedder: fake }), []);
  // Too few tickets to say what is usual: no hint, even for an obvious twin.
  assert.deepEqual(await relatedByEmbedding(p, ticket, [...filler.slice(0, MIN_HINT_POPULATION - 2), { id: 'dup', title: 'Trade offer review' }], { embedder: fake }), []);
  assert.deepEqual(robustStrengths([0.5, 0.5, 0.5, 0.9]), [0, 0, 0, 0]);
  const none = await relatedByEmbedding(p, ticket, [...filler, { id: 'dup', title: 'Trade offer review' }], { embedder: { embed: async () => { const e = Object.assign(new Error('x'), { code: 'SEMANTIC_UNAVAILABLE' }); throw e; } } });
  assert.deepEqual(none, []);
});
