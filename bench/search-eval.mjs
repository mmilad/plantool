// Search quality gate (HEIST-7, earlier PM-31): compares keyword, semantic and hybrid ranking per model on the
// fixture plan in search-eval.json, and calibrates the "likely overlap" strength of heist similar against the
// robust strength used by the create hint on the same fixture.
// Usage: node bench/search-eval.mjs [model ...]   (models download once; the default is the shipped model)
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initProject, openProject } from '../src/index.js';
import { getEmbedder, DEFAULT_MODEL } from '../src/embedder.js';
import { closeCaches, updateIndex, semanticSearch, hybridSearch, similarTickets, relatedByEmbedding, OVERLAP_Z, HINT_STRENGTH } from '../src/semantic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const set = JSON.parse(await fs.readFile(path.join(here, 'search-eval.json'), 'utf8'));
const models = process.argv.slice(2).length ? process.argv.slice(2) : [DEFAULT_MODEL];

// A throwaway project with the fixture plan; the repository's own plan is not touched.
const home = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-eval-home-')); const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-eval-'));
process.env.HEIST_HOME = home; process.env.HEIST_NO_REGISTER = '1';
await initProject({ cwd, name: 'Fixture', key: 'FX' });
const p = await openProject({ cwd });
const refToId = new Map(), idToRef = new Map();
for (const t of set.tickets) { const made = await p.tickets.create({ title: t.title, description: t.description }); refToId.set(t.ref, made.id); idToRef.set(made.id, t.ref); }

async function metrics(rank) {
  const rows = [];
  for (const c of set.queries) {
    const refs = []; for (const h of await rank(c.q)) { if (h.type === 'ticket' && refs.length < 10 && idToRef.has(h.id)) refs.push(idToRef.get(h.id)); }
    const firstHit = refs.findIndex(r => c.relevant.includes(r));
    rows.push({ lang: c.lang, recall5: refs.slice(0, 5).filter(r => c.relevant.includes(r)).length / Math.min(c.relevant.length, 5), rr: firstHit >= 0 ? 1 / (firstHit + 1) : 0 });
  }
  const avg = (xs, f) => xs.length ? xs.reduce((s, x) => s + f(x), 0) / xs.length : 0;
  const by = l => rows.filter(r => l === 'all' || r.lang === l);
  return Object.fromEntries(['all', 'en', 'de', 'mixed'].map(l => [l, { recall5: +avg(by(l), r => r.recall5).toFixed(3), mrr10: +avg(by(l), r => r.rr).toFixed(3), n: by(l).length }]));
}
const fmt = m => ['all', 'en', 'de', 'mixed'].map(l => `${l}: R@5 ${m[l].recall5.toFixed(2)} MRR ${m[l].mrr10.toFixed(2)}`).join(' | ');
console.log(`${set.queries.length} queries on ${set.tickets.length} fixture tickets`);
console.log('keyword                     ', fmt(await metrics(q => p.search(q, { types: ['ticket'] }))));

// Calibration: every ticket with siblings (same ref group) against all others, plain z (similar) and robust (create hint).
const groups = new Map(); for (const c of set.queries) for (const r of c.relevant) groups.set(r, c.relevant);
const siblingsOf = ref => [...new Set(groups.get(ref) ?? [])].filter(r => r !== ref);
const allRefs = set.tickets.map(t => t.ref);
for (const model of models) {
  const embedder = await getEmbedder({ model });
  await updateIndex(p, { embedder });
  console.log(`${model.split('/')[1].padEnd(28)}semantic ${fmt(await metrics(async q => (await semanticSearch(p, q, { embedder, types: ['ticket'], limit: 20 })).hits))}`);
  console.log(`${''.padEnd(28)}hybrid   ${fmt(await metrics(async q => (await hybridSearch(p, q, { embedder, types: ['ticket'] })).hits))}`);
  const rows = [];
  for (const ref of allRefs) {
    const sim = await similarTickets(p, refToId.get(ref), { limit: 100, minStrength: -Infinity, embedder });
    const plain = new Map(sim.map(s => [idToRef.get(s.id), s.strength]));
    const others = (await p.tickets.list({ limit: Infinity })).filter(t => t.id !== refToId.get(ref));
    const robust = new Map((await relatedByEmbedding(p, await p.tickets.get(refToId.get(ref)), others, { embedder, minStrength: -Infinity, limit: 100 })).map(r => [idToRef.get(r.ticket.id), r.strength]));
    const sib = siblingsOf(ref);
    for (const other of sib) rows.push({ ref, other, plain: plain.get(other), robust: robust.get(other), kind: 'related' });
    for (const other of allRefs.filter(r => r !== ref && !sib.includes(r))) rows.push({ ref, other, plain: plain.get(other), robust: robust.get(other), kind: 'unrelated' });
  }
  const r = rows.filter(x => x.kind === 'related'), u = rows.filter(x => x.kind === 'unrelated');
  const pct = (xs, q) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2) : 'n/a'; };
  const share = (xs, key, t) => (xs.filter(x => Number.isFinite(x[key]) && x[key] >= t).length / xs.length * 100).toFixed(0) + '%';
  console.log(`  calibration (${model.split('/')[1]}): related pairs ${r.length}, unrelated pairs ${u.length}`);
  console.log(`    plain z  related median ${pct(r.map(x => x.plain), 0.5)} min ${pct(r.map(x => x.plain), 0)} | unrelated p95 ${pct(u.map(x => x.plain), 0.95)} max ${pct(u.map(x => x.plain), 1)} | related >= ${OVERLAP_Z}: ${share(r, 'plain', OVERLAP_Z)} | unrelated >= ${OVERLAP_Z}: ${share(u, 'plain', OVERLAP_Z)}`);
  console.log(`    robust   related median ${pct(r.map(x => x.robust), 0.5)} min ${pct(r.map(x => x.robust), 0)} | unrelated p95 ${pct(u.map(x => x.robust), 0.95)} max ${pct(u.map(x => x.robust), 1)} | related >= ${HINT_STRENGTH}: ${share(r, 'robust', HINT_STRENGTH)} | unrelated >= ${HINT_STRENGTH}: ${share(u, 'robust', HINT_STRENGTH)}`);
}
closeCaches(); await fs.rm(home, { recursive: true, force: true }).catch(() => {}); await fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
