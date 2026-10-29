import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_STATUSES = Object.freeze(['todo', 'in_progress', 'done', 'cancelled']);
export const RELATION_TYPES = Object.freeze(['blocks', 'relates_to', 'duplicates', 'implements', 'validates', 'supersedes']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds = ['goals', 'plans', 'decisions'];

export class PmanError extends Error { constructor(message, code = 'PMAN_ERROR', details = {}) { super(message); this.name = this.constructor.name; this.code = code; this.details = details; } }
export class NotFoundError extends PmanError { constructor(message, details) { super(message, 'NOT_FOUND', details); } }
export class ValidationError extends PmanError { constructor(message, details) { super(message, 'VALIDATION', details); } }
export class CycleError extends PmanError { constructor(message, details) { super(message, 'CYCLE', details); } }
export class ConflictError extends PmanError { constructor(message, details) { super(message, 'CONFLICT', details); } }
export class UnsupportedSchemaVersionError extends PmanError { constructor(message, details) { super(message, 'UNSUPPORTED_SCHEMA_VERSION', details); } }
export class StorageError extends PmanError { constructor(message, details) { super(message, 'STORAGE', details); } }

export function uuidv7(now = Date.now()) {
  const b = randomBytes(16); let ms = BigInt(now);
  for (let i = 5; i >= 0; i--) { b[i] = Number(ms & 255n); ms >>= 8n; }
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
const nowIso = () => new Date().toISOString();
const idPath = (base, id, ext = '.json') => path.join(base, id.slice(0, 2), `${id}${ext}`);
const canonical = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = text => createHash('sha256').update(text).digest('hex');
const checkId = id => { if (!UUID_RE.test(id ?? '')) throw new ValidationError(`Invalid UUIDv7 id: ${id}`, { id }); };
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function assertSafePath(root, target) {
  const rel=path.relative(root,target);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw new ValidationError('Resolved storage path escapes .pman',{path:target});
  let cur=root;
  for(const part of rel.split(path.sep)){cur=path.join(cur,part);try{const st=await fs.lstat(cur);if(st.isSymbolicLink())throw new ValidationError(`Symbolic links are not allowed in canonical storage: ${cur}`);}catch(e){if(e.code==='ENOENT')break;throw e;}}
}

export async function findProject(cwd = process.cwd()) {
  let dir = path.resolve(cwd);
  for (;;) {
    const marker = path.join(dir, '.pman', 'config.json');
    if (await exists(marker)) return dir;
    const parent = path.dirname(dir); if (parent === dir) return null; dir = parent;
  }
}

export async function initProject({ cwd = process.cwd(), name = path.basename(path.resolve(cwd)) } = {}) {
  const root = path.resolve(cwd), dir = path.join(root, '.pman'), configPath = path.join(dir, 'config.json');
  if (await exists(configPath)) throw new ConflictError(`pman is already initialized at ${root}`);
  if(await exists(dir)){const st=await fs.lstat(dir);if(st.isSymbolicLink()||!st.isDirectory())throw new ValidationError('.pman must not be a symlink or non-directory');if((await fs.readdir(dir)).length)throw new ConflictError(`Refusing to initialize over existing data in ${dir}`);}
  await fs.mkdir(dir, { recursive: true });
  const config = { schemaVersion: 1, projectId: uuidv7(), name: String(name || 'Project'), statuses: [...DEFAULT_STATUSES], properties: {}, createdAt: nowIso() };
  await fs.writeFile(configPath, canonical(config), { flag: 'wx' });
  for (const d of ['tickets', 'comments', 'relationships', ...kinds]) await fs.mkdir(path.join(dir, d), { recursive: true });
  return config;
}

export async function openProject({ cwd = process.cwd() } = {}) {
  const root = await findProject(cwd); if (!root) throw new NotFoundError(`No .pman project found from ${path.resolve(cwd)}`);
  const dir = path.join(root, '.pman');
  const st = await fs.lstat(dir); if (!st.isDirectory() || st.isSymbolicLink()) throw new ValidationError('.pman must be a real directory');
  let config;
  try { await assertSafePath(dir,path.join(dir,'config.json')); config = JSON.parse(await fs.readFile(path.join(dir, 'config.json'), 'utf8')); }
  catch (e) { throw new ValidationError(`Cannot read .pman/config.json: ${e.message}`, { path: '.pman/config.json' }); }
  if (config.schemaVersion !== 1) throw new UnsupportedSchemaVersionError(`Unsupported project schema version: ${config.schemaVersion}`);
  try{checkId(config.projectId);}catch(e){throw new ValidationError(`Invalid projectId in .pman/config.json: ${e.message}`);}
  if (!Array.isArray(config.statuses) || !config.statuses.length || config.statuses.some(x=>typeof x!=='string'||!x.trim()) || new Set(config.statuses).size !== config.statuses.length) throw new ValidationError('Project statuses must be a non-empty list of unique strings');
  const p = { root, dir, config };
  p.tickets = ticketApi(p); p.documents = documentApi(p); p.comments = commentApi(p); p.relations = relationApi(p);
  p.validate = () => validateProject(p);
  p.search = query => searchProject(p, query);
  p.context = (id, options) => contextFor(p, id, options);
  p.tree = (id, options) => buildTree(p, id, options);
  return p;
}

async function readJson(file) {
  try {
    const text = await fs.readFile(file, 'utf8'); const value = JSON.parse(text);
    if (value.schemaVersion !== 1) throw new UnsupportedSchemaVersionError(`Unsupported record schema version in ${path.relative(process.cwd(), file)}`);
    return { value, revision: hash(text) };
  } catch (e) { if (e instanceof PmanError) throw e; if(e.code==='ENOENT')throw new NotFoundError(`Record not found: ${file}`,{path:file}); throw new ValidationError(`Invalid JSON at ${file}: ${e.message}`, { path: file }); }
}
async function writeJson(p, folder, record, { expectedRevision, create = false } = {}) {
  const file = idPath(path.join(p.dir, folder), record.id); await assertSafePath(p.dir,path.dirname(file)); await fs.mkdir(path.dirname(file), { recursive: true }); await assertSafePath(p.dir,file);
  if (create) {
    try { await fs.writeFile(file, canonical(record), { flag: 'wx' }); }
    catch (e) { if (e.code === 'EEXIST') throw new ConflictError(`Record already exists: ${record.id}`); throw new StorageError(e.message); }
    return record;
  }
  const current = await readJson(file);
  if (expectedRevision && expectedRevision !== current.revision) throw new ConflictError(`Record changed since it was read: ${record.id}`, { id: record.id });
  const temp = `${file}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  try { await fs.writeFile(temp, canonical(record), { flag: 'wx' }); await fs.rename(temp, file); }
  catch (e) { await fs.rm(temp, { force: true }).catch(() => {}); throw new StorageError(`Could not atomically write ${file}: ${e.message}`); }
  return record;
}
async function listJson(p, folder) {
  const base = path.join(p.dir, folder); await assertSafePath(p.dir,base); if (!await exists(base)) return [];
  const files = [];
  for (const shard of (await fs.readdir(base, { withFileTypes: true })).filter(x => x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
    const shardPath=path.join(base,shard.name);await assertSafePath(p.dir,shardPath);
    for (const entry of (await fs.readdir(shardPath,{withFileTypes:true})).filter(x => x.name.endsWith('.json')).sort((a,b)=>a.name.localeCompare(b.name))) {
      const item=entry.name,file=path.join(shardPath,item);if(entry.isSymbolicLink()||!entry.isFile())throw new ValidationError(`Canonical record is not a regular file: ${file}`);
      files.push(file);
    }
  }
  const out=[];for(let i=0;i<files.length;i+=128){const batch=await Promise.all(files.slice(i,i+128).map(readJson));for(let j=0;j<batch.length;j++){const value=batch[j].value,expected=path.basename(files[i+j],'.json');if(value.id!==expected)throw new ValidationError(`Record id does not match filename: ${files[i+j]}`,{expected,actual:value.id});out.push(value);}}
  return out;
}
function validateTicketInput(input, statuses) {
  if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new ValidationError('Ticket title is required');
  if (input.status && !statuses.includes(input.status)) throw new ValidationError(`Unknown status: ${input.status}`);
  if (input.parentId != null) checkId(input.parentId);
  if(input.description!==undefined&&typeof input.description!=='string')throw new ValidationError('Ticket description must be text');
  if(input.priority!==undefined&&!['low','normal','high','urgent'].includes(input.priority))throw new ValidationError(`Invalid priority: ${input.priority}`);
  if(input.labels!==undefined&&(!Array.isArray(input.labels)||input.labels.some(x=>typeof x!=='string')))throw new ValidationError('Ticket labels must be an array of strings');
  if(input.properties!==undefined&&(!input.properties||typeof input.properties!=='object'||Array.isArray(input.properties)))throw new ValidationError('Ticket properties must be an object');
}

function ticketApi(p) {
  const statuses = p.config.statuses;
  return {
    async create(input) {
      validateTicketInput(input, statuses);
      if (input.parentId) await readJson(idPath(path.join(p.dir, 'tickets'), input.parentId));
      const date = nowIso(); const rec = { schemaVersion: 1, id: uuidv7(), title: input.title.trim(), description: input.description ?? '', status: input.status ?? statuses[0], priority: input.priority ?? 'normal', labels: input.labels ?? [], properties: input.properties ?? {}, parentId: input.parentId ?? null, createdAt: date, updatedAt: date };
      return writeJson(p, 'tickets', rec, { create: true });
    },
    async get(id) { return (await this.getVersioned(id)).ticket; },
    async getVersioned(id) { checkId(id); const file=idPath(path.join(p.dir,'tickets'),id);await assertSafePath(p.dir,file);const r = await readJson(file); return {ticket:r.value,revision:r.revision}; },
    async list({ status, parentId, limit = 5000 } = {}) { const a = await listJson(p, 'tickets'); return a.filter(x => (!status || x.status === status) && (parentId === undefined || x.parentId === parentId)).sort(sortRecords).slice(0, limit); },
    async update(id, patch, {expectedRevision} = {}) {
      checkId(id); const file = idPath(path.join(p.dir, 'tickets'), id); await assertSafePath(p.dir,file); const current = await readJson(file), rec = current.value;
      if(expectedRevision&&expectedRevision!==current.revision)throw new ConflictError(`Record changed since it was read: ${id}`,{id});
      const next = { ...rec, ...patch, id, schemaVersion: 1, createdAt: rec.createdAt, updatedAt: nowIso() };
      validateTicketInput(next, statuses); if (next.parentId === id) throw new CycleError('A ticket cannot be its own parent');
      if (next.parentId) await ensureCanParent(p, id, next.parentId);
      return writeJson(p, 'tickets', next, { expectedRevision: current.revision });
    },
    async move(id, parentId) { return this.update(id, { parentId: parentId ?? null }); },
    async rollup(id) { const rows = await buildTree(p,id); return rows[0].rollup; },
    async readiness(id) { checkId(id);const all=await listJson(p,'tickets'),byId=new Map(all.map(t=>[t.id,t])),rels=await listJson(p,'relationships');const incoming=rels.filter(r=>r.type==='blocks'&&r.targetId===id);return {ready:incoming.every(r=>byId.get(r.sourceId)?.status==='done'),blockers:incoming.map(r=>({relationshipId:r.id,ticket:byId.get(r.sourceId)??null}))}; }
  };
}
function sortRecords(a,b) { return String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id); }
function descendants(all, id) { const map = childIndex(all), out = [], stack = [...(map.get(id) ?? [])].reverse(); while(stack.length) { const cur=stack.pop(); out.push(cur); const c=map.get(cur.id)??[]; for(let i=c.length-1;i>=0;i--) stack.push(c[i]); } return out; }
function childIndex(all) { const m=new Map(); for(const t of all) { if(!m.has(t.parentId)) m.set(t.parentId,[]); m.get(t.parentId).push(t); } for(const v of m.values()) v.sort(sortRecords); return m; }
function derivedStatus(ticket, descendantsList, relations) {
  const blockers=relations.some(r=>r.type==='blocks' && r.targetId===ticket.id); if(blockers) return 'blocked';
  if (!descendantsList.length) return ticket.status;
  const active=descendantsList.some(x=>x.status==='in_progress');
  const remaining=descendantsList.some(x=>x.status!=='done' && x.status!=='cancelled');
  return !remaining ? 'done' : active ? 'in_progress' : ticket.status;
}
async function ensureCanParent(p, id, parentId) {
  const all=await listJson(p,'tickets'), map=new Map(all.map(x=>[x.id,x]));
  if(!map.has(parentId)) throw new NotFoundError(`Parent ticket not found: ${parentId}`);
  let cur=parentId; const seen=new Set();
  while(cur) { if(cur===id) throw new CycleError('Move would create a parent cycle',{id,parentId}); if(seen.has(cur)) throw new CycleError('Existing parent cycle detected',{id:cur}); seen.add(cur); cur=map.get(cur)?.parentId??null; }
}
export async function buildTree(p, id = null, { maxDepth = Infinity, limit = 5000, offset = 0 } = {}) {
  const all=await listJson(p,'tickets'), idx=childIndex(all), roots=id?[await p.tickets.get(id)]:idx.get(null)??[];
  const ordered=[], stack=[];
  for(let i=roots.length-1;i>=0;i--) stack.push({ticket:roots[i],depth:0});
  while(stack.length) { const item=stack.pop(); ordered.push(item); const cs=idx.get(item.ticket.id)??[]; for(let i=cs.length-1;i>=0;i--) stack.push({ticket:cs[i],depth:item.depth+1}); }
  const rel=await listJson(p,'relationships'), stats=new Map(), rollups=new Map();
  for(let i=ordered.length-1;i>=0;i--) {
    const {ticket}=ordered[i], cs=idx.get(ticket.id)??[];
    const childStats=cs.map(c=>stats.get(c.id)).filter(Boolean);
    const blocked=rel.some(r=>r.type==='blocks'&&r.targetId===ticket.id);
    const rollup=blocked?'blocked':cs.length>0&&!childStats.some(x=>x.remaining)?'done':childStats.some(x=>x.active)?'in_progress':ticket.status;
    rollups.set(ticket.id,rollup);
    stats.set(ticket.id,{active:ticket.status==='in_progress'||childStats.some(x=>x.active),remaining:(ticket.status!=='done'&&ticket.status!=='cancelled')||childStats.some(x=>x.remaining)});
  }
  const visible=ordered.filter(x=>x.depth<=maxDepth);return visible.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,limit)).map(({ticket,depth})=>({...ticket,depth,rollup:rollups.get(ticket.id)}));
}

function parseDoc(text, file) {
  const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text); if(!m) throw new ValidationError(`Invalid Markdown metadata at ${file}`);
  const meta={}; for(const line of m[1].split('\n')) { const i=line.indexOf(':'); if(i<0) continue; const k=line.slice(0,i),v=line.slice(i+1).trim(); try { meta[k]=JSON.parse(v); } catch { meta[k]=v; } }
  if(meta.schemaVersion!==1) throw new UnsupportedSchemaVersionError(`Unsupported document schema version at ${file}`);
  return { ...meta, body:m[2] };
}
const docText = x => `---\nschemaVersion: 1\nid: ${JSON.stringify(x.id)}\ntitle: ${JSON.stringify(x.title)}\nstatus: ${JSON.stringify(x.status)}\nlinks: ${JSON.stringify(x.links ?? [])}\ncreatedAt: ${JSON.stringify(x.createdAt)}\nupdatedAt: ${JSON.stringify(x.updatedAt)}\n---\n${x.body ?? ''}\n`;
function documentApi(p) {
  return { async create(kind,input) {
    if(!kinds.includes(kind)) throw new ValidationError(`Unknown document type: ${kind}`);
    if(!input.title?.trim()) throw new ValidationError('Document title is required');
    const id=uuidv7(), date=nowIso(), links=input.links??[];if(!Array.isArray(links))throw new ValidationError('Document links must be an array of entity IDs');for(const x of links)checkId(x);const value={schemaVersion:1,id,title:input.title.trim(),status:input.status??'todo',links,createdAt:date,updatedAt:date,body:input.body??''};
    const file=idPath(path.join(p.dir,kind),id,'.md'); await assertSafePath(p.dir,path.dirname(file));await fs.mkdir(path.dirname(file),{recursive:true});await assertSafePath(p.dir,file);await fs.writeFile(file,docText(value),{flag:'wx'}); return value;
  }, async list(kind) {
    if(!kinds.includes(kind)) throw new ValidationError(`Unknown document type: ${kind}`);
    const base=path.join(p.dir,kind), out=[];await assertSafePath(p.dir,base); if(!await exists(base)) return out;
    for(const sh of (await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {const shard=path.join(base,sh.name);await assertSafePath(p.dir,shard);for(const f of (await fs.readdir(shard)).filter(x=>x.endsWith('.md')).sort()){const file=path.join(shard,f);await assertSafePath(p.dir,file);const st=await fs.lstat(file);if(!st.isFile())throw new ValidationError(`Planning document is not a regular file: ${file}`);out.push(parseDoc(await fs.readFile(file,'utf8'),f));}}
    return out.sort(sortRecords);
  }, async get(kind,id) { checkId(id); if(!kinds.includes(kind))throw new ValidationError(`Unknown document type: ${kind}`);const f=idPath(path.join(p.dir,kind),id,'.md');await assertSafePath(p.dir,f);try{return parseDoc(await fs.readFile(f,'utf8'),f);}catch(e){if(e.code==='ENOENT')throw new NotFoundError(`Document not found: ${id}`);throw e;} } };
}
function commentApi(p) { return {
  async add(ticketId,input) { checkId(ticketId); await p.tickets.get(ticketId); if(!input.body?.trim()) throw new ValidationError('Comment body is required'); const rec={schemaVersion:1,id:uuidv7(),ticketId,body:input.body,author:input.author??'local',createdAt:nowIso()}; return writeJson(p,'comments',rec,{create:true}); },
  async list(ticketId) { const a=await listJson(p,'comments'); return a.filter(x=>!ticketId||x.ticketId===ticketId).sort(sortRecords); }
}; }
function relationApi(p) { return {
  async add(sourceId,targetId,type) { checkId(sourceId);checkId(targetId);if(sourceId===targetId)throw new ValidationError('Relationship endpoints must differ');if(!RELATION_TYPES.includes(type))throw new ValidationError(`Unknown relationship type: ${type}`);const tickets=await listJson(p,'tickets');if(!tickets.some(x=>x.id===sourceId)||!tickets.some(x=>x.id===targetId))throw new NotFoundError('Relationship endpoint not found');const records=await listJson(p,'relationships');if(type==='blocks'&&wouldBlockCycle(records,sourceId,targetId))throw new CycleError('Blocking relationship would create a dependency cycle');const r={schemaVersion:1,id:uuidv7(),sourceId,targetId,type,createdAt:nowIso()};return writeJson(p,'relationships',r,{create:true}); },
  async list(id) { const a=await listJson(p,'relationships'); return a.filter(x=>!id||x.sourceId===id||x.targetId===id).sort(sortRecords); },
  async remove(id) { checkId(id);const f=idPath(path.join(p.dir,'relationships'),id);await assertSafePath(p.dir,f);try{await fs.rm(f);}catch(e){if(e.code==='ENOENT')throw new NotFoundError(`Relationship not found: ${id}`);throw e;} }
}; }
function wouldBlockCycle(rs,source,target){const adj=new Map();for(const r of rs.filter(x=>x.type==='blocks')){if(!adj.has(r.sourceId))adj.set(r.sourceId,[]);adj.get(r.sourceId).push(r.targetId);}const stack=[target],seen=new Set();while(stack.length){const n=stack.pop();if(n===source)return true;if(seen.has(n))continue;seen.add(n);stack.push(...(adj.get(n)??[]));}return false;}
function blockingCycleNodes(relations){
  const adj=new Map();for(const r of relations.filter(x=>x.type==='blocks')){if(!adj.has(r.sourceId))adj.set(r.sourceId,[]);adj.get(r.sourceId).push(r.targetId);}
  const color=new Map(),cyclic=new Set();
  for(const start of adj.keys()){
    if(color.get(start))continue;const stack=[{id:start,index:0}];color.set(start,1);
    while(stack.length){const frame=stack.at(-1),edges=adj.get(frame.id)??[];if(frame.index>=edges.length){color.set(frame.id,2);stack.pop();continue;}
      const next=edges[frame.index++],state=color.get(next)??0;if(state===1){cyclic.add(frame.id);cyclic.add(next);}else if(state===0){color.set(next,1);stack.push({id:next,index:0});}
    }
  }
  return cyclic;
}

export async function validateProject(p) {
  const errors=[], tickets=await listJson(p,'tickets'), ids=new Set(), ticketMap=new Map(tickets.map(t=>[t.id,t]));
  for(const t of tickets){if(ids.has(t.id))errors.push(`Duplicate ticket id ${t.id}`);ids.add(t.id);try{checkId(t.id);validateTicketInput(t,p.config.statuses);}catch(e){errors.push(e.message);}if(t.parentId&&!ticketMap.has(t.parentId))errors.push(`Missing parent ${t.parentId} for ${t.id}`);}
  const done=new Set(); for(const t of tickets){let n=t.id,pathSeen=new Set();while(n){if(pathSeen.has(n)){errors.push(`Parent cycle at ${n}`);break;}if(done.has(n))break;pathSeen.add(n);const cur=ticketMap.get(n);n=cur?.parentId??null;}for(const x of pathSeen)done.add(x);}
  const rs=await listJson(p,'relationships'),comments=await listJson(p,'comments'),docIds=new Set(),documents=[];for(const kind of kinds)try{for(const d of await p.documents.list(kind)){try{checkId(d.id);}catch(e){errors.push(e.message);}if(docIds.has(d.id))errors.push(`Duplicate document id ${d.id}`);docIds.add(d.id);documents.push(d);}}catch(e){errors.push(e.message);}
  const unique=new Set(ids);for(const rec of [...comments,...rs]){try{checkId(rec.id);}catch(e){errors.push(e.message);}if(unique.has(rec.id))errors.push(`Duplicate entity id ${rec.id}`);unique.add(rec.id);}
  for(const id of docIds){if(unique.has(id))errors.push(`Duplicate entity id ${id}`);unique.add(id);}
  for(const c of comments)if(!ids.has(c.ticketId))errors.push(`Comment ${c.id} refers to missing ticket ${c.ticketId}`);
  for(const d of documents)for(const target of d.links??[])if(!ids.has(target)&&!docIds.has(target))errors.push(`Document ${d.id} links to missing entity ${target}`);
  for(const r of rs){if(!ids.has(r.sourceId)||!ids.has(r.targetId))errors.push(`Dangling relationship ${r.id}`);if(!RELATION_TYPES.includes(r.type))errors.push(`Invalid relationship type ${r.id}`);}
  const cycles=blockingCycleNodes(rs);if(cycles.size)errors.push(`Blocking dependency cycle involves ${[...cycles].sort().join(', ')}`);
  return { valid:errors.length===0, errors, counts:{tickets:tickets.length,documents:docIds.size,relationships:rs.length,comments:comments.length} };
}
export async function searchProject(p, query) {
  const q=String(query??'').toLocaleLowerCase(); if(!q) throw new ValidationError('Search query is required');const hits=[];
  for(const t of await listJson(p,'tickets')){const text=`${t.title}\n${t.description}`.toLocaleLowerCase();if(text.includes(q))hits.push({id:t.id,type:'ticket',title:t.title,path:path.relative(p.root,idPath(path.join(p.dir,'tickets'),t.id)).split(path.sep).join('/'),snippet:text.slice(Math.max(0,text.indexOf(q)-70),text.indexOf(q)+q.length+90)});}
  for(const c of await listJson(p,'comments')){const at=c.body.toLocaleLowerCase().indexOf(q);if(at>=0)hits.push({id:c.id,type:'comment',title:`Comment on ${c.ticketId}`,path:path.relative(p.root,idPath(path.join(p.dir,'comments'),c.id)).split(path.sep).join('/'),snippet:c.body.slice(Math.max(0,at-70),at+q.length+90)});}
  for(const kind of kinds)for(const d of await p.documents.list(kind)){if(`${d.title}\n${d.body}`.toLocaleLowerCase().includes(q))hits.push({id:d.id,type:kind,title:d.title,path:path.relative(p.root,idPath(path.join(p.dir,kind),d.id,'.md')).split(path.sep).join('/'),snippet:d.body.slice(0,160)});}
  return hits.sort((a,b)=>a.path.localeCompare(b.path)||a.id.localeCompare(b.id));
}
export async function contextFor(p,id,{budget=8000}={}) {
  checkId(id);if(!Number.isFinite(Number(budget))||Number(budget)<512)throw new ValidationError('Context budget must be at least 512 bytes');const max=Number(budget);const ticket=await p.tickets.get(id),all=await listJson(p,'tickets'),map=new Map(all.map(x=>[x.id,x])),ancestors=[];let cur=ticket.parentId;
  while(cur){const a=map.get(cur);if(!a)break;ancestors.unshift(a);cur=a.parentId;}
  const descendantsList=descendants(all,id),selectedDesc=descendantsList.slice(0,20);
  const rel=(await p.relations.list(id)).map(x=>({...x,path:path.relative(p.root,idPath(path.join(p.dir,'relationships'),x.id)).split(path.sep).join('/')}));
  const comments=(await p.comments.list(id)).map(x=>({...x,path:path.relative(p.root,idPath(path.join(p.dir,'comments'),x.id)).split(path.sep).join('/')}));
  const docs=[];for(const kind of kinds)for(const d of await p.documents.list(kind))if((d.links??[]).includes(id)||d.body.includes(id)||d.title.toLowerCase().includes(ticket.title.toLowerCase()))docs.push({id:d.id,type:kind,title:d.title,path:path.relative(p.root,idPath(path.join(p.dir,kind),d.id,'.md')).split(path.sep).join('/')});
  const brief=x=>({id:x.id,title:x.title,status:x.status,priority:x.priority,parentId:x.parentId,description:x.description??''});
  const ticketPath=path.relative(p.root,idPath(path.join(p.dir,'tickets'),id)).split(path.sep).join('/');
  const packet={ticket:brief(ticket),ancestors:ancestors.map(brief),descendants:selectedDesc.map(brief),relationships:rel,comments,documents:docs,sources:{ticket:ticketPath,ancestors:ancestors.map(x=>path.relative(p.root,idPath(path.join(p.dir,'tickets'),x.id)).split(path.sep).join('/'))}},omitted={comments:0,relationships:0,documents:0,ancestors:0,descendants:Math.max(0,descendantsList.length-selectedDesc.length),descriptionBytes:0};
  const size=()=>Buffer.byteLength(JSON.stringify({...packet,omitted},null,2));
  for(const key of ['comments','relationships','documents','descendants'])while(size()>max&&packet[key].length){packet[key].pop();omitted[key]++;}
  while(size()>max&&packet.ancestors.length){packet.ancestors.pop();packet.sources.ancestors.pop();omitted.ancestors++;}
  if(size()>max&&packet.ticket.description){const original=packet.ticket.description;let low=0,high=original.length;while(low<high){const mid=Math.ceil((low+high)/2);packet.ticket.description=original.slice(0,mid)+'…';if(size()<=max)low=mid;else high=mid-1;}packet.ticket.description=original.slice(0,low)+'…';omitted.descriptionBytes=Buffer.byteLength(original.slice(low));}
  if(size()>max&&packet.ticket.title){const original=packet.ticket.title;packet.ticket.title=original.slice(0,64)+'…';}
  if(size()>max)packet.ticket.properties={};
  return packet;
}
