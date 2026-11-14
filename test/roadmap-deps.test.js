import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject, openProject, uuidv7 } from '../src/index.js';

const cli=fileURLToPath(new URL('../bin/heist.js',import.meta.url));
async function project(t){
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'heist-roadmap-deps-'));
  t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  await initProject({cwd,name:'Dependencies',key:'DEP'});
  const p=await openProject({cwd});
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{cwd,env:{...process.env,HEIST_NO_REGISTER:'1',HEIST_HOME:path.join(cwd,'local-home')},encoding:'utf8'});
  return {cwd,p,run};
}

test('deps aliases produce a bounded dependency graph and validate options',async t=>{
  const {p,run}=await project(t);
  const blocker=await p.tickets.create({title:'Ready blocker'});
  const active=await p.tickets.create({title:'Active work'});
  const finished=await p.tickets.create({title:'Finished blocker',status:'done'});
  const target=await p.tickets.create({title:'Blocked work'});
  const finishedTarget=await p.tickets.create({title:'Finished target',status:'done'});
  const cancelledTarget=await p.tickets.create({title:'Cancelled target',status:'cancelled'});
  await p.relations.add(blocker.id,target.id,'blocks');
  await p.relations.add(finished.id,target.id,'blocks');
  await p.relations.add(blocker.id,finishedTarget.id,'blocks');
  await p.relations.add(blocker.id,cancelledTarget.id,'blocks');

  const result=await p.deps();
  assert.deepEqual(result,await p.roadmap.deps());
  assert.deepEqual(result.edges.map(e=>[e.sourceId,e.targetId,e.via]),[[blocker.id,target.id,'blocks']]);
  assert.equal(result.totalNodes,2);assert.equal(result.totalEdges,1);
  assert.equal(result.limit,200);assert.equal(result.edgeLimit,500);assert.equal(result.truncated,false);
  assert.equal(result.omittedNodes,0);assert.equal(result.omittedEdges,0);assert.equal(result.rootId,null);
  assert.ok(result.nodes.every(n=>n.contextOnly===false));

  const withFinished=await p.roadmap.deps({includeFinished:true});
  assert.equal(withFinished.totalEdges,4);
  assert.ok(withFinished.edges.some(e=>e.sourceId===finished.id));
  assert.ok(withFinished.edges.some(e=>e.targetId===finishedTarget.id));
  assert.ok(withFinished.edges.some(e=>e.targetId===cancelledTarget.id));
  assert.deepEqual(await p.roadmap.deps({limit:1}),await p.deps({limit:1}));
  for(const options of [{limit:0},{limit:201},{limit:1.5},{limit:'2'},{includeFinished:'yes'},{root:17},{snapshot:12}])
    await assert.rejects(()=>p.deps(options),{code:'VALIDATION'});
  await assert.rejects(()=>p.deps({root:'DEP-999'}),{code:'NOT_FOUND'});

  const cliResult=run('deps','--limit','200','--format','json');
  assert.equal(cliResult.status,0,cliResult.stderr);
  assert.deepEqual(JSON.parse(cliResult.stdout),result);
  const human=run('deps');assert.equal(human.status,0,human.stderr);
  assert.match(human.stdout,/Blocked work ← DEP-1 Ready blocker \[blocks\]/,
    'human output labels the blocked ticket on the left and its blocker on the right');
  assert.notEqual(run('deps','--limit','0').status,0);
  assert.notEqual(run('deps','--limit','not-a-number').status,0);
  assert.notEqual(run('deps','--include-finished','--limit','201').status,0);
  assert.notEqual(run('deps','--root','DEP-999').status,0);
  assert.ok(active,'fixture also contains an unrelated open node');
});

