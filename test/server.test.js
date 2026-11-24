import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { initProject } from '../src/index.js';
import { serve } from '../src/server.js';

function send(url,method,headers={},body='') { return new Promise((resolve,reject)=>{const u=new URL(url);const req=request({hostname:u.hostname,port:u.port,path:u.pathname+u.search,method,headers},res=>{let d='';res.setEncoding('utf8');res.on('data',x=>d+=x);res.on('end',()=>resolve({status:res.statusCode,body:d,headers:res.headers}));});req.on('error',reject);req.end(body);}); }

test('serve is loopback-only and protects writes with Host, Origin and CSRF checks',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));
  const page=await send(app.url,'GET',{host:new URL(app.url).host});assert.equal(page.status,200);
  const token=/"csrf":"([a-f0-9]+)"/.exec(page.body)?.[1];assert.ok(token);
  const blocked=await send(app.url,'POST',{host:new URL(app.url).host,'content-type':'application/json'},'{}');assert.equal(blocked.status,403);
  const badHost=await send(app.url,'GET',{host:'evil.example'});assert.equal(badHost.status,403);
  const good=await send(app.url+'/api/tickets','POST',{host:new URL(app.url).host,origin:app.url,'content-type':'application/json','x-plantool-csrf':token},JSON.stringify({title:'From browser'}));assert.equal(good.status,201,good.body);
});

test('ticket create API replays an uncertain request after server restart',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-idempotent-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  let app=await serve({cwd,port:0});const host={host:new URL(app.url).host};
  const page=await send(app.url,'GET',host),token=/"csrf":"([a-f0-9]+)"/.exec(page.body)?.[1];assert.ok(token);
  const headers={...host,origin:app.url,'content-type':'application/json','x-plantool-csrf':token};
  const payload={title:'Retry-safe ticket',requestKey:'http-create-request-0001'};
  const first=await send(app.url+'/api/tickets','POST',headers,JSON.stringify(payload));assert.equal(first.status,201,first.body);const ticket=JSON.parse(first.body);
  await new Promise((resolve,reject)=>app.server.close(error=>error?reject(error):resolve()));app=await serve({cwd,port:0});
  const restartedHost={host:new URL(app.url).host},restartedPage=await send(app.url,'GET',restartedHost),restartedToken=/"csrf":"([a-f0-9]+)"/.exec(restartedPage.body)?.[1];assert.ok(restartedToken);
  const restartedHeaders={...restartedHost,origin:app.url,'content-type':'application/json','x-plantool-csrf':restartedToken};
  const replay=await send(app.url+'/api/tickets','POST',restartedHeaders,JSON.stringify(payload));assert.equal(replay.status,201,replay.body);assert.equal(JSON.parse(replay.body).id,ticket.id);
  const mismatch=await send(app.url+'/api/tickets','POST',restartedHeaders,JSON.stringify({...payload,title:'Changed payload'}));assert.equal(mismatch.status,409,mismatch.body);
  const p=await (await import('../src/index.js')).openProject({cwd});assert.equal((await p.tickets.list({limit:Infinity})).length,1);
  t.after(()=>new Promise(resolve=>app.server.close(resolve)));
});

test('document API lists metadata only and fetches one document by kind and id',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-docs-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});
  const docs=[];for(let i=0;i<3;i++)docs.push(await p.documents.create('goals',{title:`Goal ${i}`,body:'x'.repeat(10000)}));
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const page=JSON.parse((await send(`${app.url}/api/documents?kind=goals&limit=2`,'GET',host)).body);
  assert.equal(page.total,3);assert.equal(page.items.length,2);assert.equal('body' in page.items[0],false);
  const rest=JSON.parse((await send(`${app.url}/api/documents?kind=goals&limit=2&offset=2`,'GET',host)).body);assert.equal(rest.items.length,1);
  const one=JSON.parse((await send(`${app.url}/api/documents/goals/${docs[1].id}`,'GET',host)).body);assert.equal(one.title,'Goal 1');assert.equal(one.body.trim().length,10000);
  assert.equal((await send(`${app.url}/api/documents/plans/${docs[1].id}`,'GET',host)).status,404);
  assert.equal((await send(`${app.url}/api/documents/secrets/${docs[1].id}`,'GET',host)).status,400);
  assert.equal((await send(`${app.url}/api/documents?kind=goals&limit=0`,'GET',host)).status,400);
});

