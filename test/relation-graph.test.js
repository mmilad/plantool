import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject, openProject, RELATION_TYPES } from '../src/index.js';
import { serve } from '../src/server.js';

const cli = fileURLToPath(new URL('../bin/heist.js', import.meta.url));
async function project(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-graph-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await initProject({ cwd, name: 'Graph', key: 'GRF' });
  const p = await openProject({ cwd });
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd, env: { ...process.env, HEIST_NO_REGISTER: '1', HEIST_HOME: path.join(cwd, 'local-home') }, encoding: 'utf8' });
  return { cwd, p, run };
}
const byKey = (result, id) => result.nodes.find(n => n.id === id);

test('a blocks chain gives layers 0, 1, 2 and rows inside each layer', async t => {
  const { p } = await project(t);
  const a = await p.tickets.create({ title: 'A' });
  const b = await p.tickets.create({ title: 'B' });
  const c = await p.tickets.create({ title: 'C' });
  await p.relations.add(a.id, b.id, 'blocks');
  await p.relations.add(b.id, c.id, 'blocks');

  const result = await p.relationGraph();
  assert.equal(byKey(result, a.id).layer, 0);
  assert.equal(byKey(result, b.id).layer, 1);
  assert.equal(byKey(result, c.id).layer, 2);
  assert.equal(result.layers, 3);
  assert.equal(result.totalNodes, 3);
  assert.equal(result.truncated, false);
  assert.equal(result.hidden, 0);
  assert.deepEqual(result.nodes.map(n => n.id), [a.id, b.id, c.id]);
  assert.deepEqual(result.nodes.map(n => n.row), [0, 0, 0]);
  assert.equal(byKey(result, a.id).key, 'GRF-1');
  assert.deepEqual(result.edges.map(e => [e.sourceId, e.targetId, e.type]).sort(), [[a.id, b.id, 'blocks'], [b.id, c.id, 'blocks']].sort());
});

test('a relates_to pair is included with layer 0', async t => {
  const { p } = await project(t);
  const x = await p.tickets.create({ title: 'X' });
  const y = await p.tickets.create({ title: 'Y' });
  await p.relations.add(x.id, y.id, 'relates_to');
  const result = await p.relationGraph();
  assert.equal(byKey(result, x.id).layer, 0);
  assert.equal(byKey(result, y.id).layer, 0);
  assert.equal(result.layers, 1);
  assert.deepEqual(result.edges, [{ sourceId: x.id, targetId: y.id, type: 'relates_to' }]);
});

test('every relation type is included', async t => {
  const { p } = await project(t);
  for (const type of RELATION_TYPES) {
    const s = await p.tickets.create({ title: `source ${type}` });
    const d = await p.tickets.create({ title: `target ${type}` });
    await p.relations.add(s.id, d.id, type);
  }
  const result = await p.relationGraph();
  assert.equal(result.edges.length, RELATION_TYPES.length);
  assert.deepEqual(result.edges.map(e => e.type).sort(), [...RELATION_TYPES].sort());
});

test('a ticket without relations is counted in hidden', async t => {
  const { p } = await project(t);
  const a = await p.tickets.create({ title: 'A' });
  const b = await p.tickets.create({ title: 'B' });
  await p.tickets.create({ title: 'Lonely' });
  await p.relations.add(a.id, b.id, 'blocks');
  const result = await p.relationGraph();
  assert.equal(result.nodes.length, 2);
  assert.equal(result.hidden, 1);

  const { p: empty } = await project(t);
  await empty.tickets.create({ title: 'Only' });
  await empty.tickets.create({ title: 'Another' });
  const none = await empty.relationGraph();
  assert.deepEqual(none.nodes, []);
  assert.deepEqual(none.edges, []);
  assert.equal(none.layers, 0);
  assert.equal(none.hidden, 2);
  assert.equal(none.totalNodes, 0);
  assert.equal(none.truncated, false);
});

test('root limits the result to the root and its descendants', async t => {
  const { p } = await project(t);
  const root = await p.tickets.create({ title: 'Root' });
  const child = await p.tickets.create({ title: 'Child', parentId: root.id });
  const target = await p.tickets.create({ title: 'Target' });
  const u = await p.tickets.create({ title: 'Unrelated U' });
  const v = await p.tickets.create({ title: 'Unrelated V' });
  await p.relations.add(child.id, target.id, 'blocks');
  await p.relations.add(u.id, v.id, 'relates_to');

  const result = await p.relationGraph({ root: p.ticketKey(root) });
  assert.deepEqual(result.nodes.map(n => n.id).sort(), [child.id, target.id].sort());
  assert.equal(result.edges.length, 1);
  assert.equal(result.hidden, 1, 'the root has no relation of its own and is counted as hidden');
  assert.equal(result.totalNodes, 2);

  const byId = await p.relationGraph({ root: root.id });
  assert.deepEqual(byId, result);
});

test('limit cuts the nodes, drops edges with a cut end and sets truncated', async t => {
  const { p } = await project(t);
  const a = await p.tickets.create({ title: 'A' });
  const b = await p.tickets.create({ title: 'B' });
  const c = await p.tickets.create({ title: 'C' });
  const d = await p.tickets.create({ title: 'D' });
  await p.relations.add(a.id, b.id, 'blocks');
  await p.relations.add(c.id, d.id, 'blocks');

  const result = await p.relationGraph({ limit: 2 });
  assert.equal(result.nodes.length, 2);
  assert.equal(result.totalNodes, 4);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.nodes.map(n => n.id), [a.id, c.id]);
  assert.deepEqual(result.edges, []);
  assert.equal(result.layers, 1);
});

test('an invalid limit throws and an unknown root is not found', async t => {
  const { p, run } = await project(t);
  const a = await p.tickets.create({ title: 'A' });
  const b = await p.tickets.create({ title: 'B' });
  await p.relations.add(a.id, b.id, 'blocks');
  for (const limit of [0, 201, 1.5, '2']) await assert.rejects(() => p.relationGraph({ limit }), { code: 'VALIDATION' }, String(limit));
  await assert.rejects(() => p.relationGraph({ root: 'GRF-999' }), { code: 'NOT_FOUND' });
  assert.notEqual(run('graph', '--limit', '0').status, 0);
  assert.notEqual(run('graph', '--root', 'GRF-999').status, 0);
});

test('CLI, project API and HTTP return the same data', async t => {
  const { cwd, p, run } = await project(t);
  const a = await p.tickets.create({ title: 'A' });
  const b = await p.tickets.create({ title: 'B' });
  await p.tickets.create({ title: 'Lonely' });
  await p.relations.add(a.id, b.id, 'blocks');
  const api = await p.relationGraph();

  const cliResult = run('graph', '--format', 'json');
  assert.equal(cliResult.status, 0, cliResult.stderr);
  assert.deepEqual(JSON.parse(cliResult.stdout), api);
  const human = run('graph');
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /GRF-1 A \[blocks\] GRF-2 B/);

  const app = await serve({ cwd, port: 0 });
  t.after(() => new Promise(r => app.server.close(r)));
  const response = await fetch(`${app.url}/api/roadmap/graph`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), api);
  assert.equal((await fetch(`${app.url}/api/roadmap/graph?limit=0`)).status, 400);
});
