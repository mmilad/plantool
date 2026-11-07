import http from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openProject, ValidationError } from './index.js';
import { renderAppHtml } from './ui.js';

export async function serve({ cwd = process.cwd(), port = 4000, open = false } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ValidationError('Port must be an integer between 0 and 65535 (0 picks a free port)');
  }
  const project = await openProject({ cwd, cache: true });
  const token = randomBytes(32).toString('hex');
  let boundPort;
  // Cheap change detection: size and mtime of every canonical file, cached for 2 s.
  let cached=null;
  async function version(){
    if(cached&&Date.now()-cached.at<2000)return cached.value;
    const groups={tree:['tickets','relationships','components','types','contracts'],documents:['goals','plans','decisions'],comments:['comments']},parts={};
    for(const [name,folders] of Object.entries(groups)){const h=createHash('sha256');for(const folder of folders)await fingerprint(path.join(project.dir,folder),h);parts[name]=h.digest('hex').slice(0,16);}
    const config=await fs.stat(path.join(project.dir,'config.json')).catch(()=>null);parts.config=config?`${config.size}:${config.mtimeMs}`:'missing';
    const value={version:createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,16),parts};cached={at:Date.now(),value};return value;
  }
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!host || ![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(host)) return send(res, 403, { error: 'Invalid Host' });
      const url = new URL(req.url, `http://${host}`);
      if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
        const origin=req.headers.origin;
        if (!origin || origin !== `http://${host}` || !safeToken(req.headers['x-pman-csrf'], token)) return send(res,403,{error:'Origin or CSRF validation failed'});
      }
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"}); return res.end(renderAppHtml(token, project.config, { folder: path.basename(project.root) })); }
      if (req.method === 'OPTIONS') return send(res,405,{error:'CORS disabled'});
      if (req.method==='GET'&&url.pathname==='/api/version')return send(res,200,await version());
      if (req.method==='GET'&&url.pathname==='/api/tree'){const offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',5000,1,5000);const {items,total}=await project.tree(null,{limit,offset,fields:'row',withTotal:true});return send(res,200,{items,total,offset,limit});}
      if (req.method==='GET'&&url.pathname==='/api/search'){const types=(url.searchParams.get('types')||'').split(',').map(x=>x.trim()).filter(Boolean);return send(res,200,await project.searchPage(url.searchParams.get('q'),{offset:intParam(url,'offset',0,0),limit:intParam(url,'limit',20,1,100),types,snapshot:url.searchParams.get('snapshot')||undefined}));}
      let m=/^\/api\/tickets\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.get(m[1]));
      m=/^\/api\/tickets\/([0-9a-f-]+)\/versioned$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.getVersioned(m[1]));
      m=/^\/api\/tickets\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='PATCH'){const input=await body(req);const {expectedRevision,...patch}=input;return send(res,200,await project.tickets.update(m[1],patch,{expectedRevision}));}
      if(url.pathname==='/api/tickets'&&req.method==='POST')return send(res,201,await project.tickets.create(await body(req)));
      m=/^\/api\/tickets\/([0-9a-f-]+)\/comments$/.exec(url.pathname);
      if(m&&req.method==='GET')return send(res,200,await project.comments.list(m[1]));
      if(m&&req.method==='POST')return send(res,201,await project.comments.add(m[1],await body(req)));
      if(url.pathname==='/api/documents'&&req.method==='GET'){const kind=url.searchParams.get('kind'),offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',200,1,1000);const all=await project.documents.list(kind,{body:false});return send(res,200,{items:all.slice(offset,offset+limit),total:all.length,offset,limit});}
      m=/^\/api\/documents\/([a-z]+)\/([0-9a-f-]+)$/.exec(url.pathname);
      if(m&&req.method==='GET'){const r=await project.documents.getVersioned(m[1],m[2]);return send(res,200,{...r.document,revision:r.revision});}
      if(m&&req.method==='PATCH'){const {expectedRevision,...patch}=await body(req);if(!expectedRevision)throw new ValidationError('expectedRevision is required');const r=await project.documents.update(m[1],m[2],patch,{expectedRevision});return send(res,200,{...r.document,revision:r.revision,changed:r.changed});}
      m=/^\/api\/documents\/([a-z]+)$/.exec(url.pathname);
      if(m&&req.method==='POST'){const input=await body(req);const d=await project.documents.create(m[1],{title:input.title,body:input.body,status:input.status,links:input.links});const r=await project.documents.getVersioned(m[1],d.id);return send(res,201,{...r.document,kind:m[1],revision:r.revision});}
      m=/^\/api\/tickets\/([0-9a-f-]+)\/relations$/.exec(url.pathname);
      if(m&&req.method==='GET'){await project.tickets.get(m[1]);const rels=await project.relations.list(m[1]);const tickets=new Map((await project.tickets.list({limit:Infinity})).map(x=>[x.id,x]));return send(res,200,rels.map(r=>{const outgoing=r.sourceId===m[1],other=tickets.get(outgoing?r.targetId:r.sourceId);return {id:r.id,type:r.type,direction:outgoing?'outgoing':'incoming',ticket:other?{id:other.id,title:other.title,status:other.status}:{id:outgoing?r.targetId:r.sourceId,missing:true}};}));}
      m=/^\/api\/tickets\/([0-9a-f-]+)\/plan$/.exec(url.pathname);
      if(m&&req.method==='GET'){const ctx=await project.context(m[1],{budget:1e9});const check=await project.check();const mine=x=>x.ticketId===m[1]||(x.tickets??[]).includes(m[1])||(x.consumers??[]).includes(m[1]);return send(res,200,{readiness:ctx.readiness,codePlan:ctx.codePlan,errors:check.errors.filter(mine),warnings:check.warnings.filter(mine)});}
      if(url.pathname==='/api/design'&&req.method==='GET'){const [components,types,contracts,check]=await Promise.all([project.components.list(),project.types.list(),project.contracts.list(),project.check()]);const {qualifiedNames}=await import('./design.js');const names=qualifiedNames(components);const tickets=await project.tickets.list({limit:Infinity});const usage=new Map();for(const t of tickets)for(const [key,list] of Object.entries(t.codePlan??{}))for(const e of list??[]){if(!usage.has(e.component))usage.set(e.component,[]);usage.get(e.component).push({ticketId:t.id,title:t.title,status:t.status,relation:key,requires:e.requires});}
        return send(res,200,{components:components.map(c=>({...c,qualifiedName:names.get(c.id),contract:contracts.find(k=>k.componentId===c.id)?{version:contracts.find(k=>k.componentId===c.id).version,input:contracts.find(k=>k.componentId===c.id).input,output:contracts.find(k=>k.componentId===c.id).output}:null,tickets:usage.get(c.id)??[]})).sort((a,b)=>a.qualifiedName.localeCompare(b.qualifiedName)),types:types.map(x=>({name:x.name,version:x.version??1,schema:x.schema,description:x.description})),check});}
      m=/^\/api\/context\/([0-9a-f-]+)$/.exec(url.pathname);if(m&&req.method==='GET')return send(res,200,await project.context(m[1]));
      if(url.pathname==='/api/validate'&&req.method==='GET')return send(res,200,await project.validate());
      return send(res,404,{error:'Not found'});
    } catch(e) { return send(res,e.code==='NOT_FOUND'?404:e.code==='VALIDATION'?400:e.code==='CONFLICT'?409:e.code==='CYCLE'||e.code==='OPEN_WORK'||e.code==='STALE_SEARCH'?409:500,{error:String(e.message).split(project.root+path.sep).join('').split(project.root).join('.'),code:e.code??'ERROR'}); }
  });
  await new Promise((resolve,reject)=>{
    server.once('error',error=>{
      if(error.code==='EADDRINUSE'){
        const inUse=new Error(`Port ${port} is already in use at http://127.0.0.1:${port}; no additional pman server was started. Close the existing process or choose another explicit port with --port N.`);
        inUse.code='PORT_IN_USE';
        inUse.cause=error;
        reject(inUse);
        return;
      }
      reject(error);
    });
    server.listen({host:'127.0.0.1',port},resolve);
  });
  const address=server.address(), actualPort=address.port, url=`http://127.0.0.1:${actualPort}`; boundPort=actualPort;
  if(open) openBrowser(url);
  return { server, url, project };
}
function intParam(url,name,fallback,min,max=Number.MAX_SAFE_INTEGER){const raw=url.searchParams.get(name);if(raw===null)return fallback;const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);return n;}
async function fingerprint(dir,h){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{h.update(`${dir}:missing\n`);return;}entries.sort((a,b)=>a.name.localeCompare(b.name));for(const e of entries){const full=path.join(dir,e.name);if(e.isDirectory()){await fingerprint(full,h);continue;}if(e.name.endsWith('.tmp'))continue;const st=await fs.stat(full).catch(()=>null);if(st)h.update(`${e.name}:${st.size}:${st.mtimeMs}\n`);}}
function safeToken(a,b){if(typeof a!=='string'||a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>1_000_000)throw new ValidationError('Request body is too large');}try{return JSON.parse(data||'{}')}catch{throw new ValidationError('Request body must be JSON');}}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'});res.end(JSON.stringify(value));}
function openBrowser(url){
  const [file,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
