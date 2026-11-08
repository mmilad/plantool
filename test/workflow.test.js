import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.HEIST_HOME ??= mkdtempSync(join(tmpdir(), 'heist-home-'));

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { initProject, openProject } from '../src/index.js';
import { onboardText } from '../src/onboard.js';

const run = promisify(execFile);
const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'heist.js');
async function project(t) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist wf ')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd, name: 'WF' }); return openProject({ cwd }); }

test('ticket kind defaults to task and rejects unknown kinds', async t => {
  const p = await project(t);
  assert.equal((await p.tickets.create({ title: 'a' })).kind, 'task');
  assert.equal((await p.tickets.create({ title: 'b', kind: 'bug' })).kind, 'bug');
  await assert.rejects(() => p.tickets.create({ title: 'c', kind: 'service' }), { code: 'VALIDATION' });
});

test('a parent cannot be done while descendants or blockers are open unless forced', async t => {
  const p = await project(t);
  const header = await p.tickets.create({ title: 'Header' }), subnav = await p.tickets.create({ title: 'Subnav', parentId: header.id });
  const deep = await p.tickets.create({ title: 'Subnav item', parentId: subnav.id });
  await assert.rejects(() => p.tickets.update(header.id, { status: 'done' }), { code: 'OPEN_WORK' });
  await p.tickets.update(deep.id, { status: 'done' }); await p.tickets.update(subnav.id, { status: 'done' });
  const blocker = await p.tickets.create({ title: 'Design tokens' }); await p.relations.add(blocker.id, header.id, 'blocks');
  await assert.rejects(() => p.tickets.update(header.id, { status: 'done' }), { code: 'OPEN_WORK' });
  assert.equal((await p.tickets.update(header.id, { status: 'done' }, { force: true })).status, 'done');
});

test('next ranks ready leaves and respects inherited blockers and priorities', async t => {
  const p = await project(t);
  const api = await p.tickets.create({ title: 'User service', priority: 'urgent' });
  const getUser = await p.tickets.create({ title: 'getUser', parentId: api.id });
  const low = await p.tickets.create({ title: 'Docs for getUser', parentId: api.id, priority: 'low' });
  const cart = await p.tickets.create({ title: 'Cart' }), addItem = await p.tickets.create({ title: 'addItem', parentId: cart.id });
  await p.relations.add(api.id, cart.id, 'blocks');
  const other = await p.tickets.create({ title: 'Footer' });
  const ids = (await p.next({ limit: 10 })).map(x => x.id);
  assert.equal(ids[0], getUser.id, 'urgent inherited and unblocks the cart subtree');
  assert.ok(ids.includes(other.id) && ids.includes(low.id));
  assert.ok(!ids.includes(addItem.id) && !ids.includes(cart.id) && !ids.includes(api.id), 'blocked ancestor and open-children parents are not ready');
  assert.ok(ids.indexOf(other.id) < ids.indexOf(low.id), 'explicit low stays low');
  const first = (await p.next({ limit: 1 }))[0];
  assert.equal(first.effectivePriority, 'urgent'); assert.ok(first.reasons.some(r => r.includes('unblocks')));
});

test('claim, lease expiry, release and done report newly ready tickets', async t => {
  const p = await project(t);
  const a = await p.tickets.create({ title: 'Contract' }), b = await p.tickets.create({ title: 'Consumer' });
  await p.relations.add(a.id, b.id, 'blocks');
  await assert.rejects(() => p.claim(b.id, { agent: 'one' }), { code: 'CONFLICT' });
  const claimed = await p.claim(a.id, { agent: 'one' });
  assert.equal(claimed.status, 'in_progress'); assert.equal(claimed.assignee.agent, 'one');
  await assert.rejects(() => p.claim(a.id, { agent: 'two' }), { code: 'CONFLICT' });
  assert.ok(!(await p.next()).some(x => x.id === a.id));
  const later = Date.now() + 2 * 3600_000;
  assert.ok((await p.next({ now: later })).some(x => x.id === a.id), 'expired lease is offered again');
  assert.equal((await p.claim(a.id, { agent: 'two', now: later })).assignee.agent, 'two');
  await assert.rejects(() => p.release(a.id, { agent: 'one' }), { code: 'CONFLICT' });
  assert.equal((await p.release(a.id, { agent: 'two' })).status, 'todo');
  await p.claim(a.id, { agent: 'two' });
  const r = await p.finish(a.id, { agent: 'two', note: 'Implemented and tested' });
  assert.equal(r.ticket.status, 'done'); assert.equal(r.ticket.assignee, null);
  assert.deepEqual(r.unblocked.map(x => x.id), [b.id]);
  assert.equal((await p.comments.list(a.id))[0].author, 'two');
});

test('concurrent claims by different agents leave exactly one owner', async t => {
  const p = await project(t); const a = await p.tickets.create({ title: 'Race' });
  const results = await Promise.allSettled(['x', 'y', 'z'].map(agent => p.claim(a.id, { agent })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});

test('agent onboard prints the briefing and writes nothing', async t => {
  const p = await project(t); const before = await fs.readdir(p.root);
  const text = onboardText();
  for (const word of ['heist guide', 'implements', 'blocks', 'todo', 'in_progress', 'MCP']) assert.ok(text.includes(word), `briefing mentions ${word}`);
  assert.deepEqual(await fs.readdir(p.root), before);
});

test('CLI exposes next, claim, done and relation remove', async t => {
  const p = await project(t); const cwd = p.root; const cli = (...a) => run(process.execPath, [bin, ...a], { cwd, env: { ...process.env, HEIST_AGENT: 'cli-agent' } });
  const a = JSON.parse((await cli('ticket', 'create', '--title', 'A', '--kind', 'feature', '--priority', 'high', '--labels', 'x,y', '--format', 'json')).stdout);
  assert.equal(a.kind, 'feature'); assert.deepEqual(a.labels, ['x', 'y']);
  const b = JSON.parse((await cli('ticket', 'create', '--title', 'B', '--format', 'json')).stdout);
  await cli('relation', 'add', a.id, b.id, 'blocks');
  assert.deepEqual(JSON.parse((await cli('next', '--format', 'json')).stdout).map(x => x.id), [a.id]);
  await cli('claim', a.id);
  const done = JSON.parse((await cli('done', a.id, '--note', 'ok', '--format', 'json')).stdout);
  assert.deepEqual(done.unblocked.map(x => x.id), [b.id]);
  await cli('relation', 'remove', a.id, b.id, 'blocks');
  assert.equal((await p.relations.list()).length, 0);
});
