import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { request } from 'node:http';
import { initProject } from '../src/index.js';
import { serve } from '../src/server.js';

function send(url,method,headers={},body='') { return new Promise((resolve,reject)=>{const u=new URL(url);const req=request({hostname:u.hostname,port:u.port,path:u.pathname,method,headers},res=>{let d='';res.setEncoding('utf8');res.on('data',x=>d+=x);res.on('end',()=>resolve({status:res.statusCode,body:d,headers:res.headers}));});req.on('error',reject);req.end(body);}); }

test('serve is loopback-only and protects writes with Host, Origin and CSRF checks',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'pman-ui-'));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));await initProject({cwd});
  const app=await serve({cwd});t.after(()=>new Promise(r=>app.server.close(r)));
  const page=await send(app.url,'GET',{host:new URL(app.url).host});assert.equal(page.status,200);
  const token=/const csrf="([a-f0-9]+)"/.exec(page.body)?.[1];assert.ok(token);
  const blocked=await send(app.url,'POST',{host:new URL(app.url).host,'content-type':'application/json'},'{}');assert.equal(blocked.status,403);
  const badHost=await send(app.url,'GET',{host:'evil.example'});assert.equal(badHost.status,403);
  const good=await send(app.url+'/api/tickets','POST',{host:new URL(app.url).host,origin:app.url,'content-type':'application/json','x-pman-csrf':token},JSON.stringify({title:'From browser'}));assert.equal(good.status,201,good.body);
});