test('provider stage selection is coalesced and keeps an explicit edge',async t=>{
  const {p}=await project(t);
  const component=await p.components.create({kind:'service',name:'SearchService'});
  const cache=await p.components.create({kind:'service',name:'CacheService'});
  const fullOnly=await p.components.create({kind:'service',name:'MetricsService'});
  const mock=await p.tickets.create({title:'Mock provider'});
  const full=await p.tickets.create({title:'Full provider'});
  const mockConsumer=await p.tickets.create({title:'Mock consumer'});
  const fullConsumer=await p.tickets.create({title:'Full consumer'});
  const mixedConsumer=await p.tickets.create({title:'Mixed consumer'});
  const fallbackProvider=await p.tickets.create({title:'Fallback provider'});
  const fallbackConsumer=await p.tickets.create({title:'Fallback consumer'});
  await p.codePlan.add(mock.id,'implements','SearchService',{stage:'mock'});
  await p.codePlan.add(mock.id,'implements','CacheService',{stage:'mock'});
  await p.codePlan.add(full.id,'implements','SearchService');
  await p.codePlan.add(full.id,'implements','CacheService');
  await p.codePlan.add(fallbackProvider.id,'implements','MetricsService');
  await p.codePlan.add(mockConsumer.id,'consumes','SearchService',{needs:'mock'});
  await p.codePlan.add(mockConsumer.id,'consumes','CacheService',{needs:'mock'});
  await p.codePlan.add(fullConsumer.id,'consumes','SearchService');
  await p.codePlan.add(fullConsumer.id,'consumes','CacheService');
  await p.codePlan.add(mixedConsumer.id,'consumes','SearchService',{needs:'mock'});
  await p.codePlan.add(fallbackConsumer.id,'consumes','MetricsService',{needs:'mock'});
  await p.relations.add(full.id,fullConsumer.id,'blocks');

  const {edges}=await p.deps();
  const providerEdges=edges.filter(e=>e.via==='provider');
  const pairs=providerEdges.map(e=>[e.sourceId,e.targetId].join('>')).sort();
  assert.deepEqual(pairs,[
    `${full.id}>${fullConsumer.id}`,
    `${fallbackProvider.id}>${fallbackConsumer.id}`,
    `${mock.id}>${mockConsumer.id}`,
    `${mock.id}>${mixedConsumer.id}`,
  ].sort());
  const fullConsumerEdge=providerEdges.find(e=>e.sourceId===full.id&&e.targetId===fullConsumer.id);
  assert.deepEqual(fullConsumerEdge.components.map(c=>[c.name,c.stage]).sort(),[
    ['CacheService','full'],['SearchService','full'],
  ].sort(),'multiple components between a ticket pair coalesce on one provider edge');
  assert.deepEqual(providerEdges.find(e=>e.targetId===mockConsumer.id).components.map(c=>c.stage),['mock','mock']);
  assert.equal(providerEdges.find(e=>e.targetId===fallbackConsumer.id).components[0].stage,'full',
    'a mock request falls back to a full provider when no mock exists');
  assert.ok(edges.some(e=>e.sourceId===full.id&&e.targetId===fullConsumer.id&&e.via==='blocks'),
    'explicit blocks and provider edges between the same tickets remain independent');
  assert.deepEqual(providerEdges.find(e=>e.targetId===mixedConsumer.id).components.map(c=>c.stage),['mock']);
});

test('root scope includes cross-boundary edges and actual ancestor blockers',async t=>{
  const {p}=await project(t);
  const ancestor=await p.tickets.create({title:'Root ancestor'});
  const root=await p.tickets.create({title:'Selected root',parentId:ancestor.id});
  const child=await p.tickets.create({title:'Selected child',parentId:root.id});
  const otherBranch=await p.tickets.create({title:'Other branch'});
  const ancestorGate=await p.tickets.create({title:'Ancestor gate'});
  const incoming=await p.tickets.create({title:'Incoming dependency'});
  const outgoing=await p.tickets.create({title:'Outgoing dependency'});
  const irrelevant=await p.tickets.create({title:'Irrelevant blocker'});
  await p.relations.add(ancestorGate.id,ancestor.id,'blocks');
  await p.relations.add(incoming.id,child.id,'blocks');
  await p.relations.add(child.id,outgoing.id,'blocks');
  await p.relations.add(irrelevant.id,otherBranch.id,'blocks');

  const graph=await p.deps({root:p.ticketKey(root)});
  assert.equal(graph.rootId,root.id);
  assert.equal(graph.nodes[0].id,root.id);
  const edgePairs=graph.edges.map(e=>`${e.sourceId}>${e.targetId}`);
  assert.deepEqual(edgePairs.sort(),[
    `${ancestorGate.id}>${ancestor.id}`,
    `${incoming.id}>${child.id}`,
    `${child.id}>${outgoing.id}`,
  ].sort());
  assert.equal(graph.edges.find(e=>e.sourceId===ancestorGate.id).inherited,true);
  for(const id of [ancestorGate.id,ancestor.id,incoming.id,outgoing.id])
    assert.equal(graph.nodes.find(n=>n.id===id).contextOnly,true);
  assert.equal(graph.nodes.find(n=>n.id===root.id).contextOnly,false);
  assert.equal(graph.nodes.some(n=>n.id===irrelevant.id||n.id===otherBranch.id),false);

  const isolated=await p.tickets.create({title:'Isolated root'});
  const noEdges=await p.roadmap.deps({root:isolated.id});
  assert.deepEqual(noEdges.nodes.map(n=>n.id),[isolated.id]);
  assert.deepEqual(noEdges.edges,[]);
  assert.equal(noEdges.rootId,isolated.id);
});

