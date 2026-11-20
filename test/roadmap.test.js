import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

async function project(t) {
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool roadmap '));
  t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  await initProject({cwd,name:'Roadmap'});
  return openProject({cwd});
}

test('completedAt is created, stable through edits, and cleared when work reopens', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Complete me'});
  const done=await p.tickets.update(ticket.id,{status:'done'});
  assert.ok(Number.isFinite(Date.parse(done.completedAt)));
  const edited=await p.tickets.update(ticket.id,{title:'Edited after completion'});
  assert.equal(edited.completedAt,done.completedAt);
  const reopened=await p.tickets.update(ticket.id,{status:'in_progress'});
  assert.equal(reopened.completedAt,undefined);
  const doneAgain=await p.tickets.update(ticket.id,{status:'done'});
  assert.ok(doneAgain.completedAt>=reopened.updatedAt);
  await assert.rejects(()=>p.tickets.update(ticket.id,{completedAt:'2020-01-01T00:00:00.000Z'}),{code:'VALIDATION'});
});

test('timeline sorts, pages, bounds outcome data, and rejects cancelled status', async t => {
  const p=await project(t), a=await p.tickets.create({title:'First',outcome:{summary:'a'.repeat(300),changedFiles:Array.from({length:20},(_,i)=>`file-${i}`)}}), b=await p.tickets.create({title:'Second'});
  await p.tickets.update(a.id,{status:'done'}); await new Promise(r=>setTimeout(r,3)); await p.finish(b.id);
  const first=await p.timeline({limit:1});
  assert.equal(first.items[0].id,a.id); assert.equal(first.total,2); assert.equal(first.nextOffset,1);
  assert.equal(first.items[0].outcome.summary.length,240); assert.equal(first.items[0].outcome.changedFiles.length,10);
  const second=await p.timeline({limit:1,offset:1,snapshot:first.snapshot});
  assert.equal(second.items[0].id,b.id); assert.equal(second.nextOffset,null);
  assert.equal((await p.timeline({order:'desc'})).items[0].id,b.id);
  await assert.rejects(()=>p.timeline({status:'cancelled'}),{code:'VALIDATION'});
});

test('legacy completed tickets fall back to updatedAt and backfill idempotently', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Legacy'});
  const done=await p.tickets.update(ticket.id,{status:'done'}), file=path.join(p.dir,'tickets',ticket.id.slice(0,2),`${ticket.id}.json`);
  const legacy=JSON.parse(await fs.readFile(file,'utf8')); delete legacy.completedAt; await fs.writeFile(file,`${JSON.stringify(legacy,null,2)}\n`);
  const before=await fs.stat(file), preview=await p.roadmap.backfillCompletion({dryRun:true});
  assert.deepEqual({candidates:preview.candidates,changed:preview.changed},{candidates:1,changed:0});
  const row=(await p.timeline()).items[0]; assert.equal(row.completionSource,'updatedAt'); assert.equal(row.completedAt,done.updatedAt);
  const report=await p.roadmap.backfillCompletion();
  assert.equal(report.changed,1); assert.equal(report.items[0].completedAt,done.updatedAt);
  const after=await p.tickets.get(ticket.id); assert.equal(after.completedAt,done.updatedAt); assert.equal(after.updatedAt,done.updatedAt);
  assert.equal((await p.roadmap.backfillCompletion()).changed,0);
  assert.ok((await fs.stat(file)).mtimeMs>=before.mtimeMs);
});

test('structure filters retain ancestor stubs and matches readiness including inherited blockers', async t => {
  const p=await project(t), blocker=await p.tickets.create({title:'Gate'}), parent=await p.tickets.create({title:'Parent'}), child=await p.tickets.create({title:'Needle child',parentId:parent.id}), other=await p.tickets.create({title:'Other'});
  await p.relations.add(blocker.id,parent.id,'blocks');
  const result=await p.roadmap.structure(null,{query:'needle',fields:'plan'});
  assert.deepEqual(result.items.map(x=>x.id),[parent.id,child.id]);
  assert.equal(result.items[0].contextOnly,true); assert.equal(result.items[0].depth,0); assert.equal(result.items[1].depth,1);
  const childRow=result.items[1];
  assert.equal(childRow.ready,false); assert.ok(childRow.readyReasons.some(x=>x.includes(parent.id)));
  assert.deepEqual(childRow.blockedBy.map(x=>x.id),[blocker.id],'inherited blockers are included in the plan projection');
  const gate=(await p.roadmap.structure(null,{query:'Gate'})).items[0]; assert.equal(gate.id,blocker.id);
  assert.notEqual(other.id,gate.id);
});

test('structure paging rejects stale snapshots and validates bounds', async t => {
  const p=await project(t); for(let i=0;i<3;i++)await p.tickets.create({title:`Ticket ${i}`});
  const first=await p.roadmap.structure(null,{limit:1}); assert.equal(first.total,3);
  const page2=await p.roadmap.structure(null,{limit:1,offset:1,snapshot:first.snapshot}); assert.equal(page2.items[0].depth,0);
  const ticket=page2.items[0]; await p.tickets.update(ticket.id,{title:'Changed'});
  await assert.rejects(()=>p.roadmap.structure(null,{limit:1,offset:2,snapshot:first.snapshot}),{code:'STALE_ROADMAP'});
  await assert.rejects(()=>p.roadmap.structure(null,{limit:201}),{code:'VALIDATION'});
});

