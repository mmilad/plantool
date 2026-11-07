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
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));
  const page=await send(app.url,'GET',{host:new URL(app.url).host});assert.equal(page.status,200);
  const token=/"csrf":"([a-f0-9]+)"/.exec(page.body)?.[1];assert.ok(token);
  const blocked=await send(app.url,'POST',{host:new URL(app.url).host,'content-type':'application/json'},'{}');assert.equal(blocked.status,403);
  const badHost=await send(app.url,'GET',{host:'evil.example'});assert.equal(badHost.status,403);
  const good=await send(app.url+'/api/tickets','POST',{host:new URL(app.url).host,origin:app.url,'content-type':'application/json','x-pman-csrf':token},JSON.stringify({title:'From browser'}));assert.equal(good.status,201,good.body);
});

test('document API lists metadata only and fetches one document by kind and id',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-docs-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
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
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-open-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});const parent=await p.tickets.create({title:'Header'});await p.tickets.create({title:'Subnav',parentId:parent.id});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host=new URL(app.url).host;
  const page=await send(app.url,'GET',{host});const token=/"csrf":"([a-f0-9]+)"/.exec(page.body)[1];
  const r=await send(`${app.url}/api/tickets/${parent.id}`,'PATCH',{host,origin:app.url,'x-pman-csrf':token,'content-type':'application/json'},JSON.stringify({status:'done'}));
  assert.equal(r.status,409);assert.equal(JSON.parse(r.body).code,'OPEN_WORK');
});

test('tree API returns lightweight paginated rows with child counts',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-tree-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});
  const root=await p.tickets.create({title:'Root',description:'y'.repeat(5000),properties:{big:'z'.repeat(5000)}});for(let i=0;i<3;i++)await p.tickets.create({title:`Child ${i}`,parentId:root.id});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const page=JSON.parse((await send(`${app.url}/api/tree?limit=2`,'GET',host)).body);
  assert.equal(page.total,4);assert.equal(page.items.length,2);assert.equal(page.items[0].childCount,3);assert.equal(page.items[1].depth,1);
  assert.equal('description' in page.items[0],false);assert.equal('properties' in page.items[0],false);
  assert.equal((await send(`${app.url}/api/tree?limit=9999`,'GET',host)).status,400);
});

test('search API pages results and rejects stale snapshots with 409',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-search-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const {openProject}=await import('../src/index.js');const p=await openProject({cwd});for(let i=0;i<25;i++)await p.tickets.create({title:`Task ${String(i).padStart(2,'0')}`});
  const app=await serve({cwd,port:0});t.after(()=>new Promise(r=>app.server.close(r)));const host={host:new URL(app.url).host};
  const a=JSON.parse((await send(`${app.url}/api/search?q=task`,'GET',host)).body);assert.equal(a.items.length,20);assert.equal(a.total,25);assert.equal(a.nextOffset,20);
  const b=JSON.parse((await send(`${app.url}/api/search?q=task&offset=20&snapshot=${a.snapshot}`,'GET',host)).body);assert.equal(b.items.length,5);assert.equal(b.nextOffset,null);
  await p.tickets.create({title:'Task new'});
  assert.equal((await send(`${app.url}/api/search?q=task&offset=20&snapshot=${a.snapshot}`,'GET',host)).status,409);
  assert.equal((await send(`${app.url}/api/search?q=task&limit=101`,'GET',host)).status,400);
});
