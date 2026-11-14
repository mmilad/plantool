import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { initProject, openProject, uuidv7 } from '../src/index.js';

// Disposable fixtures only: never register or alter the user's project.
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-roadmap-bench-'));
process.env.HEIST_HOME = path.join(cwd, 'local-home');
const preview = process.argv.includes('--preview');
let server;
try {
  await initProject({cwd, name:'Roadmap verification', key:'DEMO'});
  const rootId=uuidv7(), branchId=uuidv7(), providerId=uuidv7(), consumerId=uuidv7();
  const records=[];
  for(let i=0;i<2000;i++) {
    const id=[rootId,branchId,providerId,consumerId][i]??uuidv7();
    const status=i<4?'todo':i%2===0?'done':i%7===0?'cancelled':i%5===0?'in_progress':'todo';
    const stamp=new Date(Date.UTC(2025,11+Math.floor(i/170),1+i%27,10)).toISOString();
    const record={schemaVersion:1,id,number:i+1,title:['Product delivery','API and integrations','Provider implementation','Contract consumer'][i]??`Delivery step ${String(i).padStart(4,'0')}`,description:'Disposable history for roadmap verification.',kind:i<2?'feature':'task',status,priority:'normal',labels:[],properties:{},parentId:i===0||i===2?null:i===1||i>3?rootId:branchId,createdAt:stamp,updatedAt:stamp,...(status==='done'?{completedAt:stamp,outcome:{summary:'Delivered and verified the planned behavior.'}}:{})};
    const file=path.join(cwd,'.heist','tickets',id.slice(0,2),id+'.json');records.push({file,record});
  }
  for(const dir of new Set(records.map(r=>path.dirname(r.file))))await fs.mkdir(dir,{recursive:true});
  for(let i=0;i<records.length;i+=128)await Promise.all(records.slice(i,i+128).map(r=>fs.writeFile(r.file,JSON.stringify(r.record)+'\n')));
  const project=await openProject({cwd,cache:true});
  const component=await project.components.create({kind:'function',name:'deliver'});
  await project.contracts.set(component.id,{output:{result:'string'}});
  await project.codePlan.add(providerId,'implements',component.id);
  await project.codePlan.add(consumerId,'consumes',component.id);
  // Enough cross-branch dependencies to exercise the bounded view and selected-root context.
  const targets=[branchId,consumerId,...records.slice(4).filter(r=>!['done','cancelled'].includes(r.record.status)).slice(0,240).map(r=>r.record.id)];
  for(const [sourceId,targetId] of [...targets.map(id=>[providerId,id]),[records[4].record.id,consumerId]]) {
    const id=uuidv7(),stamp=new Date().toISOString();
    const dir=path.join(cwd,'.heist','relationships',id.slice(0,2));await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify({schemaVersion:1,id,sourceId,targetId,type:'blocks',createdAt:stamp})+'\n');
  }
  const measurements={};
  for(const name of ['timelineCold','timelineWarm','structure']) {
    const start=performance.now();
    const page=name==='structure'?await project.roadmap.structure(null,{limit:50}):await project.timeline({limit:50,order:'desc'});
    measurements[name+'Ms']=Math.round(performance.now()-start);
    assert.equal(page.items.length,50);
    assert.equal(page.total,name==='structure'?2000:998);
    const second=name==='structure'?await project.roadmap.structure(null,{limit:50,offset:50,snapshot:page.snapshot}):await project.timeline({limit:50,offset:50,order:'desc',snapshot:page.snapshot});
    assert.equal(new Set([...page.items,...second.items].map(t=>t.id)).size,100);
  }
  const depsStart=performance.now(),deps=await project.deps();
  measurements.dependenciesMs=Math.round(performance.now()-depsStart);
  assert.equal(deps.nodes.length,200);assert.equal(deps.truncated,true);
  const scoped=await project.deps({root:consumerId});
  assert.equal(scoped.edges.length,3);assert.equal(scoped.truncated,false);
  assert.ok(scoped.edges.some(e=>e.inherited));
  console.log(JSON.stringify({records:2000,completed:998,...measurements},null,2));
  if(preview) {
    const {serve}=await import('../src/server.js');
    const {registerProject}=await import('../src/registry.js');
    await registerProject(project);
    const second=path.join(cwd,'empty-project');await fs.mkdir(second);
    await initProject({cwd:second,name:'Empty roadmap verification',key:'EMPTY'});
    await registerProject(await openProject({cwd:second}));
    const app=await serve({cwd,port:0});server=app.server;
    console.log(app.url+'/?view=roadmap&mode=structure');
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }
} finally {
  if(server)await new Promise(resolve=>server.close(resolve));
  await fs.rm(cwd,{recursive:true,force:true});
}
