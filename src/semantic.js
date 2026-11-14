import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { registryHome } from './registry.js';
import { getEmbedder } from './embedder.js';

/**
 * Derived, rebuildable semantic index in ~/.heist/cache/<projectId>/db.sqlite.
 * Canonical data stays in .heist/; this database can be deleted at any time.
 */
const SCHEMA_VERSION = 1;
const CHUNK_CHARS = 450;
// Bump when chunking or embedding roles change: every source is then re-indexed.
const INDEX_FORMAT = 3;
const hash = s => createHash('sha256').update(s).digest('hex');
export const cacheDir = projectId => path.join(registryHome(), 'cache', projectId);

let sqliteModule;
async function sqlite() {
  if (sqliteModule) return sqliteModule;
  const emit = process.emitWarning;
  process.emitWarning = (w, ...rest) => { if (String(w?.message ?? w).includes('SQLite')) return; return emit.call(process, w, ...rest); };
  try { sqliteModule = await import('node:sqlite'); } finally { process.emitWarning = emit; }
  return sqliteModule;
}

const dbs = new Map();
const openingDbs = new Map();
/** Opens (or repairs) the cache database with WAL and a busy timeout so parallel processes wait instead of failing. */
export async function openCache(projectId) {
  if (dbs.has(projectId)) return dbs.get(projectId);
  if (openingDbs.has(projectId)) return openingDbs.get(projectId);
  const opening = (async () => {
    const { DatabaseSync } = await sqlite();
    const dir = cacheDir(projectId); await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'db.sqlite');
    const open = () => {
      const db = new DatabaseSync(file);
      try {
        db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
        db.exec(`CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS embeddings(model TEXT NOT NULL, text_hash TEXT NOT NULL, vector BLOB NOT NULL, PRIMARY KEY(model, text_hash));
          CREATE TABLE IF NOT EXISTS sources(root TEXT NOT NULL, model TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, content_hash TEXT NOT NULL, PRIMARY KEY(root, model, source_type, source_id));
          CREATE TABLE IF NOT EXISTS chunks(root TEXT NOT NULL, model TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL, ord INTEGER NOT NULL, text_hash TEXT NOT NULL, text TEXT NOT NULL, title TEXT NOT NULL, ticket_id TEXT, PRIMARY KEY(root, model, source_type, source_id, ord));
          CREATE TABLE IF NOT EXISTS index_state(root TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0, started_at TEXT, finished_at TEXT, error TEXT, sources INTEGER DEFAULT 0, chunks INTEGER DEFAULT 0, PRIMARY KEY(root, model));`);
        const v = db.prepare("SELECT value FROM meta WHERE key='schema'").get();
        if (!v) db.prepare("INSERT INTO meta(key, value) VALUES('schema', ?)").run(String(SCHEMA_VERSION));
        else if (Number(v.value) !== SCHEMA_VERSION) throw Object.assign(new Error('schema changed'), { code: 'SCHEMA' });
        db.prepare('SELECT count(*) AS n FROM chunks').get();
        return db;
      } catch (e) {
        // A failed initialization must release its Windows file handle before repair/retry.
        try { db.close(); } catch {}
        throw e;
      }
    };
    let db;
    try { db = open(); }
    catch (e) {
      // Only discard a cache when SQLite confirms corruption or its own schema version is obsolete.
      // Busy, permission, and other I/O errors must leave a potentially valid database untouched.
      if (e.code !== 'SCHEMA' && ![11, 26].includes(e.errcode)) throw e;
      const stamp = Date.now();
      for (const ext of ['-wal', '-shm', '']) {
        try { await fs.rename(file + ext, `${file}${ext}.broken-${stamp}`); }
        catch (moveError) { if (moveError.code !== 'ENOENT') throw moveError; }
      }
      db = open();
    }
    dbs.set(projectId, db);
    return db;
  })();
  openingDbs.set(projectId, opening);
  try { return await opening; }
  finally { if (openingDbs.get(projectId) === opening) openingDbs.delete(projectId); }
}
export function closeCaches() { for (const db of dbs.values()) { try { db.close(); } catch {} } dbs.clear(); }

const vecToBlob = v => Buffer.from(v.buffer, v.byteOffset, v.byteLength);
const blobToVec = b => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

