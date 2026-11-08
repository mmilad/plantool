import http from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { openProject, findProject, ValidationError, NotFoundError } from './index.js';
import { listProjects, registerProject, addProjectPath, removeProject, entryId } from './registry.js';
import { renderAppHtml } from './ui.js';

export async function serve({ cwd = process.cwd(), port = 4000, open = false, register = false } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new ValidationError('Port must be an integer between 0 and 65535 (0 picks a free port)');
  }
  // Projects come from the machine-local registry; the project of the start directory (if any) is the default.
  const startRoot = await findProject(cwd);
  const contexts = new Map();
  let defaultId = null;
  if (startRoot) { const p = await openProject({ cwd: startRoot, cache: true }); defaultId = entryId(p.root); contexts.set(defaultId, makeContext(p)); if (register) await registerProject(p).catch(() => {}); }
  async function projectEntries() {
    const list = await listProjects();
    if (startRoot && !list.some(x => x.id === defaultId)) { const p = contexts.get(defaultId).project; list.push({ id: defaultId, root: p.root, projectId: p.config.projectId, name: p.config.name, key: p.key, available: true, unregistered: true }); }
    return list.sort((a, b) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root));
  }
  async function contextFor(id) {
    if (contexts.has(id)) return contexts.get(id);
    const entry = (await listProjects()).find(x => x.id === id);
    if (!entry) throw new NotFoundError(`Unknown project: ${id}`);
    if (!entry.available) throw new NotFoundError(`Project is not available at ${entry.root}: ${entry.problem ?? 'missing .pman/'}`);
    const ctx = makeContext(await openProject({ cwd: entry.root, cache: true })); contexts.set(id, ctx); return ctx;
  }
  const token = randomBytes(32).toString('hex');
  let boundPort;
  const server = http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      if (!host || ![`127.0.0.1:${boundPort}`, `localhost:${boundPort}`].includes(host)) return send(res, 403, { error: 'Invalid Host' });
      const url = new URL(req.url, `http://${host}`);
      if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
        const origin=req.headers.origin;
        if (!origin || origin !== `http://${host}` || !safeToken(req.headers['x-pman-csrf'], token)) return send(res,403,{error:'Origin or CSRF validation failed'});
      }
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"}); return res.end(renderAppHtml(token, { defaultProjectId: defaultId })); }
      if (req.method === 'OPTIONS') return send(res,405,{error:'CORS disabled'});
      const pathname0=url.pathname;
      if (pathname0==='/api/projects'&&req.method==='GET'){const list=await projectEntries();const rows=await Promise.all(list.map(async e=>{if(!e.available)return e;try{const c=await contextFor(e.id);const tickets=await c.project.tickets.list({limit:Infinity});const open=tickets.filter(x=>x.status!=='done'&&x.status!=='cancelled').length;const updated=tickets.reduce((m,x)=>x.updatedAt>m?x.updatedAt:m,'');return {...e,tickets:tickets.length,open,inProgress:tickets.filter(x=>x.status==='in_progress').length,updatedAt:updated||null,statuses:c.project.config.statuses};}catch(error){return {...e,available:false,problem:error.message};}}));return send(res,200,{projects:rows,defaultProjectId:defaultId});}
      if (pathname0==='/api/projects'&&req.method==='POST'){const input=await body(req);if(typeof input.path!=='string'||!input.path.trim())throw new ValidationError('A project path is required');const e=await addProjectPath(input.path.trim());return send(res,201,e);}
      let pm=/^\/api\/projects\/([0-9a-f]{12})$/.exec(pathname0);
      if(pm&&req.method==='DELETE'){contexts.delete(pm[1]);return send(res,200,await removeProject(pm[1]));}
      pm=/^\/api\/projects\/([0-9a-f]{12})(\/.*)$/.exec(pathname0);
      let ctx,pathname;
      if(pm){ctx=await contextFor(pm[1]);pathname='/api'+pm[2];}
      else if(pathname0.startsWith('/api/')){if(!defaultId)return send(res,404,{error:'No default project; use /api/projects/:id/...',code:'NOT_FOUND'});ctx=contexts.get(defaultId);pathname=pathname0;}
      else return send(res,404,{error:'Not found'});
      const project=ctx.project;

      if (req.method==='GET'&&pathname==='/api/version')return send(res,200,await ctx.version());
      if (req.method==='GET'&&pathname==='/api/tree'){const offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',5000,1,5000);const {items,total}=await project.tree(null,{limit,offset,fields:'row',withTotal:true});return send(res,200,{items,total,offset,limit});}
      if (req.method==='GET'&&pathname==='/api/search'){const types=(url.searchParams.get('types')||'').split(',').map(x=>x.trim()).filter(Boolean);return send(res,200,await project.searchPage(url.searchParams.get('q'),{offset:intParam(url,'offset',0,0),limit:intParam(url,'limit',20,1,100),types,snapshot:url.searchParams.get('snapshot')||undefined}));}
      let m=/^\/api\/tickets\/([A-Za-z0-9-]+)$/.exec(pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.get(m[1]));
      m=/^\/api\/tickets\/([A-Za-z0-9-]+)\/versioned$/.exec(pathname);
      if(m&&req.method==='GET')return send(res,200,await project.tickets.getVersioned(m[1]));
      m=/^\/api\/tickets\/([A-Za-z0-9-]+)$/.exec(pathname);
      if(m&&req.method==='PATCH'){const input=await body(req);const {expectedRevision,...patch}=input;return send(res,200,await project.tickets.update(m[1],patch,{expectedRevision}));}
      if(pathname==='/api/tickets'&&req.method==='POST')return send(res,201,await project.tickets.create(await body(req)));
      m=/^\/api\/tickets\/([A-Za-z0-9-]+)\/comments$/.exec(pathname);
      if(m&&req.method==='GET'){await project.tickets.get(m[1]);const all=await project.comments.list(m[1]),limit=intParam(url,'limit',20,1,200),around=url.searchParams.get('around');let offset;let found=null;if(around){const i=all.findIndex(c=>c.id===around);found=i>=0;offset=i>=0?Math.max(0,Math.min(i-Math.floor(limit/2),all.length-limit)):Math.max(0,all.length-limit);}else offset=url.searchParams.has('offset')?intParam(url,'offset',0,0):Math.max(0,all.length-limit);return send(res,200,{items:all.slice(offset,offset+limit),total:all.length,offset,limit,...(around?{found}:{})});}
      if(m&&req.method==='POST')return send(res,201,await project.comments.add(m[1],await body(req)));
      if(pathname==='/api/documents'&&req.method==='GET'){const kind=url.searchParams.get('kind'),offset=intParam(url,'offset',0,0),limit=intParam(url,'limit',200,1,1000);const all=await project.documents.list(kind,{body:false});return send(res,200,{items:all.slice(offset,offset+limit),total:all.length,offset,limit});}
      m=/^\/api\/documents\/([a-z]+)\/([A-Za-z0-9-]+)$/.exec(pathname);
      if(m&&req.method==='GET'){const r=await project.documents.getVersioned(m[1],m[2]);return send(res,200,{...r.document,revision:r.revision});}
      if(m&&req.method==='PATCH'){const {expectedRevision,...patch}=await body(req);if(!expectedRevision)throw new ValidationError('expectedRevision is required');const r=await project.documents.update(m[1],m[2],patch,{expectedRevision});return send(res,200,{...r.document,revision:r.revision,changed:r.changed});}
      m=/^\/api\/documents\/([a-z]+)$/.exec(pathname);
      if(m&&req.method==='POST'){const input=await body(req);const d=await project.documents.create(m[1],{title:input.title,body:input.body,status:input.status,links:input.links});const r=await project.documents.getVersioned(m[1],d.id);return send(res,201,{...r.document,kind:m[1],revision:r.revision});}
      m=/^\/api\/tickets\/([A-Za-z0-9-]+)\/relations$/.exec(pathname);
      if(m&&req.method==='GET'){await project.tickets.get(m[1]);const rels=await project.relations.list(m[1]);const tickets=new Map((await project.tickets.list({limit:Infinity})).map(x=>[x.id,x]));return send(res,200,rels.map(r=>{const outgoing=r.sourceId===m[1],other=tickets.get(outgoing?r.targetId:r.sourceId);return {id:r.id,type:r.type,direction:outgoing?'outgoing':'incoming',ticket:other?{id:other.id,title:other.title,status:other.status}:{id:outgoing?r.targetId:r.sourceId,missing:true}};}));}
      m=/^\/api\/tickets\/([A-Za-z0-9-]+)\/plan$/.exec(pathname);
      if(m&&req.method==='GET'){const ctx=await project.context(m[1],{budget:1e9});const check=await project.check();const mine=x=>x.ticketId===m[1]||(x.tickets??[]).includes(m[1])||(x.consumers??[]).includes(m[1]);return send(res,200,{readiness:ctx.readiness,codePlan:ctx.codePlan,errors:check.errors.filter(mine),warnings:check.warnings.filter(mine)});}
      if(pathname==='/api/design'&&req.method==='GET'){const [components,types,contracts,check]=await Promise.all([project.components.list(),project.types.list(),project.contracts.list(),project.check()]);const {qualifiedNames}=await import('./design.js');const names=qualifiedNames(components);const tickets=await project.tickets.list({limit:Infinity});const usage=new Map();for(const t of tickets)for(const [key,list] of Object.entries(t.codePlan??{}))for(const e of list??[]){if(!usage.has(e.component))usage.set(e.component,[]);usage.get(e.component).push({ticketId:t.id,title:t.title,status:t.status,relation:key,requires:e.requires});}
        return send(res,200,{components:components.map(c=>({...c,qualifiedName:names.get(c.id),contract:contracts.find(k=>k.componentId===c.id)?{version:contracts.find(k=>k.componentId===c.id).version,input:contracts.find(k=>k.componentId===c.id).input,output:contracts.find(k=>k.componentId===c.id).output}:null,tickets:usage.get(c.id)??[]})).sort((a,b)=>a.qualifiedName.localeCompare(b.qualifiedName)),types:types.map(x=>({name:x.name,version:x.version??1,schema:x.schema,description:x.description})),check});}
      m=/^\/api\/context\/([A-Za-z0-9-]+)$/.exec(pathname);if(m&&req.method==='GET')return send(res,200,await project.context(m[1]));
      if(pathname==='/api/validate'&&req.method==='GET')return send(res,200,await project.validate());
      return send(res,404,{error:'Not found'});
    } catch(e) { return send(res,e.code==='NOT_FOUND'?404:e.code==='VALIDATION'?400:e.code==='CONFLICT'?409:e.code==='CYCLE'||e.code==='OPEN_WORK'||e.code==='STALE_SEARCH'?409:500,{error:[...contexts.values()].reduce((msg,c)=>msg.split(c.project.root+path.sep).join('').split(c.project.root).join('.'),String(e.message)),code:e.code??'ERROR'}); }
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
  return { server, url, project: defaultId ? contexts.get(defaultId).project : null, defaultProjectId: defaultId };
}
/** Per-project state: the opened project and its cheap change fingerprint (size+mtime, cached 2 s). */
function makeContext(project){let cached=null;return {project,async version(){
  if(cached&&Date.now()-cached.at<2000)return cached.value;
  const groups={tree:['tickets','relationships','components','types','contracts'],documents:['goals','plans','decisions'],comments:['comments']},parts={};
  for(const [name,folders] of Object.entries(groups)){const h=createHash('sha256');for(const folder of folders)await fingerprint(path.join(project.dir,folder),h);parts[name]=h.digest('hex').slice(0,16);}
  const config=await fs.stat(path.join(project.dir,'config.json')).catch(()=>null);parts.config=config?`${config.size}:${config.mtimeMs}`:'missing';
  const value={version:createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0,16),parts};cached={at:Date.now(),value};return value;}};}
function intParam(url,name,fallback,min,max=Number.MAX_SAFE_INTEGER){const raw=url.searchParams.get(name);if(raw===null)return fallback;const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);return n;}
async function fingerprint(dir,h){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{h.update(`${dir}:missing\n`);return;}entries.sort((a,b)=>a.name.localeCompare(b.name));for(const e of entries){const full=path.join(dir,e.name);if(e.isDirectory()){await fingerprint(full,h);continue;}if(e.name.endsWith('.tmp'))continue;const st=await fs.stat(full).catch(()=>null);if(st)h.update(`${e.name}:${st.size}:${st.mtimeMs}\n`);}}
function safeToken(a,b){if(typeof a!=='string'||a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a),Buffer.from(b));}
async function body(req){let data='';for await(const c of req){data+=c;if(data.length>1_000_000)throw new ValidationError('Request body is too large');}try{return JSON.parse(data||'{}')}catch{throw new ValidationError('Request body must be JSON');}}
function send(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff','cache-control':'no-store'});res.end(JSON.stringify(value));}
function openBrowser(url){
  const [file,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
  const child=spawn(file,args,{detached:true,stdio:'ignore',windowsHide:true});child.on('error',()=>{});child.unref();
}