test('finishing a parent with open children over HTTP is a 409 conflict',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-open-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const parent=await p.tickets.create({title:'Header'});await p.tickets.create({title:'Subnav',parentId:parent.id});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host=new URL(app.url).host;
  const page=await send(app.url,'GET',{host});const token=/"csrf":"([a-f0-9]+)"/.exec(page.body)[1];
  const r=await send(`${app.url}/api/tickets/${parent.id}`,'PATCH',{host,origin:app.url,'x-plantool-csrf':token,'content-type':'application/json'},JSON.stringify({status:'done'}));
  assert.equal(r.status,409);assert.equal(JSON.parse(r.body).code,'OPEN_WORK');
});

test('tree API returns lightweight paginated rows with child counts',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-tree-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});
  const root=await p.tickets.create({title:'Root',description:'y'.repeat(5000),properties:{big:'z'.repeat(5000)}});for(let i=0;i<3;i++)await p.tickets.create({title:`Child ${i}`,parentId:root.id});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const page=JSON.parse((await send(`${app.url}/api/tree?limit=2`,'GET',host)).body);
  assert.equal(page.total,4);assert.equal(page.items.length,2);assert.equal(page.items[0].childCount,3);assert.equal(page.items[1].depth,1);
  assert.equal('description' in page.items[0],false);assert.equal('properties' in page.items[0],false);
  assert.equal((await send(`${app.url}/api/tree?limit=9999`,'GET',host)).status,400);
});

test('search API pages results and rejects stale snapshots with 409',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-search-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});for(let i=0;i<25;i++)await p.tickets.create({title:`Task ${String(i).padStart(2,'0')}`});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const a=JSON.parse((await send(`${app.url}/api/search?q=task`,'GET',host)).body);assert.equal(a.items.length,20);assert.equal(a.total,25);assert.equal(a.nextOffset,20);
  const b=JSON.parse((await send(`${app.url}/api/search?q=task&offset=20&snapshot=${a.snapshot}`,'GET',host)).body);assert.equal(b.items.length,5);assert.equal(b.nextOffset,null);
  await p.tickets.create({title:'Task new'});
  assert.equal((await send(`${app.url}/api/search?q=task&offset=20&snapshot=${a.snapshot}`,'GET',host)).status,409);
  assert.equal((await send(`${app.url}/api/search?q=task&limit=101`,'GET',host)).status,400);
});

test('documents can be created and updated over HTTP with revision checks',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-docedit-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const tk=await p.tickets.create({title:'T'});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host=new URL(app.url).host;
  const token=/"csrf":"([a-f0-9]+)"/.exec((await send(app.url,'GET',{host})).body)[1];const w={host,origin:app.url,'x-plantool-csrf':token,'content-type':'application/json'};
  const created=await send(`${app.url}/api/documents/decisions`,'POST',w,JSON.stringify({title:'Use JSON',body:'Because',links:[tk.id]}));assert.equal(created.status,201);const d=JSON.parse(created.body);assert.ok(d.revision);
  assert.equal((await send(`${app.url}/api/documents/decisions`,'POST',w,JSON.stringify({title:''}))).status,400);
  assert.equal((await send(`${app.url}/api/documents/decisions`,'POST',{host,'content-type':'application/json'},JSON.stringify({title:'x'}))).status,403);
  const patched=await send(`${app.url}/api/documents/decisions/${d.id}`,'PATCH',w,JSON.stringify({title:'Use JSON files',expectedRevision:d.revision}));assert.equal(patched.status,200);const u=JSON.parse(patched.body);assert.equal(u.changed,true);
  const stale=await send(`${app.url}/api/documents/decisions/${d.id}`,'PATCH',w,JSON.stringify({title:'Stale',expectedRevision:d.revision}));assert.equal(stale.status,409);assert.equal(JSON.parse(stale.body).code,'CONFLICT');
  assert.equal((await send(`${app.url}/api/documents/decisions/${d.id}`,'PATCH',w,JSON.stringify({title:'No revision'}))).status,400);
  const got=JSON.parse((await send(`${app.url}/api/documents/decisions/${d.id}`,'GET',{host})).body);assert.equal(got.title,'Use JSON files');assert.equal(got.revision,u.revision);
});

