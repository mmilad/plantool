// Search quality gate (PM-31): compares keyword, semantic and hybrid ranking per model.
// Usage: node bench/search-eval.mjs [model ...]   (run inside a heist project; models download once)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openProject } from '../src/index.js';
import { getEmbedder } from '../src/embedder.js';
import { updateIndex, semanticSearch, hybridSearch } from '../src/semantic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const set = JSON.parse(await fs.readFile(path.join(here, 'search-eval.json'), 'utf8'));
const models = process.argv.slice(2).length ? process.argv.slice(2) : ['Xenova/all-MiniLM-L6-v2', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', 'Xenova/multilingual-e5-small'];
const p = await openProject({ cwd: process.cwd() });
const keyOf = async id => p.ticketKey(await p.tickets.get(id));
async function metrics(rank) {
  const rows = [];
  for (const c of set.queries) {
    const keys = []; for (const h of await rank(c.q)) { if (h.type === 'ticket' && keys.length < 10) keys.push(await keyOf(h.id)); }
    const firstHit = keys.findIndex(k => c.relevant.includes(k));
    rows.push({ lang: c.lang, recall5: keys.slice(0, 5).filter(k => c.relevant.includes(k)).length / Math.min(c.relevant.length, 5), rr: firstHit >= 0 ? 1 / (firstHit + 1) : 0 });
  }
  const avg = (xs, f) => xs.length ? xs.reduce((s, x) => s + f(x), 0) / xs.length : 0;
  const by = l => rows.filter(r => l === 'all' || r.lang === l);
  return Object.fromEntries(['all', 'en', 'de', 'mixed'].map(l => [l, { recall5: +avg(by(l), r => r.recall5).toFixed(3), mrr10: +avg(by(l), r => r.rr).toFixed(3), n: by(l).length }]));
}
const fmt = m => ['all', 'en', 'de', 'mixed'].map(l => `${l}: R@5 ${m[l].recall5.toFixed(2)} MRR ${m[l].mrr10.toFixed(2)}`).join(' | ');
console.log(`${set.queries.length} queries`);
console.log('keyword                     ', fmt(await metrics(q => p.search(q, { types: ['ticket'] }))));
for (const model of models) {
  const embedder = await getEmbedder({ model });
  await updateIndex(p, { embedder });
  console.log(`${model.split('/')[1].padEnd(28)}semantic ${fmt(await metrics(async q => (await semanticSearch(p, q, { embedder, types: ['ticket'], limit: 20 })).hits))}`);
  console.log(`${''.padEnd(28)}hybrid   ${fmt(await metrics(async q => (await hybridSearch(p, q, { embedder, types: ['ticket'] })).hits))}`);
}
