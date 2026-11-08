import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';

process.env.PMAN_EMBEDDER = 'hash';
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'pman-home-sem-'));
process.env.PMAN_HOME = home;
const { initProject, openProject } = await import('../src/index.js');
const { serve } = await import('../src/server.js');
const { closeCaches } = await import('../src/semantic.js');

function send(url, method, headers = {}, body = '') { return new Promise((resolve, reject) => { const u = new URL(url); const req = request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, res => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b })); }); req.on('error', reject); req.end(body); }); }

test('semantic search API: status, opt-in indexing, hybrid search, similar tickets and relations', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pman-ui-sem-'));
  t.after(async () => { closeCaches(); await fs.rm(cwd, { recursive: true, force: true }); await fs.rm(home, { recursive: true, force: true }); });
  await initProject({ cwd }); const p = await openProject({ cwd });
  const nav = await p.tickets.create({ title: 'Header navigation menu' });
  const menu = await p.tickets.create({ title: 'Header navigation menu bar' });
  await p.tickets.create({ title: 'Checkout payment flow' });
  const app = await serve({ cwd, port: 0 }); t.after(() => new Promise(r => app.server.close(r)));
  const host = { host: new URL(app.url).host };
  const page = await send(app.url, 'GET', host); const csrf = /"csrf":"([a-f0-9]+)"/.exec(page.body)[1];
  const write = { ...host, origin: app.url, 'content-type': 'application/json', 'x-pman-csrf': csrf };

  const before = JSON.parse((await send(`${app.url}/api/search/status`, 'GET', host)).body);
  assert.equal(before.available, false); assert.equal(before.mode, 'keyword');
  const fallback = JSON.parse((await send(`${app.url}/api/search?q=navigation&mode=hybrid`, 'GET', host)).body);
  assert.equal(fallback.mode, 'keyword'); assert.ok(fallback.fallbackReason); assert.ok(fallback.items.length >= 1);
  const notYet = JSON.parse((await send(`${app.url}/api/tickets/${nav.id}/similar`, 'GET', host)).body);
  assert.equal(notYet.available, false);

  assert.equal((await send(`${app.url}/api/index/update`, 'POST', write, '{}')).status, 202);
  let st; for (let i = 0; i < 100; i++) { st = JSON.parse((await send(`${app.url}/api/search/status`, 'GET', host)).body); if (st.available && !st.indexing) break; await new Promise(r => setTimeout(r, 50)); }
  assert.equal(st.available, true); assert.equal(st.mode, 'hybrid');

  const hybrid = JSON.parse((await send(`${app.url}/api/search?q=navigation&mode=hybrid&limit=1`, 'GET', host)).body);
  assert.equal(hybrid.mode, 'hybrid'); assert.equal(hybrid.items.length, 1); assert.ok(hybrid.snapshot);
  if (hybrid.nextOffset != null) assert.equal((await send(`${app.url}/api/search?q=navigation&mode=hybrid&offset=1&snapshot=${hybrid.snapshot}`, 'GET', host)).status, 200);
  assert.equal((await send(`${app.url}/api/search?q=navigation&mode=hybrid&offset=1&snapshot=bogus`, 'GET', host)).status, 409);

  const sim = JSON.parse((await send(`${app.url}/api/tickets/${nav.id}/similar`, 'GET', host)).body);
  assert.equal(sim.available, true); assert.ok(Array.isArray(sim.items));

  const rel = await send(`${app.url}/api/relations`, 'POST', write, JSON.stringify({ sourceId: menu.id, targetId: nav.id, type: 'duplicates' }));
  assert.equal(rel.status, 201, rel.body);
  assert.equal((await send(`${app.url}/api/relations`, 'POST', write, JSON.stringify({ sourceId: menu.id, targetId: nav.id, type: 'bogus' }))).status, 400);
});

test('relationship API rejects duplicate edges and cycles with 409 and removes exactly one edge', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pman-ui-rel-'));
  t.after(async () => { await fs.rm(cwd, { recursive: true, force: true }); });
  await initProject({ cwd }); const p = await openProject({ cwd });
  const a = await p.tickets.create({ title: 'A' }), b = await p.tickets.create({ title: 'B' }), c = await p.tickets.create({ title: 'C' });
  const app = await serve({ cwd, port: 0 }); t.after(() => new Promise(r => app.server.close(r)));
  const host = { host: new URL(app.url).host }; const csrf = /"csrf":"([a-f0-9]+)"/.exec((await send(app.url, 'GET', host)).body)[1];
  const write = { ...host, origin: app.url, 'content-type': 'application/json', 'x-pman-csrf': csrf };
  const add = (s, tg, type) => send(`${app.url}/api/relations`, 'POST', write, JSON.stringify({ sourceId: s, targetId: tg, type }));
  const ab = JSON.parse((await add(a.id, b.id, 'blocks')).body);
  const dup = await add(a.id, b.id, 'blocks'); assert.equal(dup.status, 409); assert.equal(JSON.parse(dup.body).code, 'DUPLICATE_RELATION');
  const cyc = await add(b.id, a.id, 'blocks'); assert.equal(cyc.status, 409); assert.equal(JSON.parse(cyc.body).code, 'CYCLE');
  assert.equal((await add(a.id, a.id, 'blocks')).status, 400);
  await add(a.id, c.id, 'blocks');
  assert.equal((await send(`${app.url}/api/relations/${ab.id}`, 'DELETE', write)).status, 200);
  assert.equal((await send(`${app.url}/api/relations/${ab.id}`, 'DELETE', write)).status, 404);
  const left = JSON.parse((await send(`${app.url}/api/tickets/A-1/relations`.replace('A-1', a.id), 'GET', host)).body);
  assert.deepEqual(left.map(r => r.ticket.title), ['C']); assert.equal(left[0].direction, 'outgoing');
  const p2 = await openProject({ cwd }); const key = p2.ticketKey(await p2.tickets.get(a.id));
  if (key) { const byKey = JSON.parse((await send(`${app.url}/api/tickets/${key}/relations`, 'GET', host)).body); assert.equal(byKey[0].direction, 'outgoing'); }
  const s = JSON.parse((await send(`${app.url}/api/search?q=A&types=ticket`, 'GET', host)).body);
  assert.ok(s.items.every(i => !('path' in i))); assert.equal(s.mode, 'keyword');
});
