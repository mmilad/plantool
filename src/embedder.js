import path from 'node:path';
import { createHash } from 'node:crypto';
import { registryHome } from './registry.js';

/**
 * Local text embeddings. The default model is chosen by the search quality gate (see
 * docs/implementation-decisions.md); everything that influences the vectors is part of the
 * fingerprint, so changing any of it forces a re-embed.
 */
export const DEFAULT_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const KNOWN_MODELS = Object.freeze({
  'Xenova/paraphrase-multilingual-MiniLM-L12-v2': { dtype: 'q8', pooling: 'mean', normalize: true, prefix: '', maxTokens: 128, license: 'Apache-2.0' },
  'Xenova/all-MiniLM-L6-v2': { dtype: 'q8', pooling: 'mean', normalize: true, prefix: '', maxTokens: 256, license: 'Apache-2.0' },
  'Xenova/multilingual-e5-small': { dtype: 'q8', pooling: 'mean', normalize: true, prefix: 'passage: ', maxTokens: 512, license: 'MIT' },
});
export const modelsDir = () => path.join(registryHome(), 'cache', 'models');

const loaded = new Map();

/** Deterministic, dependency-free embedder for tests: hashed character trigrams, L2-normalised. */
function hashEmbedder(dim = 64) {
  const embedOne = text => {
    const v = new Float32Array(dim); const s = ` ${String(text).toLowerCase()} `;
    for (let i = 0; i < s.length - 2; i++) { const h = createHash('md5').update(s.slice(i, i + 3)).digest(); v[h[0] % dim] += 1; }
    let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; for (let i = 0; i < dim; i++) v[i] /= n; return v;
  };
  return { id: `hash-trigram-${dim}`, model: 'test:hash', dim, async embed(texts) { return texts.map(embedOne); } };
}

/**
 * Returns an embedder or throws an Error with code SEMANTIC_UNAVAILABLE and a readable reason.
 * PMAN_EMBEDDER=hash selects the test embedder.
 */
export async function getEmbedder({ model = process.env.PMAN_EMBED_MODEL || DEFAULT_MODEL } = {}) {
  if (process.env.PMAN_EMBEDDER === 'hash') return hashEmbedder();
  if (loaded.has(model)) return loaded.get(model);
  const promise = (async () => {
    const cfg = KNOWN_MODELS[model] ?? { dtype: 'q8', pooling: 'mean', normalize: true, prefix: '', maxTokens: 256 };
    let lib;
    try { lib = await import('@huggingface/transformers'); }
    catch (e) { const err = new Error('Local embeddings need the optional package @huggingface/transformers (pnpm add -O @huggingface/transformers).'); err.code = 'SEMANTIC_UNAVAILABLE'; err.cause = e; throw err; }
    lib.env.cacheDir = modelsDir();
    if (process.env.PMAN_OFFLINE === '1') lib.env.allowRemoteModels = false;
    let extractor;
    try { extractor = await lib.pipeline('feature-extraction', model, { dtype: cfg.dtype }); }
    catch (e) { const err = new Error(`Embedding model ${model} could not be loaded: ${e.message}`); err.code = 'SEMANTIC_UNAVAILABLE'; err.cause = e; throw err; }
    const version = lib.env?.version ?? 'unknown';
    const probe = (await extractor(['probe'], { pooling: cfg.pooling, normalize: cfg.normalize })).tolist()[0];
    const id = createHash('sha256').update(JSON.stringify({ model, version, ...cfg, dim: probe.length })).digest('hex').slice(0, 16);
    return {
      id, model, dim: probe.length, config: cfg, libraryVersion: version,
      async embed(texts) {
        const out = [];
        for (let i = 0; i < texts.length; i += 16) {
          const batch = texts.slice(i, i + 16).map(t => cfg.prefix + t);
          const rows = (await extractor(batch, { pooling: cfg.pooling, normalize: cfg.normalize })).tolist();
          for (const r of rows) out.push(Float32Array.from(r));
          await new Promise(r => setImmediate(r));
        }
        return out;
      },
    };
  })();
  loaded.set(model, promise);
  try { return await promise; } catch (e) { loaded.delete(model); throw e; }
}