test('node and edge caps report exact totals and preserve endpoint closure',async t=>{
  const {p}=await project(t);
  const nodes=[];
  for(let i=0;i<33;i++)nodes.push(await p.tickets.create({title:`Dense ${String(i).padStart(2,'0')}`}));
  // A directed acyclic complete graph yields 528 edges while keeping the fixture small.
  const createdAt=new Date().toISOString(),records=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)records.push({schemaVersion:1,id:uuidv7(),sourceId:nodes[i].id,targetId:nodes[j].id,type:'blocks',createdAt});
  const relationDirs=[...new Set(records.map(r=>path.join(p.dir,'relationships',r.id.slice(0,2))))];
  await Promise.all(relationDirs.map(dir=>fs.mkdir(dir,{recursive:true})));
  await Promise.all(records.map(r=>fs.writeFile(path.join(p.dir,'relationships',r.id.slice(0,2),`${r.id}.json`),`${JSON.stringify(r,null,2)}\n`)));
  const limited=await p.deps({limit:5});
  assert.equal(limited.totalNodes,33);assert.equal(limited.totalEdges,528);
  assert.equal(limited.nodes.length,5);assert.equal(limited.edges.length,10);
  assert.equal(limited.omittedNodes,28);assert.equal(limited.omittedEdges,518);assert.equal(limited.truncated,true);
  const full=await p.deps();
  assert.equal(full.nodes.length,33);assert.equal(full.edges.length,500);
  assert.equal(full.omittedNodes,0);assert.equal(full.omittedEdges,28);assert.equal(full.truncated,true);
  const ids=new Set(full.nodes.map(n=>n.id));
  assert.ok(full.edges.every(e=>ids.has(e.sourceId)&&ids.has(e.targetId)));
});

test('snapshots include scoped data and options and leave project records untouched',async t=>{
  const {p}=await project(t);
  const root=await p.tickets.create({title:'Snapshot root'});
  const blocker=await p.tickets.create({title:'Snapshot blocker'});
  const relation=await p.relations.add(blocker.id,root.id,'blocks');
  const graph=await p.deps({root:root.id,limit:1});
  const recordFiles=await fs.readdir(path.join(p.dir,'tickets',root.id.slice(0,2)));
  const rootFile=path.join(p.dir,'tickets',root.id.slice(0,2),`${root.id}.json`);
  const relationFiles=[`${relation.id}.json`];
  const beforeRoot=await fs.readFile(rootFile,'utf8');
  const relationDir=path.join(p.dir,'relationships',relation.id.slice(0,2));
  const beforeRelation=await Promise.all(relationFiles.map(f=>fs.readFile(path.join(relationDir,f),'utf8')));
  assert.ok(recordFiles.includes(`${root.id}.json`));
  assert.deepEqual(await p.deps({root:root.id,limit:1,snapshot:graph.snapshot}),graph);
  await assert.rejects(()=>p.deps({root:root.id,limit:2,snapshot:graph.snapshot}),{code:'STALE_ROADMAP'},'limit is part of the snapshot query');
  await p.tickets.update(blocker.id,{title:'Changed blocker'});
  await assert.rejects(()=>p.deps({root:root.id,limit:1,snapshot:graph.snapshot}),{code:'STALE_ROADMAP'});
  const afterRoot=await fs.readFile(rootFile,'utf8');
  const afterRelation=await Promise.all(relationFiles.map(f=>fs.readFile(path.join(relationDir,f),'utf8')));
  assert.equal(afterRoot,beforeRoot);assert.deepEqual(afterRelation,beforeRelation,'graph reads do not mutate stored plan data');
});
