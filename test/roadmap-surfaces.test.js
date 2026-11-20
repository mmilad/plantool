import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { initProject, openProject } from '../src/index.js';
import { serve } from '../src/server.js';

const cli = fileURLToPath(new URL('../bin/plantool.js', import.meta.url));
async function fixture(t) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'plantool-roadmap-surfaces-'));
  t.after(() => fs.rm(cwd, {recursive:true, force:true}));
  await initProject({cwd, name:'Roadmap', key:'RM'});
  const p = await openProject({cwd});
  const parent = await p.tickets.create({title:'Feature', kind:'feature'});
  const first = await p.tickets.create({title:'First shipped', parentId:parent.id, status:'done'});
  const second = await p.tickets.create({title:'Second shipped', parentId:parent.id, status:'done'});
  const waiting = await p.tickets.create({title:'Waiting', parentId:parent.id});
  const blocker = await p.tickets.create({title:'Blocker'});
  await p.relations.add(blocker.id, waiting.id, 'blocks');
  const run = (...args) => spawnSync(process.execPath, [cli,...args], {cwd, env:{...process.env, PLANTOOL_NO_REGISTER:'1', PLANTOOL_HOME:path.join(cwd,'local-home')}, encoding:'utf8'});
  return {cwd,p,parent,first,second,waiting,blocker,run};
}

test('timeline and enriched tree CLI expose the same paginated rows as the public API', async t => {
  const {p,run} = await fixture(t);
  const result = run('timeline','--limit','1','--order','desc','--format','json');
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),await p.timeline({limit:1,order:'desc'}));
  const first=JSON.parse(result.stdout);
  const next=run('timeline','--limit','1','--order','desc','--offset','1','--snapshot',first.snapshot,'--format','json');
  assert.equal(next.status,0,next.stderr);assert.notEqual(JSON.parse(next.stdout).items[0].id,first.items[0].id);
  const tree=run('tree','--fields','plan','--blocked','--format','json');
  assert.equal(tree.status,0,tree.stderr);
  assert.deepEqual(JSON.parse(tree.stdout),await p.roadmap.structure(null,{fields:'plan',blocked:true}));
  assert.equal(JSON.parse(tree.stdout).items[0].contextOnly,true);
  assert.ok(Array.isArray(JSON.parse(run('tree','--format','json').stdout)),'old tree shape stays an array');
  assert.notEqual(run('timeline','--status','cancelled').status,0);
  assert.notEqual(run('timeline','--since','nonsense').status,0);
  assert.notEqual(run('tree','--fields','plan','--limit','0').status,0);
  assert.match(run('tree','--blocked','--verbose').stdout,/blocked by RM-/);
  assert.equal(JSON.parse(run('roadmap','backfill-completion','--dry-run','--format','json').stdout).changed,0);
});

test('roadmap HTTP routes preserve parity, project scoping, filters and stale-page errors', async t => {
  const {cwd,p,first,waiting,blocker}=await fixture(t);
  const app=await serve({cwd,port:0});
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
  const get=async route=>{const res=await fetch(app.url+route);return {status:res.status,body:await res.json()};};
  const route='/api/roadmap/timeline?limit=1&order=desc';
  const page=await get(route);assert.equal(page.status,200);
  assert.deepEqual(page.body,await p.timeline({limit:1,order:'desc'}));
  const scoped=await get(`/api/projects/${app.defaultProjectId}/roadmap/timeline?limit=1&order=desc`);
  assert.deepEqual(scoped.body,page.body);
  const structure=await get('/api/roadmap/structure?blocked=true');
  assert.equal(structure.status,200);assert.deepEqual(structure.body,await p.roadmap.structure(null,{blocked:true}));
  assert.equal(structure.body.items.at(-1).id,waiting.id);
  const textFilter=await get('/api/roadmap/structure?q=Waiting');
  assert.equal(textFilter.body.items.length,2);assert.equal(textFilter.body.items[0].contextOnly,true);
  const deps=await get('/api/roadmap/deps');
  assert.equal(deps.status,200);assert.deepEqual(deps.body,await p.deps());
  const scopedDeps=await get(`/api/projects/${app.defaultProjectId}/roadmap/deps`);
  assert.equal(scopedDeps.status,200);assert.deepEqual(scopedDeps.body,deps.body);
  assert.equal(deps.body.edges[0].sourceId,blocker.id,'blocking edges point from blocker to blocked ticket');
  for(const query of ['limit=0','limit=201','offset=-1','since=bad','order=wrong','status=cancelled'])assert.equal((await get('/api/roadmap/timeline?'+query)).status,400,query);
  for(const query of ['limit=0','limit=201','includeFinished=maybe'])assert.equal((await get('/api/roadmap/deps?'+query)).status,400,query);
  assert.equal((await get('/api/roadmap/structure?ready=maybe')).status,400);
  await p.tickets.update(first.id,{title:'Renamed'});
  assert.equal((await get(route+'&offset=1&snapshot='+page.body.snapshot)).status,409);
  await p.tickets.update(waiting.id,{title:'Waiting changed'});
  assert.equal((await get('/api/roadmap/structure?blocked=true&snapshot='+structure.body.snapshot)).status,409);
  assert.equal((await get('/api/roadmap/deps?snapshot='+deps.body.snapshot)).status,409);
});