test('legacy completion estimate remains stable through ordinary edits', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Legacy edit'});
  await p.tickets.update(ticket.id,{status:'done'});
  const file=path.join(p.dir,'tickets',ticket.id.slice(0,2),`${ticket.id}.json`), stored=JSON.parse(await fs.readFile(file,'utf8'));
  const estimatedAt=stored.updatedAt; delete stored.completedAt; await fs.writeFile(file,`${JSON.stringify(stored,null,2)}\n`);
  const edited=await p.tickets.update(ticket.id,{title:'Updated later'});
  assert.equal(edited.completedAt,estimatedAt); assert.equal(edited.completedAtSource,'updatedAt');
  assert.equal((await p.timeline()).items[0].completionSource,'updatedAt');
  const reopened=await p.tickets.update(ticket.id,{status:'todo'});
  assert.equal(reopened.completedAtSource,undefined);
  await p.finish(ticket.id);
  assert.equal((await p.timeline()).items[0].completionSource,'recorded');
});

test('timeline calendar bounds include the entire final day and reject invalid dates', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Calendar',status:'done'});
  const date=ticket.completedAt.slice(0,10);
  assert.equal((await p.timeline({since:ticket.completedAt,until:date})).total,1);
  for(const since of ['2026-02-30','2026-02-30T12:00:00Z','2026-01-01T24:00:00Z'])await assert.rejects(()=>p.timeline({since}),{code:'VALIDATION'});
  await assert.rejects(()=>p.timeline({since:'2026-12-01',until:'2026-11-01'}),{code:'VALIDATION'});
});

test('backfill reports an invalid legacy date once without altering the ticket', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Invalid history',status:'done'});
  const file=path.join(p.dir,'tickets',ticket.id.slice(0,2),ticket.id+'.json');
  delete ticket.completedAt;ticket.updatedAt='2026-02-30T12:00:00Z';
  const text=JSON.stringify(ticket);await fs.writeFile(file,text);
  for(const dryRun of [true,false]){const report=await p.roadmap.backfillCompletion({dryRun});assert.equal(report.changed,0);assert.equal(report.skipped.length,1);assert.equal(report.items.length,0);}
  assert.equal(await fs.readFile(file,'utf8'),text);
});

test('backfill and concurrent ticket edits serialize without losing fields', async t => {
  const p=await project(t), ticket=await p.tickets.create({title:'Legacy concurrent'});
  await p.tickets.update(ticket.id,{status:'done'});
  const file=path.join(p.dir,'tickets',ticket.id.slice(0,2),`${ticket.id}.json`), stored=JSON.parse(await fs.readFile(file,'utf8'));
  delete stored.completedAt; await fs.writeFile(file,`${JSON.stringify(stored,null,2)}\n`);
  const originalRename=fs.rename; let paused=false, signal;
  const reachedRename=new Promise(resolve=>{signal=resolve;}); let release;
  const resume=new Promise(resolve=>{release=resolve;});
  fs.rename=async(from,to)=>{
    if(!paused&&String(to)===file){paused=true;signal();await resume;}
    return originalRename(from,to);
  };
  t.after(()=>{fs.rename=originalRename;release?.();});
  const backfill=p.roadmap.backfillCompletion();
  await reachedRename;
  const edit=p.tickets.update(ticket.id,{title:'Concurrent edit survived'});
  // Give an unprotected writer time to commit while backfill is paused. A serialized writer waits.
  await Promise.race([edit,new Promise(resolve=>setTimeout(resolve,75))]);
  release();
  await backfill; await edit;
  assert.equal((await p.tickets.get(ticket.id)).title,'Concurrent edit survived');
  assert.ok((await p.tickets.get(ticket.id)).completedAt);
});

test('provider readiness and inherited blocker filters match workGraph', async t => {
  const p=await project(t), provider=await p.tickets.create({title:'Provider'}), parent=await p.tickets.create({title:'Consumer parent'}), consumer=await p.tickets.create({title:'Consumer',parentId:parent.id});
  await p.components.create({kind:'service',name:'UserService'});
  await p.codePlan.add(provider.id,'implements','UserService'); await p.codePlan.add(consumer.id,'consumes','UserService');
  const rows=(await p.roadmap.structure(null,{blocked:true})).items;
  assert.deepEqual(rows.map(x=>x.id),[parent.id,consumer.id]);
  assert.equal(rows[1].ready,false); assert.ok(rows[1].blockedBy.some(x=>x.id===provider.id&&x.via==='provider'));
  const unfiltered=await p.roadmap.structure(null,{ready:false,blocked:false});
  assert.equal(unfiltered.total,3,'false flags do not create filters');
});

test('structure lists the newest tickets first at every level', async t => {
  const p = await project(t);
  const old = await p.tickets.create({ title: 'Oldest root' });
  const newer = await p.tickets.create({ title: 'Newer root' });
  const child1 = await p.tickets.create({ title: 'First child', parentId: newer.id });
  const child2 = await p.tickets.create({ title: 'Second child', parentId: newer.id });
  const page = await p.roadmap.structure(null, { fields: 'row' });
  const rootsOrder = page.items.filter(x => x.depth === 0).map(x => x.id);
  assert.deepEqual(rootsOrder, [newer.id, old.id]);
  const under = page.items.filter(x => x.parentId === newer.id).map(x => x.id);
  assert.deepEqual(under, [child2.id, child1.id]);
});