test('version endpoint changes per area when files change on disk',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-version-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const tk=await p.tickets.create({title:'A'});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const get=async()=>JSON.parse((await send(`${app.url}/api/version`,'GET',host)).body);
  const a=await get();await new Promise(r=>setTimeout(r,2100));await p.documents.create('goals',{title:'G'});const b=await get();
  assert.notEqual(a.version,b.version);assert.equal(a.parts.tree,b.parts.tree);assert.notEqual(a.parts.documents,b.parts.documents);
  await new Promise(r=>setTimeout(r,2100));await p.tickets.update(tk.id,{title:'B'});const c=await get();assert.notEqual(b.parts.tree,c.parts.tree);assert.equal(b.parts.documents,c.parts.documents);
});

test('plan and design endpoints expose readiness, code plans and check results',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-design-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});
  await p.types.set('User',{email:'string'});await p.components.create({kind:'service',name:'UserService'});await p.components.create({kind:'method',name:'getUser',parentId:'UserService'});await p.contracts.set('getUser',{input:{userId:'string'},output:'User'});
  const prov=await p.tickets.create({title:'Build users'}),cons=await p.tickets.create({title:'Cart'});await p.codePlan.add(prov.id,'implements','UserService');await p.codePlan.add(cons.id,'consumes','getUser',{requires:['userId']});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const plan=JSON.parse((await send(`${app.url}/api/tickets/${cons.id}/plan`,'GET',host)).body);
  assert.equal(plan.readiness.ready,false);assert.match(plan.readiness.reasons[0],/provider/);assert.equal(plan.codePlan.consumes[0].name,'UserService.getUser');assert.deepEqual(plan.errors.map(e=>e.code),['REQUIRED_FIELD_MISSING']);
  const design=JSON.parse((await send(`${app.url}/api/design`,'GET',host)).body);
  assert.deepEqual(design.components.map(c=>c.qualifiedName),['UserService','UserService.getUser']);assert.equal(design.components[1].contract.version,1);assert.equal(design.components[0].tickets[0].relation,'implements');assert.equal(design.check.valid,false);
});

test('relations endpoint returns both directions with counterpart tickets',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-rel-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const a=await p.tickets.create({title:'A'}),b=await p.tickets.create({title:'B'}),c=await p.tickets.create({title:'C'});
  await p.relations.add(a.id,b.id,'blocks');await p.relations.add(b.id,c.id,'implements');
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const rels=JSON.parse((await send(`${app.url}/api/tickets/${b.id}/relations`,'GET',host)).body);
  assert.deepEqual(rels.map(r=>[r.type,r.direction,r.ticket.title]).sort(),[['blocks','incoming','A'],['implements','outgoing','C']]);
  assert.equal((await send(`${app.url}/api/tickets/01a189ac-28ff-73c2-8a77-000000000000/relations`,'GET',host)).status,404);
});