/** Splits text into chunks of at most CHUNK_CHARS at paragraph/sentence boundaries. */
export function splitText(text, max = CHUNK_CHARS) {
  const parts = String(text ?? '').replace(/\r\n/g, '\n').split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = []; let cur = '';
  const push = s => { if (s) out.push(s); };
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length <= max) { cur = (cur + ' ' + p).trim(); continue; }
    push(cur); cur = '';
    if (p.length <= max) { cur = p; continue; }
    let rest = p;
    while (rest.length > max) { let cut = rest.lastIndexOf('. ', max); if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max); if (cut < max * 0.3) cut = max; push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim(); }
    cur = rest;
  }
  push(cur);
  return out;
}

/** Builds the chunk list for every source of a project (tickets, comments, documents). */
export async function projectSources(p) {
  const tickets = await p.tickets.list({ limit: Infinity });
  const byId = new Map(tickets.map(t => [t.id, t]));
  const pathOf = t => { const names = []; const seen = new Set(); for (let cur = t.parentId && byId.get(t.parentId); cur && !seen.has(cur.id); cur = cur.parentId && byId.get(cur.parentId)) { seen.add(cur.id); names.unshift(cur.title); } return names; };
  const sources = [];
  for (const t of tickets) {
    const header = [...pathOf(t), t.title].join(' › ');
    const meta = [t.kind, ...(t.labels ?? [])].filter(Boolean).join(', ');
    // chunk 0 is the ticket identity (title only: first sentences are often findings, parent paths make siblings alike); duplicate detection compares it
    const identity = t.title; // no parent path: siblings share it and would all look alike
    const body = splitText(t.description, CHUNK_CHARS - Math.min(header.length, 200)).map(b => `${header}: ${b}`);
    const chunks = [identity, ...body.filter(b => b !== identity)];
    sources.push({ type: 'ticket', id: t.id, title: t.title, ticketId: t.id, chunks });
  }
  for (const c of await p.comments.list()) {
    const t = byId.get(c.ticketId); const header = t ? `Comment on ${t.title}` : 'Comment';
    sources.push({ type: 'comment', id: c.id, title: header, ticketId: c.ticketId, chunks: splitText(c.body, CHUNK_CHARS - 60).map(b => `${header}: ${b}`) });
  }
  for (const [kind, type] of [['goals', 'goal'], ['plans', 'plan'], ['decisions', 'decision']]) {
    for (const d of await p.documents.list(kind)) {
      const sections = String(d.body ?? '').split(/\n(?=#{1,6}\s)/);
      const chunks = [];
      for (const s of sections) { const m = /^#{1,6}\s+(.*)\n?/.exec(s); const heading = m ? m[1].trim() : ''; const text = m ? s.slice(m[0].length) : s; for (const b of splitText(text, CHUNK_CHARS - 80)) chunks.push(`${d.title}${heading ? ` › ${heading}` : ''}: ${b}`); }
      sources.push({ type, id: d.id, title: d.title, ticketId: null, chunks: chunks.length ? chunks : [d.title] });
    }
  }
  return sources;
}

const modelOpt = p => (p.config.semantic?.model ? { model: p.config.semantic.model } : {});
const sourceHash = s => hash(`format:${INDEX_FORMAT}\n${s.chunks.join('\n\u0000')}`);
const running = new Map();
/**
 * Brings the index for this checkout up to date: only changed sources are re-chunked, only
 * unseen texts are embedded (content-addressed, shared across worktrees), deletions are removed.
 * Each source is replaced in its own transaction, so an interrupted run resumes cleanly.
 */
export async function updateIndex(p, { embedder, rebuild = false, onProgress } = {}) {
  const key = `${p.root}`;
  if (running.has(key)) return running.get(key);
  const job = (async () => {
    embedder ??= await getEmbedder(modelOpt(p));
    const db = await openCache(p.config.projectId); const root = path.resolve(p.root), model = embedder.id;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO index_state(root, model, status, started_at) VALUES(?, ?, 'indexing', ?) ON CONFLICT(root, model) DO UPDATE SET status='indexing', started_at=excluded.started_at, error=NULL`).run(root, model, now);
    try {
      if (rebuild) { db.prepare('DELETE FROM chunks WHERE root=? AND model=?').run(root, model); db.prepare('DELETE FROM sources WHERE root=? AND model=?').run(root, model); }
      const sources = await projectSources(p);
      const known = new Map(db.prepare('SELECT source_type, source_id, content_hash FROM sources WHERE root=? AND model=?').all(root, model).map(r => [`${r.source_type}:${r.source_id}`, r.content_hash]));
      const wanted = new Set(sources.map(s => `${s.type}:${s.id}`));
      let changed = 0, embedded = 0;
      // deletions
      const delChunks = db.prepare('DELETE FROM chunks WHERE root=? AND model=? AND source_type=? AND source_id=?');
      const delSource = db.prepare('DELETE FROM sources WHERE root=? AND model=? AND source_type=? AND source_id=?');
      for (const k of known.keys()) if (!wanted.has(k)) { const [type, id] = k.split(/:(.*)/s); db.exec('BEGIN'); delChunks.run(root, model, type, id); delSource.run(root, model, type, id); db.exec('COMMIT'); changed++; }
      const hasVec = db.prepare('SELECT 1 FROM embeddings WHERE model=? AND text_hash=?');
      const putVec = db.prepare('INSERT OR IGNORE INTO embeddings(model, text_hash, vector) VALUES(?, ?, ?)');
      const putChunk = db.prepare('INSERT INTO chunks(root, model, source_type, source_id, ord, text_hash, text, title, ticket_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const putSource = db.prepare('INSERT INTO sources(root, model, source_type, source_id, content_hash) VALUES(?, ?, ?, ?, ?) ON CONFLICT(root, model, source_type, source_id) DO UPDATE SET content_hash=excluded.content_hash');
      const keyOf = (s, ord, text) => (ord === -1 ? hash('identity\u0000' + text) : hash(text));
      const entries = s => [...(s.type === 'ticket' ? [[-1, s.chunks[0]]] : []), ...s.chunks.map((c, ord) => [ord, c])];
      const todo = sources.filter(s => known.get(`${s.type}:${s.id}`) !== sourceHash(s));
      for (let i = 0; i < todo.length; i += 32) {
        const batch = todo.slice(i, i + 32);
        const pending = new Map();
        for (const s of batch) for (const [ord, c] of entries(s)) { const k = keyOf(s, ord, c); if (!pending.has(k) && !hasVec.get(model, k)) pending.set(k, { text: c, identity: ord === -1 }); }
        const docs = [...pending].filter(([, v]) => !v.identity), ids = [...pending].filter(([, v]) => v.identity);
        const docVecs = docs.length ? await embedder.embed(docs.map(([, v]) => v.text)) : [];
        const idVecs = ids.length ? await embedder.embed(ids.map(([, v]) => v.text), { query: true }) : [];
        const texts = [...docs, ...ids]; const vecs = [...docVecs, ...idVecs];
        db.exec('BEGIN');
        try {
          texts.forEach(([k], j) => putVec.run(model, k, vecToBlob(vecs[j])));
          for (const s of batch) {
            delChunks.run(root, model, s.type, s.id);
            for (const [ord, c] of entries(s)) putChunk.run(root, model, s.type, s.id, ord, keyOf(s, ord, c), c, s.title, s.ticketId);
            putSource.run(root, model, s.type, s.id, sourceHash(s));
          }
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; }
        embedded += texts.length; changed += batch.length;
        onProgress?.({ done: Math.min(i + 32, todo.length), total: todo.length });
      }
      const counts = db.prepare('SELECT (SELECT count(*) FROM sources WHERE root=? AND model=?) AS s, (SELECT count(*) FROM chunks WHERE root=? AND model=?) AS c').get(root, model, root, model);
      db.prepare(`UPDATE index_state SET status='ready', finished_at=?, generation=generation+?, sources=?, chunks=? WHERE root=? AND model=?`).run(new Date().toISOString(), changed || rebuild ? 1 : 0, counts.s, counts.c, root, model);
      vectorCache.delete(`${p.config.projectId}|${root}|${model}`);
      return { changed, embedded, sources: counts.s, chunks: counts.c, model: embedder.model };
    } catch (e) {
      try { db.prepare(`UPDATE index_state SET status='error', error=? WHERE root=? AND model=?`).run(String(e.message), root, model); } catch {}
      throw e;
    }
  })();
  running.set(key, job);
  try { return await job; } finally { running.delete(key); }
}

/** Readiness for the UI/API: never throws. */
export async function semanticStatus(p, { load = false } = {}) {
  let embedder;
  try { embedder = load ? await getEmbedder(modelOpt(p)) : null; } catch (e) { return { available: false, reason: e.message, mode: 'keyword' }; }
  try {
    const db = await openCache(p.config.projectId);
    const rows = db.prepare('SELECT * FROM index_state WHERE root=?').all(path.resolve(p.root));
    const row = embedder ? rows.find(r => r.model === embedder.id) : rows.sort((a, b) => String(b.finished_at).localeCompare(String(a.finished_at)))[0];
    if (!row) return { available: false, reason: 'The semantic index has not been built yet (heist index update).', mode: 'keyword', indexing: running.has(p.root) };
    return { available: row.status === 'ready' || (row.generation > 0 && row.status === 'indexing'), mode: row.generation > 0 ? 'hybrid' : 'keyword', status: row.status, generation: row.generation, sources: row.sources, chunks: row.chunks, finishedAt: row.finished_at, error: row.error, indexing: running.has(p.root) || row.status === 'indexing', model: embedder?.model };
  } catch (e) { return { available: false, reason: `Cache database unavailable: ${e.message}`, mode: 'keyword' }; }
}

const vectorCache = new Map();
async function vectors(p, embedder) {
  const root = path.resolve(p.root), key = `${p.config.projectId}|${root}|${embedder.id}`;
  const db = await openCache(p.config.projectId);
  const gen = db.prepare('SELECT generation FROM index_state WHERE root=? AND model=?').get(root, embedder.id)?.generation ?? 0;
  const hit = vectorCache.get(key); if (hit && hit.generation === gen) return hit;
  const rows = db.prepare(`SELECT c.source_type, c.source_id, c.ord, c.text, c.title, c.ticket_id, e.vector FROM chunks c JOIN embeddings e ON e.model=c.model AND e.text_hash=c.text_hash WHERE c.root=? AND c.model=?`).all(root, embedder.id);
  const dim = embedder.dim, matrix = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => matrix.set(blobToVec(r.vector), i * dim));
  const value = { generation: gen, dim, matrix, rows: rows.map(({ vector, ...r }) => r) };
  vectorCache.set(key, value); return value;
}
function scoreAll(index, q) {
  const { matrix, dim, rows } = index, out = new Float32Array(rows.length);
  for (let i = 0; i < rows.length; i++) { let s = 0; const o = i * dim; for (let d = 0; d < dim; d++) s += matrix[o + d] * q[d]; out[i] = s; }
  return out;
}
function bestPerSource(index, scores, filter = () => true) {
  const best = new Map();
  index.rows.forEach((r, i) => { if (!filter(r)) return; const k = `${r.source_type}:${r.source_id}`; const cur = best.get(k); if (!cur || scores[i] > cur.score) best.set(k, { type: r.source_type, id: r.source_id, title: r.title, ticketId: r.ticket_id, snippet: r.text, score: scores[i] }); });
  return [...best.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
}

/** Pure semantic ranking of a query. */
export async function semanticSearch(p, query, { types, limit = 50, embedder } = {}) {
  const q = String(query ?? '').trim(); if (!q) throw Object.assign(new Error('Search query is required'), { code: 'VALIDATION' });
  embedder ??= await getEmbedder(modelOpt(p));
  const index = await vectors(p, embedder);
  const [qv] = await embedder.embed([q], { query: true });
  const wanted = types?.length ? new Set(types) : null;
  return { generation: index.generation, hits: bestPerSource(index, scoreAll(index, qv), r => r.ord >= 0 && (!wanted || wanted.has(r.source_type))).slice(0, limit) };
}

/**
 * Hybrid search: reciprocal rank fusion of keyword and semantic rankings (k = 60), deterministic
 * tie-breaks. Falls back to keyword ranking with an explanation when the semantic side is unavailable.
 */
export async function hybridSearch(p, query, { types, embedder } = {}) {
  const keyword = await p.search(query, { types });
  let semantic = null, reason = null;
  try { const st = await semanticStatus(p); if (!st.generation && !embedder) throw new Error(st.reason ?? 'Semantic index not built yet'); semantic = await semanticSearch(p, query, { types, embedder, limit: 100 }); }
  catch (e) { reason = e.message; }
  if (!semantic) return { mode: 'keyword', fallbackReason: reason, generation: null, hits: keyword.map(h => ({ ...h, matchedBy: ['keyword'] })) };
  const K = 60, fused = new Map();
  keyword.forEach((h, i) => fused.set(`${h.type}:${h.id}`, { ...h, score: 1 / (K + i + 1), matchedBy: ['keyword'] }));
  semantic.hits.forEach((h, i) => {
    if (h.score < 0.25) return; // too weak to count as a semantic match
    const k = `${h.type}:${h.id}`, cur = fused.get(k), add = 1 / (K + i + 1);
    if (cur) { cur.score += add; cur.matchedBy.push('semantic'); cur.similarity = h.score; }
    else fused.set(k, { id: h.id, type: h.type, title: h.title, ticketId: h.ticketId ?? undefined, snippet: h.snippet, similarity: h.score, score: add, matchedBy: ['semantic'] });
  });
  const hits = [...fused.values()].sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  return { mode: 'hybrid', generation: semantic.generation, hits };
}

/** Tickets whose text is close to the given ticket; ancestors and descendants are excluded. */
// Calibrated on the first plan of this repository (a planted duplicate scored z 3.7, related siblings up to 3.0) and checked on the
// fixture plan of bench/search-eval.mjs (HEIST-7): plain z reaches 3.5 for 6% of related pairs and 0% of unrelated ones.
export const OVERLAP_Z = 3.5;
/** How far each score stands above the mean of all scores, in standard deviations. */
export function strengths(values) {
  const n = values.length || 1; const mean = values.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1;
  return values.map(x => (x - mean) / sd);
}
export async function similarTickets(p, ticketRef, { limit = 5, minScore = 0, minStrength = -Infinity, embedder } = {}) {
  const id = await p.resolveTicket(ticketRef);
  embedder ??= await getEmbedder(modelOpt(p));
  const index = await vectors(p, embedder);
  const mine = index.rows.map((r, i) => [r, i]).filter(([r]) => r.source_type === 'ticket' && r.source_id === id && r.ord === -1);
  if (!mine.length) throw Object.assign(new Error('This ticket is not indexed yet; run heist index update'), { code: 'NOT_INDEXED' });
  const tickets = await p.tickets.list({ limit: Infinity }); const byId = new Map(tickets.map(t => [t.id, t]));
  const lineage = new Set([id]); for (let cur = byId.get(id)?.parentId; cur; cur = byId.get(cur)?.parentId) { if (lineage.has(cur)) break; lineage.add(cur); }
  const stack = [id]; while (stack.length) { const x = stack.pop(); for (const t of tickets) if (t.parentId === x && !lineage.has(t.id)) { lineage.add(t.id); stack.push(t.id); } }
  const best = new Map();
  for (const [, i] of mine) {
    const q = index.matrix.subarray(i * index.dim, (i + 1) * index.dim);
    const scores = scoreAll(index, q);
    index.rows.forEach((r, j) => { if (r.source_type !== 'ticket' || r.ord !== -1 || lineage.has(r.source_id)) return; const cur = best.get(r.source_id) ?? 0; if (scores[j] > cur) best.set(r.source_id, scores[j]); });
  }
  const rels = (await p.relations.list(id)).map(r => [r.sourceId === id ? r.targetId : r.sourceId, r.type]);
  const linked = new Map(rels);
  // Models differ in how they spread scores, so "likely overlap" is judged relative to this ticket's
  // own distribution: how many standard deviations a candidate stands above the mean of all others.
  // `robust` (median and MAD, the create hint's measure) is reported beside it; see bench/search-eval.mjs and HEIST-7.
  const values = [...best.values()], z = strengths(values), rz = robustStrengths(values);
  return [...best].map(([tid, score], i) => [tid, score, z[i], rz[i]]).filter(([, s, z]) => s >= minScore && z >= minStrength).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
    .map(([tid, score, z, rz]) => { const t = byId.get(tid); return { id: tid, key: p.ticketKey(t), title: t?.title, status: t?.status, score: Math.round(score * 1000) / 1000, strength: Math.round(z * 100) / 100, robust: Math.round(rz * 100) / 100, likelyOverlap: z >= OVERLAP_Z && !linked.has(tid), relation: linked.get(tid) ?? null }; });
}

/**
 * Tickets close in meaning to a free-text idea, before a ticket exists. Compares the query with each ticket's
 * identity vector (the same symmetric embedding that similarTickets uses). Nothing is excluded.
 */
export async function similarToText(p, text, { limit = 5, minScore = 0, minStrength = -Infinity, embedder } = {}) {
  const q = String(text ?? '').trim(); if (!q) throw Object.assign(new Error('Text is required'), { code: 'VALIDATION' });
  embedder ??= await getEmbedder(modelOpt(p));
  const index = await vectors(p, embedder);
  const [qv] = await embedder.embed([q], { query: true });
  const scores = scoreAll(index, qv);
  const entries = index.rows.map((r, j) => [r, j]).filter(([r]) => r.source_type === 'ticket' && r.ord === -1).map(([r, j]) => [r.source_id, scores[j]]);
  const values = entries.map(([, s]) => s), z = strengths(values), rz = robustStrengths(values);
  const tickets = await p.tickets.list({ limit: Infinity }); const byId = new Map(tickets.map(t => [t.id, t]));
  return entries.map(([tid, score], i) => [tid, score, z[i], rz[i]]).filter(([, s, z]) => s >= minScore && z >= minStrength)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit)
    .map(([tid, score, z, rz]) => { const t = byId.get(tid); return { id: tid, key: p.ticketKey(t), title: t?.title, status: t?.status, score: Math.round(score * 1000) / 1000, strength: Math.round(z * 100) / 100, robust: Math.round(rz * 100) / 100, likelyOverlap: z >= OVERLAP_Z, relation: null }; });
}

// The create hint asks a wider question than `likelyOverlap`: is anything related at all? Related tickets often come
// in groups (the parts of a header), and a group raises the mean and the deviation until none of its members
// stands out. Median and median absolute deviation ignore the group. Checked with multilingual-e5-small on 20 unrelated
// titles: related tickets reached 3.8-5.0 whether one or four were present, unrelated ones stayed below 2.5
// (plain z dropped from 3.6 to 2.3 with four related tickets; a fixed 0.86 flagged unrelated short titles).
export const HINT_STRENGTH = 3.5;
export const MIN_HINT_POPULATION = 10;
/** How far each score stands above the median, in robust standard deviations (1.4826 x median absolute deviation). */
export function robustStrengths(values) {
  const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  const mid = median(values), mad = median(values.map(x => Math.abs(x - mid))) * 1.4826;
  return values.map(x => (mad ? (x - mid) / mad : 0));
}

/**
 * Tickets that stand out as close in meaning to a new ticket, without a stored index: suited to small and medium projects.
 * A candidate counts when it stands HINT_STRENGTH robust deviations above the median of all candidates. Absolute scores
 * are not comparable between models, so there is no fixed threshold.
 * Returns [] when the model is not available or the project has fewer than MIN_HINT_POPULATION other tickets (too few
 * to say what "usual" is), so callers can always fall back to keyword hints. This is a hint, not a decision.
 */
export async function relatedByEmbedding(p, ticket, others, { limit = 3, minStrength = HINT_STRENGTH, minPopulation = MIN_HINT_POPULATION, maxTickets = 2000, embedder } = {}) {
  if (others.length < minPopulation || others.length > maxTickets) return [];
  try { embedder ??= await getEmbedder(modelOpt(p)); } catch (e) { if (e.code === 'SEMANTIC_UNAVAILABLE') return []; throw e; }
  const textOf = x => [x.title, x.description].filter(Boolean).join('\n').slice(0, 600);
  // With a semantic index, the other tickets' identity vectors (titles) are already stored: reuse them and embed only
  // the new ticket and any ticket the index does not know yet. Without an index every ticket is embedded as before.
  let stored = null; try { stored = await identityVectors(p, embedder); } catch { stored = null; }
  const useIndex = !!stored && stored.size > 0;
  const textOfNew = useIndex ? (x => x.title ?? '') : textOf;
  const missing = useIndex ? others.filter(x => !stored.has(x.id)) : others;
  let vectors;
  try { vectors = await embedder.embed([textOfNew(ticket), ...missing.map(textOfNew)], { query: true }); }
  catch (e) { if (e.code === 'SEMANTIC_UNAVAILABLE') return []; throw e; }
  const fresh = new Map(missing.map((x, i) => [x.id, vectors[i + 1]]));
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const vecOf = x => (useIndex && stored.has(x.id) ? stored.get(x.id) : fresh.get(x.id));
  const scores = others.map(x => cos(vectors[0], vecOf(x))); const z = robustStrengths(scores);
  return others.map((x, i) => ({ ticket: x, score: scores[i], strength: z[i] }))
    .filter(r => r.strength >= minStrength).sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Identity vectors (ticket titles) stored by the index, keyed by ticket id. Empty when the index has none for this model. */
async function identityVectors(p, embedder) {
  const index = await vectors(p, embedder); const out = new Map();
  index.rows.forEach((r, i) => { if (r.source_type === 'ticket' && r.ord === -1) out.set(r.source_id, index.matrix.subarray(i * index.dim, (i + 1) * index.dim)); });
  return out;
}
