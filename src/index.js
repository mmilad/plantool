import { randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { TICKET_KINDS, workGraph, readinessOf, nextTickets, claimTicket, releaseTicket, finishTicket, withLock } from './workflow.js';
export { TICKET_KINDS } from './workflow.js';
import { attachDesignApi, validateCodePlanShape, resolvedCodePlan } from './design.js';
import { semanticStatus, updateIndex, semanticSearch, hybridSearch, similarTickets } from './semantic.js';
export { DEFAULT_COMPONENT_KINDS, normalizeSchema } from './design.js';

export const DEFAULT_STATUSES = Object.freeze(['todo', 'in_progress', 'done', 'cancelled']);
export const RELATION_TYPES = Object.freeze(['blocks', 'relates_to', 'duplicates', 'implements', 'validates', 'supersedes']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds = ['goals', 'plans', 'decisions'];
const designFolders = ['components', 'types', 'contracts'];

export class PmanError extends Error { constructor(message, code = 'PMAN_ERROR', details = {}) { super(message); this.name = this.constructor.name; this.code = code; this.details = details; } }
export class NotFoundError extends PmanError { constructor(message, details) { super(message, 'NOT_FOUND', details); } }
export class ValidationError extends PmanError { constructor(message, details) { super(message, 'VALIDATION', details); } }
export class CycleError extends PmanError { constructor(message, details) { super(message, 'CYCLE', details); } }
export class ConflictError extends PmanError { constructor(message, details) { super(message, 'CONFLICT', details); } }
export class UnsupportedSchemaVersionError extends PmanError { constructor(message, details) { super(message, 'UNSUPPORTED_SCHEMA_VERSION', details); } }
export class StorageError extends PmanError { constructor(message, details) { super(message, 'STORAGE', details); } }
export class OpenWorkError extends PmanError { constructor(message, details) { super(message, 'OPEN_WORK', details); } }

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
const KEY_RE = /^[A-Z][A-Z0-9]{1,9}$/;
/** Derives a Jira-like project key: initials of several words, otherwise the first letters of one word. */
export function deriveKey(name) {
  const words = String(name ?? '').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  let key = words.length > 1 ? words.map(w => w[0]).join('') : (words[0] ?? '').slice(0, 4);
  key = key.toUpperCase().replace(/^[0-9]+/, '');
  if (key.length < 2) key = (key + 'PM').slice(0, 2);
  return key.slice(0, 10);
}
export const ticketKey = (p, t) => (t && Number.isInteger(t.number) ? `${p.key}-${t.number}` : null);
/** Accepts a UUID or a KEY-number reference and returns the ticket UUID. */
async function ticketRef(p, ref) {
  if (UUID_RE.test(ref ?? '')) return ref;
  const m = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/.exec(String(ref ?? '').trim());
  if (!m) throw new ValidationError(`Invalid ticket reference: ${ref}`, { ref });
  if (m[1].toUpperCase() !== p.key) throw new NotFoundError(`Ticket ${ref} is not in project ${p.key}`, { ref });
  const n = Number(m[2]); const hits = (await listJson(p, 'tickets')).filter(t => t.number === n);
  if (!hits.length) throw new NotFoundError(`Ticket not found: ${ref}`, { ref });
  if (hits.length > 1) throw new ConflictError(`Ticket key ${ref} is used by ${hits.length} tickets; run pman keys renumber`, { ref, ids: hits.map(t => t.id) });
  return hits[0].id;
}
async function writeConfig(p, config) {
  const file = path.join(p.dir, 'config.json'), temp = `${file}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
  await fs.writeFile(temp, canonical(config), { flag: 'wx' }); await fs.rename(temp, file); p.config = config; p.key = config.key ?? deriveKey(config.name);
}
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

export async function initProject({ cwd = process.cwd(), name = path.basename(path.resolve(cwd)), key } = {}) {
  const root = path.resolve(cwd), dir = path.join(root, '.pman'), configPath = path.join(dir, 'config.json');
  if (await exists(configPath)) throw new ConflictError(`pman is already initialized at ${root}`);
  if(await exists(dir)){const st=await fs.lstat(dir);if(st.isSymbolicLink()||!st.isDirectory())throw new ValidationError('.pman must not be a symlink or non-directory');if((await fs.readdir(dir)).length)throw new ConflictError(`Refusing to initialize over existing data in ${dir}`);}
  await fs.mkdir(dir, { recursive: true });
  const projectKey = key === undefined ? deriveKey(name) : String(key).toUpperCase(); if (!KEY_RE.test(projectKey)) throw new ValidationError(`Project key must be 2-10 letters or digits starting with a letter: ${key}`);
  const config = { schemaVersion: 1, projectId: uuidv7(), name: String(name || 'Project'), key: projectKey, statuses: [...DEFAULT_STATUSES], properties: {}, createdAt: nowIso() };
  await fs.writeFile(configPath, canonical(config), { flag: 'wx' });
  for (const d of ['tickets', 'comments', 'relationships', ...kinds, ...designFolders]) await fs.mkdir(path.join(dir, d), { recursive: true });
  return config;
}

/** cache: keep parsed records in memory, revalidated on every read by file size+mtime (for long-lived processes such as pman serve). */
export async function openProject({ cwd = process.cwd(), cache = false } = {}) {
  const root = await findProject(cwd); if (!root) throw new NotFoundError(`No .pman project found from ${path.resolve(cwd)}`);
  const dir = path.join(root, '.pman');
  const st = await fs.lstat(dir); if (!st.isDirectory() || st.isSymbolicLink()) throw new ValidationError('.pman must be a real directory');
  let config;
  try { await assertSafePath(dir,path.join(dir,'config.json')); config = JSON.parse(await fs.readFile(path.join(dir, 'config.json'), 'utf8')); }
  catch (e) { throw new ValidationError(`Cannot read .pman/config.json: ${e.message}`, { path: '.pman/config.json' }); }
  if (config.schemaVersion !== 1) throw new UnsupportedSchemaVersionError(`Unsupported project schema version: ${config.schemaVersion}`);
  try{checkId(config.projectId);}catch(e){throw new ValidationError(`Invalid projectId in .pman/config.json: ${e.message}`);}
  if (!Array.isArray(config.statuses) || !config.statuses.length || config.statuses.some(x=>typeof x!=='string'||!x.trim()) || new Set(config.statuses).size !== config.statuses.length) throw new ValidationError('Project statuses must be a non-empty list of unique strings');
  if (config.key !== undefined && !KEY_RE.test(config.key)) throw new ValidationError(`Invalid project key in .pman/config.json: ${config.key}`);
  const p = { root, dir, config, key: config.key ?? deriveKey(config.name), cache: cache ? new Map() : null };
  p.ticketKey = t => ticketKey(p, t);
  p.resolveTicket = ref => ticketRef(p, ref);
  p.keys = keysApi(p);
  p.tickets = ticketApi(p); p.documents = documentApi(p); p.comments = commentApi(p); p.relations = relationApi(p);
  p.validate = () => validateProject(p);
  p.search = (query, options) => searchProject(p, query, options);
  p.searchPage = (query, options) => searchPage(p, query, options);
  p.context = (id, options) => contextFor(p, id, options);
  p.tree = (id, options) => buildTree(p, id, options);
  attachDesignApi(p);
  p.semantic = { status: o => semanticStatus(p, o), update: o => updateIndex(p, o), rebuild: o => updateIndex(p, { ...o, rebuild: true }), search: (q, o) => semanticSearch(p, q, o), hybrid: (q, o) => hybridSearch(p, q, o), similar: (id, o) => similarTickets(p, id, o) };
  p.next = options => nextTickets(p, options);
  p.claim = (id, options) => claimTicket(p, id, options);
  p.release = (id, options) => releaseTicket(p, id, options);
  p.finish = (id, options) => finishTicket(p, id, options);
  return p;
}

async function readJson(file) {
  try {
    const text = await fs.readFile(file, 'utf8'); const value = JSON.parse(text);
    if (value.schemaVersion !== 1) throw new UnsupportedSchemaVersionError(`Unsupported record schema version in ${path.relative(process.cwd(), file)}`);
    return { value, revision: hash(text) };
  } catch (e) { if (e instanceof PmanError) throw e; if(e.code==='ENOENT')throw new NotFoundError(`Record not found: ${path.basename(file,'.json')}`,{id:path.basename(file,'.json')}); throw new ValidationError(`Invalid JSON at ${file}: ${e.message}`, { path: file }); }
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
const deepFreeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; };
/** Lists record files of a folder with their size and mtime; the joined string is the cache key. */
async function folderStamp(p, folder, ext) {
  const base = path.join(p.dir, folder); if (!await exists(base)) return { stamp: 'missing', files: [] };
  const files = [], parts = [];
  for (const shard of (await fs.readdir(base, { withFileTypes: true })).filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const shardPath = path.join(base, shard.name);
    const entries = (await fs.readdir(shardPath, { withFileTypes: true })).filter(x => x.name.endsWith(ext)).sort((a, b) => a.name.localeCompare(b.name));
    const stats = await Promise.all(entries.map(e => fs.lstat(path.join(shardPath, e.name))));
    entries.forEach((e, i) => { files.push(path.join(shardPath, e.name)); parts.push(`${shard.name}/${e.name}:${stats[i].size}:${stats[i].mtimeMs}:${stats[i].isFile() ? 'f' : 'x'}`); });
  }
  return { stamp: parts.join('|'), files };
}
/** Returns cached records when the folder stamp is unchanged; otherwise runs load() and caches the frozen result. */
async function cached(p, key, folder, ext, load) {
  if (!p.cache) return load();
  const { stamp } = await folderStamp(p, folder, ext);
  const hit = p.cache.get(key);
  if (hit && hit.stamp === stamp) return [...hit.value];
  const value = await load();
  const after = await folderStamp(p, folder, ext);
  if (after.stamp === stamp) p.cache.set(key, { stamp, value: deepFreeze(value) }); else p.cache.delete(key);
  return [...value];
}
async function listJson(p, folder) { return cached(p, `json:${folder}`, folder, '.json', () => listJsonUncached(p, folder)); }
async function listJsonUncached(p, folder) {
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
  if(input.kind!==undefined&&!TICKET_KINDS.includes(input.kind))throw new ValidationError(`Invalid ticket kind: ${input.kind}`);
  if(input.assignee!=null&&(typeof input.assignee!=='object'||typeof input.assignee.agent!=='string'||!input.assignee.agent.trim()||Number.isNaN(Date.parse(input.assignee.expiresAt))))throw new ValidationError('Ticket assignee must have an agent name and an expiresAt timestamp');
  validateCodePlanShape(input.codePlan);
  if(input.properties!==undefined&&(!input.properties||typeof input.properties!=='object'||Array.isArray(input.properties)))throw new ValidationError('Ticket properties must be an object');
}

function ticketApi(p) {
  const statuses = p.config.statuses;
  return {
    async create(input) {
      if (input?.parentId && !UUID_RE.test(input.parentId)) input = { ...input, parentId: await ticketRef(p, input.parentId) };
      validateTicketInput(input, statuses);
      if (input.parentId) await readJson(idPath(path.join(p.dir, 'tickets'), input.parentId));
      return withLock(p, 'ticket-number', async () => {
      const number = (await listJson(p, 'tickets')).reduce((m, x) => Math.max(m, Number.isInteger(x.number) ? x.number : 0), 0) + 1;
      const date = nowIso(); const rec = { schemaVersion: 1, id: uuidv7(), number, title: input.title.trim(), kind: input.kind ?? 'task', description: input.description ?? '', status: input.status ?? statuses[0], priority: input.priority ?? 'normal', labels: input.labels ?? [], properties: input.properties ?? {}, parentId: input.parentId ?? null, ...(input.codePlan ? { codePlan: input.codePlan } : {}), createdAt: date, updatedAt: date };
      return writeJson(p, 'tickets', rec, { create: true });
      });
    },
    async get(id) { return (await this.getVersioned(id)).ticket; },
    async getVersioned(id) { id = await ticketRef(p, id); const file=idPath(path.join(p.dir,'tickets'),id);await assertSafePath(p.dir,file);const r = await readJson(file); return {ticket:r.value,revision:r.revision}; },
    async list({ status, parentId, limit = 5000 } = {}) { const a = await listJson(p, 'tickets'); return a.filter(x => (!status || x.status === status) && (parentId === undefined || x.parentId === parentId)).sort(sortRecords).slice(0, limit); },
    async update(id, patch, {expectedRevision, force = false} = {}) {
      id = await ticketRef(p, id); if (patch.parentId && !UUID_RE.test(patch.parentId)) patch = { ...patch, parentId: await ticketRef(p, patch.parentId) }; const file = idPath(path.join(p.dir, 'tickets'), id); await assertSafePath(p.dir,file); const current = await readJson(file), rec = current.value;
      if(expectedRevision&&expectedRevision!==current.revision)throw new ConflictError(`Record changed since it was read: ${id}`,{id});
      const next = { ...rec, ...patch, id, number: rec.number, schemaVersion: 1, createdAt: rec.createdAt, updatedAt: nowIso() };
      validateTicketInput(next, statuses); if (next.parentId === id) throw new CycleError('A ticket cannot be its own parent');
      if (next.parentId) await ensureCanParent(p, id, next.parentId);
      if (next.status === 'done' && rec.status !== 'done' && !force) {
        const g = await workGraph(p), openChildren = g.descendants(id).filter(x => x.status !== 'done' && x.status !== 'cancelled'), blockers = g.openBlockers(id);
        if (openChildren.length || blockers.length) throw new OpenWorkError(`Ticket still has ${openChildren.length} open descendant(s) and ${blockers.length} open blocker(s); finish them first or use force`, { id, openChildren: openChildren.map(x => x.id), blockers: blockers.map(x => x.id) });
      }
      return writeJson(p, 'tickets', next, { expectedRevision: current.revision });
    },
    async move(id, parentId) { return this.update(id, { parentId: parentId ?? null }); },
    async rollup(id) { const rows = await buildTree(p,id); return rows[0].rollup; },
    async readiness(id) { id = await ticketRef(p, id);const all=await listJson(p,'tickets'),byId=new Map(all.map(t=>[t.id,t])),rels=await listJson(p,'relationships');const incoming=rels.filter(r=>r.type==='blocks'&&r.targetId===id);return {ready:incoming.every(r=>isFinished(byId.get(r.sourceId))),blockers:incoming.map(r=>({relationshipId:r.id,ticket:byId.get(r.sourceId)??null}))}; }
  };
}
const isFinished = t => t?.status==='done' || t?.status==='cancelled';
/** Internal generic JSON record storage used by the design module. */
export const _store = {
  list: (p, folder) => listJson(p, folder),
  async get(p, folder, id) { checkId(id); const file = idPath(path.join(p.dir, folder), id); await assertSafePath(p.dir, file); return (await readJson(file)).value; },
  create: (p, folder, rec) => writeJson(p, folder, rec, { create: true }),
  write: (p, folder, rec) => writeJson(p, folder, rec),
};
function keysApi(p) {
  return {
    /** Sets the project key (optional) and numbers tickets without a number in creation order. */
    async init({ key } = {}) {
      return withLock(p, 'ticket-number', async () => {
        if (key !== undefined) { const k = String(key).toUpperCase(); if (!KEY_RE.test(k)) throw new ValidationError(`Project key must be 2-10 letters or digits starting with a letter: ${key}`); await writeConfig(p, { ...p.config, key: k }); }
        else if (!p.config.key) await writeConfig(p, { ...p.config, key: p.key });
        const all = (await listJson(p, 'tickets')).slice().sort(sortRecords); let max = all.reduce((m, x) => Math.max(m, Number.isInteger(x.number) ? x.number : 0), 0); let assigned = 0;
        for (const t of all) if (!Number.isInteger(t.number)) { await writeJson(p, 'tickets', { ...t, number: ++max }); assigned++; }
        return { key: p.key, assigned, total: all.length };
      });
    },
    /** Gives every ticket that shares a number with an older ticket a new number. */
    async renumber() {
      return withLock(p, 'ticket-number', async () => {
        const all = (await listJson(p, 'tickets')).slice().sort(sortRecords); let max = all.reduce((m, x) => Math.max(m, Number.isInteger(x.number) ? x.number : 0), 0); const seen = new Set(), changed = [];
        for (const t of all) { if (!Number.isInteger(t.number)) continue; if (seen.has(t.number)) { const n = ++max; await writeJson(p, 'tickets', { ...t, number: n }); changed.push({ id: t.id, from: `${p.key}-${t.number}`, to: `${p.key}-${n}` }); } else seen.add(t.number); }
        return { changed };
      });
    },
  };
}
function sortRecords(a,b) { return String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id); }
function descendants(all, id) { const map = childIndex(all), out = [], stack = [...(map.get(id) ?? [])].reverse(); while(stack.length) { const cur=stack.pop(); out.push(cur); const c=map.get(cur.id)??[]; for(let i=c.length-1;i>=0;i--) stack.push(c[i]); } return out; }
function childIndex(all) { const m=new Map(); for(const t of all) { if(!m.has(t.parentId)) m.set(t.parentId,[]); m.get(t.parentId).push(t); } for(const v of m.values()) v.sort(sortRecords); return m; }
async function ensureCanParent(p, id, parentId) {
  const all=await listJson(p,'tickets'), map=new Map(all.map(x=>[x.id,x]));
  if(!map.has(parentId)) throw new NotFoundError(`Parent ticket not found: ${parentId}`);
  let cur=parentId; const seen=new Set();
  while(cur) { if(cur===id) throw new CycleError('Move would create a parent cycle',{id,parentId}); if(seen.has(cur)) throw new CycleError('Existing parent cycle detected',{id:cur}); seen.add(cur); cur=map.get(cur)?.parentId??null; }
}
/** Preorder tree rows with derived rollups. fields:'row' returns a lightweight projection for navigation; withTotal returns {items,total}. */
export async function buildTree(p, id = null, { maxDepth = Infinity, limit = 5000, offset = 0, fields = 'full', withTotal = false } = {}) {
  const all=await listJson(p,'tickets'), idx=childIndex(all), roots=id?[await p.tickets.get(id)]:idx.get(null)??[];
  const ordered=[], stack=[];
  for(let i=roots.length-1;i>=0;i--) stack.push({ticket:roots[i],depth:0});
  while(stack.length) { const item=stack.pop(); ordered.push(item); const cs=idx.get(item.ticket.id)??[]; for(let i=cs.length-1;i>=0;i--) stack.push({ticket:cs[i],depth:item.depth+1}); }
  const rel=await listJson(p,'relationships'), stats=new Map(), rollups=new Map(), byId=new Map(all.map(x=>[x.id,x]));
  const openBlocked=new Set(rel.filter(r=>r.type==='blocks'&&!isFinished(byId.get(r.sourceId))).map(r=>r.targetId));
  for(let i=ordered.length-1;i>=0;i--) {
    const {ticket}=ordered[i], cs=idx.get(ticket.id)??[];
    const childStats=cs.map(c=>stats.get(c.id)).filter(Boolean);
    const blocked=!isFinished(ticket)&&openBlocked.has(ticket.id);
    const rollup=blocked?'blocked':cs.length>0&&!childStats.some(x=>x.remaining)?'done':childStats.some(x=>x.active)?'in_progress':ticket.status;
    rollups.set(ticket.id,rollup);
    stats.set(ticket.id,{active:ticket.status==='in_progress'||childStats.some(x=>x.active),remaining:(ticket.status!=='done'&&ticket.status!=='cancelled')||childStats.some(x=>x.remaining)});
  }
  const visible=ordered.filter(x=>x.depth<=maxDepth),page=visible.slice(Math.max(0,offset),Math.max(0,offset)+Math.max(0,limit));
  const rows=fields==='row'
    ? page.map(({ticket,depth})=>({id:ticket.id,parentId:ticket.parentId,depth,title:ticket.title,number:ticket.number??null,key:ticketKey(p,ticket),kind:ticket.kind??'task',status:ticket.status,priority:ticket.priority,labels:ticket.labels??[],assignee:ticket.assignee?.agent??null,childCount:(idx.get(ticket.id)??[]).length,rollup:rollups.get(ticket.id)}))
    : page.map(({ticket,depth})=>({...ticket,depth,rollup:rollups.get(ticket.id)}));
  if(withTotal)return {items:rows,total:visible.length};
  return rows;
}

function parseDoc(text, file) {
  text=text.replace(/\r\n/g,'\n');
  const m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text); if(!m) throw new ValidationError(`Invalid Markdown metadata at ${file}`);
  const meta={}; for(const line of m[1].split('\n')) { const i=line.indexOf(':'); if(i<0) continue; const k=line.slice(0,i),v=line.slice(i+1).trim(); try { meta[k]=JSON.parse(v); } catch { meta[k]=v; } }
  if(meta.schemaVersion!==1) throw new UnsupportedSchemaVersionError(`Unsupported document schema version at ${file}`);
  return { ...meta, body:m[2] };
}
const docText = x => `---\nschemaVersion: 1\nid: ${JSON.stringify(x.id)}\ntitle: ${JSON.stringify(x.title)}\nstatus: ${JSON.stringify(x.status)}\nlinks: ${JSON.stringify(x.links ?? [])}\ncreatedAt: ${JSON.stringify(x.createdAt)}\nupdatedAt: ${JSON.stringify(x.updatedAt)}\n---\n${x.body ?? ''}\n`;
function documentApi(p) {
  const fileOf=(kind,id)=>idPath(path.join(p.dir,kind),id,'.md');
  const checkKind=kind=>{if(!kinds.includes(kind))throw new ValidationError(`Unknown document type: ${kind}`);};
  /** New links must point at existing tickets or documents; new duplicates are rejected, existing ones are kept. */
  async function checkLinks(links,previous=[]){
    if(!Array.isArray(links))throw new ValidationError('Document links must be an array of entity IDs');
    for(const x of links)checkId(x);
    const known=new Set((await listJson(p,'tickets')).map(t=>t.id));for(const kind of kinds)for(const d of await api.list(kind,{body:false}))known.add(d.id);
    const before=new Map(),after=new Map();for(const x of previous)before.set(x,(before.get(x)??0)+1);for(const x of links)after.set(x,(after.get(x)??0)+1);
    const unknown=[...after.keys()].filter(x=>!known.has(x)&&!before.has(x));
    if(unknown.length)throw new ValidationError(`Document links refer to unknown tickets or documents: ${unknown.join(', ')}`,{unknown});
    const duplicates=[...after].filter(([x,n])=>n>1&&n>(before.get(x)??0)).map(([x])=>x);
    if(duplicates.length)throw new ValidationError(`Document already links to: ${duplicates.join(', ')}`,{duplicates});
  }
  const statusOk=s=>{if(s!==undefined&&(typeof s!=='string'||!p.config.statuses.includes(s)))throw new ValidationError(`Unknown status: ${s}`);};
  const api = { async create(kind,input) {
    checkKind(kind);
    if(!input.title?.trim()) throw new ValidationError('Document title is required');
    if(input.body!==undefined&&typeof input.body!=='string')throw new ValidationError('Document body must be text');
    statusOk(input.status);const links=input.links??[];await checkLinks(links);
    const id=uuidv7(), date=nowIso();const value={schemaVersion:1,id,title:input.title.trim(),status:input.status??'todo',links,createdAt:date,updatedAt:date,body:input.body??''};
    const file=fileOf(kind,id); await assertSafePath(p.dir,path.dirname(file));await fs.mkdir(path.dirname(file),{recursive:true});await assertSafePath(p.dir,file);await fs.writeFile(file,docText(value),{flag:'wx'}); return value;
  }, async list(kind,{body=true}={}) {
    checkKind(kind);
    const out=await cached(p,`doc:${kind}`,kind,'.md',()=>listDocsUncached(kind));
    return body?out:out.map(({body:_,...meta})=>meta);
  } };
  async function listDocsUncached(kind) {
    const base=path.join(p.dir,kind), out=[];await assertSafePath(p.dir,base); if(!await exists(base)) return out;
    for(const sh of (await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {const shard=path.join(base,sh.name);await assertSafePath(p.dir,shard);for(const f of (await fs.readdir(shard)).filter(x=>x.endsWith('.md')).sort()){const file=path.join(shard,f);await assertSafePath(p.dir,file);const st=await fs.lstat(file);if(!st.isFile())throw new ValidationError(`Planning document is not a regular file: ${file}`);out.push(parseDoc(await fs.readFile(file,'utf8'),f));}}
    out.sort(sortRecords);
    return out;
  }
  Object.assign(api, { async get(kind,id) { return (await api.getVersioned(kind,id)).document; },
  async getVersioned(kind,id) { checkId(id); checkKind(kind);const f=fileOf(kind,id);await assertSafePath(p.dir,f);let text;try{text=await fs.readFile(f,'utf8');}catch(e){if(e.code==='ENOENT')throw new NotFoundError(`Document not found: ${id}`);throw e;}return {document:parseDoc(text,f),revision:hash(text)}; },
  /** Revision-safe update of title, status, body and links. An unchanged patch writes nothing. */
  async update(kind,id,patch={},{expectedRevision}={}) {
    const {document:current,revision}=await api.getVersioned(kind,id);
    if(expectedRevision&&expectedRevision!==revision)throw new ConflictError(`Document changed since it was read: ${id}`,{id,revision});
    const next={...current};
    if(patch.title!==undefined){if(typeof patch.title!=='string'||!patch.title.trim())throw new ValidationError('Document title is required');next.title=patch.title.trim();}
    if(patch.body!==undefined){if(typeof patch.body!=='string')throw new ValidationError('Document body must be text');next.body=patch.body.replace(/\r\n/g,'\n').replace(/\n+$/,'');}
    if(patch.status!==undefined){statusOk(patch.status);next.status=patch.status;}
    if(patch.links!==undefined){await checkLinks(patch.links,current.links??[]);next.links=[...patch.links];}
    const same=next.title===current.title&&next.status===current.status&&String(next.body??'').replace(/\n+$/,'')===String(current.body??'').replace(/\n+$/,'')&&JSON.stringify(next.links??[])===JSON.stringify(current.links??[]);
    if(same)return {document:current,revision,changed:false};
    next.updatedAt=nowIso();const text=docText(next),f=fileOf(kind,id),temp=`${f}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
    const recheck=hash(await fs.readFile(f,'utf8'));if(recheck!==revision)throw new ConflictError(`Document changed since it was read: ${id}`,{id,revision:recheck});
    try{await fs.writeFile(temp,text,{flag:'wx'});await fs.rename(temp,f);}catch(e){await fs.rm(temp,{force:true}).catch(()=>{});throw new StorageError(`Could not atomically write ${f}: ${e.message}`);}
    return {document:parseDoc(text,f),revision:hash(text),changed:true};
  } });
  return api;
}
function commentApi(p) { return {
  async add(ticketId,input) { ticketId=await ticketRef(p,ticketId); await p.tickets.get(ticketId); if(!input.body?.trim()) throw new ValidationError('Comment body is required'); const rec={schemaVersion:1,id:uuidv7(),ticketId,body:input.body,author:input.author??'local',createdAt:nowIso()}; return writeJson(p,'comments',rec,{create:true}); },
  async list(ticketId) { const a=await listJson(p,'comments'); return a.filter(x=>!ticketId||x.ticketId===ticketId).sort(sortRecords); }
}; }
function relationApi(p) { return {
  async add(sourceId,targetId,type) { sourceId=await ticketRef(p,sourceId);targetId=await ticketRef(p,targetId);if(sourceId===targetId)throw new ValidationError('Relationship endpoints must differ');if(!RELATION_TYPES.includes(type))throw new ValidationError(`Unknown relationship type: ${type}`);const tickets=await listJson(p,'tickets');if(!tickets.some(x=>x.id===sourceId)||!tickets.some(x=>x.id===targetId))throw new NotFoundError('Relationship endpoint not found');return withLock(p,'relationships',async()=>{const records=await listJson(p,'relationships');const same=records.find(x=>x.sourceId===sourceId&&x.targetId===targetId&&x.type===type);if(same)throw new PmanError('This relationship already exists','DUPLICATE_RELATION',{relationshipId:same.id});if(type==='blocks'&&wouldBlockCycle(records,sourceId,targetId))throw new CycleError('Blocking relationship would create a dependency cycle');const r={schemaVersion:1,id:uuidv7(),sourceId,targetId,type,createdAt:nowIso()};return writeJson(p,'relationships',r,{create:true});}); },
  async list(id) { if(id&&!UUID_RE.test(id))id=await ticketRef(p,id); const a=await listJson(p,'relationships'); return a.filter(x=>!id||x.sourceId===id||x.targetId===id).sort(sortRecords); },
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
  const components=await listJson(p,'components'),types=await listJson(p,'types'),contracts=await listJson(p,'contracts'),componentIds=new Set(components.map(c=>c.id));
  for(const rec of [...components,...types,...contracts]){try{checkId(rec.id);}catch(e){errors.push(e.message);}if(unique.has(rec.id))errors.push(`Duplicate entity id ${rec.id}`);unique.add(rec.id);}
  for(const c of components)if(c.parentId&&!componentIds.has(c.parentId))errors.push(`Component ${c.id} refers to missing parent ${c.parentId}`);
  const contractFor=new Set();for(const k of contracts){if(!componentIds.has(k.componentId))errors.push(`Contract ${k.id} refers to missing component ${k.componentId}`);if(contractFor.has(k.componentId))errors.push(`Component ${k.componentId} has more than one contract`);contractFor.add(k.componentId);}
  const typeNames=new Set();for(const ty of types){if(typeNames.has(ty.name))errors.push(`Duplicate type name ${ty.name}`);typeNames.add(ty.name);}
  for(const t of tickets)for(const [key,list] of Object.entries(t.codePlan??{}))for(const e of list??[])if(!componentIds.has(e.component))errors.push(`Ticket ${t.id} codePlan.${key} refers to missing component ${e.component}`);
  for(const c of comments)if(!ids.has(c.ticketId))errors.push(`Comment ${c.id} refers to missing ticket ${c.ticketId}`);
  for(const d of documents)for(const target of d.links??[])if(!ids.has(target)&&!docIds.has(target))errors.push(`Document ${d.id} links to missing entity ${target}`);
  for(const r of rs){if(!ids.has(r.sourceId)||!ids.has(r.targetId))errors.push(`Dangling relationship ${r.id}`);if(!RELATION_TYPES.includes(r.type))errors.push(`Invalid relationship type ${r.id}`);}
  const cycles=blockingCycleNodes(rs);if(cycles.size)errors.push(`Blocking dependency cycle involves ${[...cycles].sort().join(', ')}`);
  const warnings=[],byNumber=new Map();for(const t of tickets)if(Number.isInteger(t.number)){if(!byNumber.has(t.number))byNumber.set(t.number,[]);byNumber.get(t.number).push(t.id);}
  for(const [n,list] of byNumber)if(list.length>1)warnings.push(`Ticket key ${p.key}-${n} is used by ${list.length} tickets (${list.join(', ')}); run pman keys renumber`);
  const unnumbered=tickets.filter(t=>!Number.isInteger(t.number)).length;if(unnumbered)warnings.push(`${unnumbered} ticket(s) have no number yet; run pman keys init`);
  return { valid:errors.length===0, errors, warnings, counts:{tickets:tickets.length,documents:docIds.size,relationships:rs.length,comments:comments.length,components:components.length,types:types.length,contracts:contracts.length} };
}
const DOC_TYPE = { goals: 'goal', plans: 'plan', decisions: 'decision' };
export const SEARCH_TYPES = Object.freeze(['ticket', 'comment', 'goal', 'plan', 'decision']);
/**
 * Ranked keyword search over canonical data. Rank: exact title > title starts with > title contains >
 * body contains, then normalised title, type and id as stable tie-breaks.
 */
export async function searchProject(p, query, { types } = {}) {
  const q=String(query??'').trim().toLocaleLowerCase(); if(!q) throw new ValidationError('Search query is required');
  const wanted=types?.length?new Set(types):null; if(wanted)for(const x of wanted)if(!SEARCH_TYPES.includes(x))throw new ValidationError(`Unknown search type: ${x}`);
  const hits=[], rel=(folder,id,ext)=>path.relative(p.root,idPath(path.join(p.dir,folder),id,ext)).split(path.sep).join('/');
  const words=[...new Set(q.split(/\s+/).filter(w=>w.length>=2))];
  // phrase matches rank first; then all words in the title; then all words anywhere
  const rank=(title,body)=>{const t=String(title??'').toLocaleLowerCase(),b=String(body??'').toLocaleLowerCase();if(t===q)return 0;if(t.startsWith(q))return 1;if(t.includes(q))return 2;if(b.includes(q))return 3;if(words.length>1){if(words.every(w=>t.includes(w)))return 4;if(words.every(w=>t.includes(w)||b.includes(w)))return 5;}return -1;};
  const snippet=(text)=>{const s=String(text??''),at=s.toLocaleLowerCase().indexOf(q);if(at<0)return s.slice(0,160);let from=Math.max(0,at-70);if(from>0){const sp=s.indexOf(' ',from);if(sp>=0&&sp<at)from=sp+1;}return (from>0?'… ':'')+s.slice(from,at+q.length+90);};
  const tickets=await listJson(p,'tickets'),titles=new Map(tickets.map(x=>[x.id,x.title]));
  const keyQuery=/^[a-z][a-z0-9]{1,9}-\d+$/.test(q)?q:null;
  if(!wanted||wanted.has('ticket'))for(const t of tickets){const k=ticketKey(p,t);const r=keyQuery&&k&&k.toLocaleLowerCase()===keyQuery?-0.5:rank(t.title,t.description);if(r!==-1)hits.push({id:t.id,type:'ticket',key:ticketKey(p,t),title:t.title,rank:r,updatedAt:t.updatedAt,path:rel('tickets',t.id),snippet:r<3?String(t.description??'').slice(0,160):snippet(t.description)});}
  if(!wanted||wanted.has('comment'))for(const c of await listJson(p,'comments')){const r=rank('',c.body);if(r>=0)hits.push({id:c.id,type:'comment',ticketId:c.ticketId,title:`Comment on ${titles.get(c.ticketId)??c.ticketId}`,rank:r,updatedAt:c.createdAt,path:rel('comments',c.id),snippet:snippet(c.body)});}
  for(const kind of kinds){const type=DOC_TYPE[kind];if(wanted&&!wanted.has(type))continue;for(const d of await p.documents.list(kind)){const r=rank(d.title,d.body);if(r>=0)hits.push({id:d.id,type,kind,title:d.title,rank:r,updatedAt:d.updatedAt,path:rel(kind,d.id,'.md'),snippet:r<3?String(d.body??'').slice(0,160):snippet(d.body)});}}
  const norm=x=>String(x.title).toLocaleLowerCase();
  return hits.sort((a,b)=>a.rank-b.rank||norm(a).localeCompare(norm(b))||a.type.localeCompare(b.type)||a.id.localeCompare(b.id));
}
/** One page of search results plus a snapshot token; passing a stale snapshot fails with STALE_SEARCH. */
export async function searchPage(p, query, { offset = 0, limit = 20, types, snapshot } = {}) {
  if(!Number.isInteger(offset)||offset<0)throw new ValidationError('offset must be a non-negative integer');
  if(!Number.isInteger(limit)||limit<1||limit>100)throw new ValidationError('limit must be an integer between 1 and 100');
  const all=await searchProject(p,query,{types});
  const current=hash(all.map(x=>`${x.type}:${x.id}:${x.updatedAt}`).join('\n')).slice(0,16);
  if(snapshot&&snapshot!==current)throw new PmanError('Search results changed since the first page; restart from the first page',`STALE_SEARCH`,{snapshot:current});
  const items=all.slice(offset,offset+limit);
  return {query:String(query).trim(),items,total:all.length,offset,limit,nextOffset:offset+items.length<all.length?offset+items.length:null,snapshot:current};
}
export async function contextFor(p,id,{budget=8000}={}) {
  id=await ticketRef(p,id);if(!Number.isFinite(Number(budget))||Number(budget)<512)throw new ValidationError('Context budget must be at least 512 bytes');const max=Number(budget);const ticket=await p.tickets.get(id),all=await listJson(p,'tickets'),map=new Map(all.map(x=>[x.id,x])),ancestors=[];let cur=ticket.parentId;
  while(cur){const a=map.get(cur);if(!a)break;ancestors.unshift(a);cur=a.parentId;}
  const descendantsList=descendants(all,id),selectedDesc=descendantsList.slice(0,20);
  const rel=(await p.relations.list(id)).map(x=>({...x,path:path.relative(p.root,idPath(path.join(p.dir,'relationships'),x.id)).split(path.sep).join('/')}));
  const comments=(await p.comments.list(id)).map(x=>({...x,path:path.relative(p.root,idPath(path.join(p.dir,'comments'),x.id)).split(path.sep).join('/')}));
  const docs=[];for(const kind of kinds)for(const d of await p.documents.list(kind))if((d.links??[]).includes(id)||d.body.includes(id)||d.title.toLowerCase().includes(ticket.title.toLowerCase()))docs.push({id:d.id,type:kind,title:d.title,path:path.relative(p.root,idPath(path.join(p.dir,kind),d.id,'.md')).split(path.sep).join('/')});
  const brief=x=>({id:x.id,title:x.title,status:x.status,priority:x.priority,parentId:x.parentId,description:x.description??''});
  const ticketPath=path.relative(p.root,idPath(path.join(p.dir,'tickets'),id)).split(path.sep).join('/');
  const g=await workGraph(p),ready=readinessOf(g,ticket);const packet={readiness:{ready:ready.ready,reasons:ready.reasons},ticket:{...brief(ticket),kind:ticket.kind??'task',assignee:ticket.assignee??null},codePlan:await resolvedCodePlan(p,ticket),ancestors:ancestors.map(brief),descendants:selectedDesc.map(brief),relationships:rel,comments,documents:docs,sources:{ticket:ticketPath,ancestors:ancestors.map(x=>path.relative(p.root,idPath(path.join(p.dir,'tickets'),x.id)).split(path.sep).join('/'))}},omitted={comments:0,relationships:0,documents:0,ancestors:0,descendants:Math.max(0,descendantsList.length-selectedDesc.length),descriptionBytes:0};
  const size=()=>Buffer.byteLength(JSON.stringify({...packet,omitted,truncated:false,budget:max},null,2));
  for(const key of ['comments','relationships','documents','descendants'])while(size()>max&&packet[key].length){packet[key].pop();omitted[key]++;}
  if(size()>max&&packet.codePlan?.types&&Object.keys(packet.codePlan.types).length){omitted.codePlanTypes=Object.keys(packet.codePlan.types).length;packet.codePlan.types={};}
  if(size()>max&&packet.codePlan){packet.codePlan=null;omitted.codePlan=true;}
  while(size()>max&&packet.ancestors.length){packet.ancestors.pop();packet.sources.ancestors.pop();omitted.ancestors++;}
  if(size()>max&&packet.ticket.description){const original=packet.ticket.description;let low=0,high=original.length;while(low<high){const mid=Math.ceil((low+high)/2);packet.ticket.description=original.slice(0,mid)+'…';if(size()<=max)low=mid;else high=mid-1;}packet.ticket.description=original.slice(0,low)+'…';omitted.descriptionBytes=Buffer.byteLength(original.slice(low));}
  if(size()>max&&packet.ticket.title){const original=packet.ticket.title;packet.ticket.title=original.slice(0,64)+'…';}
  if(size()>max)packet.ticket.properties={};
  const result=()=>({...packet,omitted,truncated:Object.values(omitted).some(v=>v===true||(typeof v==='number'&&v>0)),budget:max});
  // final guard: counters written above can add a few bytes; shorten the description until the packet fits
  for(let out=result(),excess=Buffer.byteLength(JSON.stringify(out,null,2))-max;excess>0&&packet.ticket.description.length>1;out=result(),excess=Buffer.byteLength(JSON.stringify(out,null,2))-max){const d=packet.ticket.description.replace(/…$/,'');const cut=Math.max(1,d.length-excess-8);omitted.descriptionBytes+=Buffer.byteLength(d.slice(cut));packet.ticket.description=d.slice(0,cut)+'…';}
  return result();
}