test('comments API pages from the newest window and can centre on one comment',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-comments-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const tk=await p.tickets.create({title:'T'});const ids=[];for(let i=0;i<45;i++){ids.push((await p.comments.add(tk.id,{body:`c${i}`})).id);await new Promise(resolve=>{const after=Date.now();const next=()=>Date.now()>after?resolve():setTimeout(next,1);next();});}
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};const get=async q=>JSON.parse((await send(`${app.url}/api/tickets/${tk.id}/comments${q}`,'GET',host)).body);
  const newest=await get('');assert.equal(newest.total,45);assert.equal(newest.offset,25);assert.deepEqual(newest.items.map(c=>c.body).slice(-1),['c44']);
  const first=await get('?offset=0&limit=10');assert.equal(first.items[0].body,'c0');assert.equal(first.items.length,10);
  const around=await get(`?around=${ids[3]}`);assert.equal(around.found,true);assert.ok(around.items.some(c=>c.id===ids[3]));assert.equal(around.offset,0);
  assert.equal((await get('?around=01a189ac-28ff-73c2-8a77-000000000000')).found,false);
  assert.equal((await send(`${app.url}/api/tickets/01a189ac-28ff-73c2-8a77-000000000000/comments`,'GET',host)).status,404);
});

test('serve from any directory lists registered projects and scopes the API per project',async t=>{
  const home=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-home-'));const prev=process.env.PLANTOOL_HOME;process.env.PLANTOOL_HOME=home;t.after(async()=>{process.env.PLANTOOL_HOME=prev;await fs.rm(home,{recursive:true,force:true});});
  const {openProject}=await import('../src/index.js');const {registerProject}=await import('../src/registry.js');
  const mk=async name=>{const cwd=await fs.mkdtemp(path.join(os.tmpdir(),`plantool-multi-${name}-`));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd,name});return openProject({cwd});};
  const shop=await mk('Shop'),game=await mk('Game');await shop.tickets.create({title:'Cart'});await shop.tickets.create({title:'Checkout',status:'in_progress'});const level=await game.tickets.create({title:'Level 1'});
  await registerProject(shop);
  const outside=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-outside-'));t.after(()=>fs.rm(outside,{recursive:true,force:true}));
  const app=await serve({cwd:outside,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host=new URL(app.url).host;
  const token=/"csrf":"([a-f0-9]+)"/.exec((await send(app.url,'GET',{host})).body)[1];const w={host,origin:app.url,'x-plantool-csrf':token,'content-type':'application/json'};
  let list=JSON.parse((await send(`${app.url}/api/projects`,'GET',{host})).body);assert.equal(list.defaultProjectId,null);assert.deepEqual(list.projects.map(p=>[p.key,p.tickets,p.open,p.inProgress]),[['SHOP',2,2,1]]);
  const added=await send(`${app.url}/api/projects`,'POST',w,JSON.stringify({path:game.root}));assert.equal(added.status,201);
  list=JSON.parse((await send(`${app.url}/api/projects`,'GET',{host})).body);assert.deepEqual(list.projects.map(p=>p.key),['GAME','SHOP']);
  const gameId=list.projects[0].id;const tree=JSON.parse((await send(`${app.url}/api/projects/${gameId}/tree`,'GET',{host})).body);assert.deepEqual(tree.items.map(x=>[x.title,x.key]),[['Level 1','GAME-1']]);
  assert.match((await send(app.url,'GET',{host})).body,/route\.type==='projects'/,'root is the projects overview');
  for(const route of [gameId,`${gameId}/list`,`${gameId}/list/${level.id}`,`${gameId}/board`,`${gameId}/${level.id}`,`${gameId}/documents`,`${gameId}/documents/01a20e40-1234-7000-8000-000000000000`])assert.equal((await send(`${app.url}/${route}`,'GET',{host})).status,200,route+' serves the app shell');
  assert.equal((await send(`${app.url}/not-a-route`,'GET',{host})).status,404);
  const byKey=JSON.parse((await send(`${app.url}/api/projects/${list.projects[1].id}/tickets/SHOP-2`,'GET',{host})).body);assert.equal(byKey.title,'Checkout');
  assert.equal((await send(`${app.url}/api/tree`,'GET',{host})).status,404,'no default project outside a repository');
  assert.equal((await send(`${app.url}/api/projects/000000000000/tree`,'GET',{host})).status,404);
  assert.equal((await send(`${app.url}/api/projects`,'POST',w,JSON.stringify({path:outside}))).status,404);
  assert.equal((await send(`${app.url}/api/projects/${gameId}`,'DELETE',w)).status,200);assert.ok(await fs.access(path.join(game.root,'.plan','config.json')).then(()=>true),'files untouched');
  assert.deepEqual(JSON.parse((await send(`${app.url}/api/projects`,'GET',{host})).body).projects.map(p=>p.key),['SHOP']);
});

test('decision routes create, read, score and decide through the local server', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'plantool-ui-decisions-')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd });
  const app = await serve({ cwd, port: 0 }); t.after(() => new Promise(r => app.server.close(r)));
  const host = new URL(app.url).host;
  const page = await send(app.url, 'GET', { host }); const token = /"csrf":"([a-f0-9]+)"/.exec(page.body)?.[1]; assert.ok(token);
  const write = (path, method, payload) => send(app.url + path, method, { host, origin: app.url, 'content-type': 'application/json', 'x-plantool-csrf': token }, JSON.stringify(payload));
  const created = JSON.parse((await write('/api/decisions', 'POST', { question: 'Which framework?', criteria: 'Speed:3', options: ['A', 'B'] })).body);
  const id = created.decision.id; assert.equal(created.options.length, 2);
  const listed = JSON.parse((await send(app.url + '/api/decisions', 'GET', { host })).body); assert.ok(listed.some(d => d.id === id));
  const scored = await write(`/api/options/${created.options[0].id}/score`, 'POST', { scores: { [created.decision.decision.criteria[0].id]: 5 } }); assert.equal(scored.status, 200);
  const evaluated = JSON.parse((await send(app.url + `/api/decisions/${id}`, 'GET', { host })).body); assert.equal(evaluated.suggested.option, created.options[0].id);
  const decided = await write(`/api/decisions/${id}/decide`, 'POST', { option: created.options[0].id, why: 'fastest in our tests' }); assert.equal(decided.status, 200);
  assert.equal(JSON.parse(decided.body).chosen, created.options[0].id);
});

test('blueprint and comment routes let a person change what is expected and leave a note', async t => {
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'plantool-ui-bp-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));
  const host=new URL(app.url).host;const page=await send(app.url,'GET',{host});const token=/"csrf":"([a-f0-9]+)"/.exec(page.body)?.[1];
  const call=async(method,url,body)=>{const r=await send(app.url+url,method,{host,origin:app.url,'content-type':'application/json','x-plantool-csrf':token},body===undefined?'':JSON.stringify(body));return {status:r.status,json:JSON.parse(r.body)};};
  const task=await call('GET','/api/blueprints/task');assert.equal(task.status,200);assert.equal(task.json.expects[0].field,'description');
  const added=await call('POST','/api/blueprints/task/expect',{field:'screenshots',label:'Screenshots',type:'list'});assert.equal(added.status,200,JSON.stringify(added.json));assert.equal(added.json.created,true);
  const saved=await call('PUT','/api/blueprints/task',{expects:[{field:'description',hint:'Say it plainly'},{field:'screenshots',optional:true}],template:'## Context'});
  assert.equal(saved.status,200,JSON.stringify(saved.json));assert.deepEqual(saved.json.expects.map(e=>e.field),['description','screenshots']);assert.equal(saved.json.source,'project');
  const made=await call('POST','/api/tickets',{title:'From the browser'});assert.equal(made.json.description,'## Context');
  const fields=await call('GET','/api/tickets/'+made.json.id+'/blueprint');assert.deepEqual(fields.json.missing,['description']);assert.ok(fields.json.editable.some(f=>f.field==='screenshots'&&f.custom));
  const note=await call('POST','/api/tickets/'+made.json.id+'/comments',{body:'Looks right',author:'person'});assert.equal(note.status,201);assert.equal(note.json.author,'person');
  assert.equal((await call('POST','/api/tickets/'+made.json.id+'/comments',{body:'  '})).status,400);
  assert.equal((await call('PUT','/api/blueprints/task',{expects:[{field:'nope'}]})).status,400);
  const reset=await call('DELETE','/api/blueprints/task');assert.equal(reset.json.reset,true);assert.equal(reset.json.blueprint.source,'built-in');
});

