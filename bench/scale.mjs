import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { initProject, openProject, uuidv7 } from '../src/index.js';

const total = Number(process.env.PMAN_BENCH_RECORDS ?? 100_000);
if (!Number.isSafeInteger(total) || total < 2) throw new Error('PMAN_BENCH_RECORDS must be an integer >= 2');
const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'pman-scale-'));
const time = () => performance.now();
try {
  await initProject({ cwd, name: `Scale benchmark (${total})` });
  const records = [], rootId = uuidv7(), stamp = new Date().toISOString();
  for (let i = 0; i < total; i++) {
    const id = i === 0 ? rootId : uuidv7();
    const record = { schemaVersion: 1, id, title: i === 0 ? 'Scale root' : `Record ${i}`, description: i % 17 === 0 ? 'scale benchmark marker' : '', status: i % 11 === 0 ? 'in_progress' : 'todo', priority: 'normal', labels: i % 5 === 0 ? ['scale'] : [], properties: {}, parentId: i === 0 ? null : rootId, createdAt: stamp, updatedAt: stamp };
    const file = path.join(cwd, '.pman', 'tickets', id.slice(0, 2), `${id}.json`);
    records.push({ file, text: `${JSON.stringify(record)}\n` });
  }
  const dirs = [...new Set(records.map(x => path.dirname(x.file)))];
  await Promise.all(dirs.map(x => fs.mkdir(x, { recursive: true })));
  let started = time();
  for (let i = 0; i < records.length; i += 500) await Promise.all(records.slice(i, i + 500).map(x => fs.writeFile(x.file, x.text)));
  const writeMs = time() - started;

  const project = await openProject({ cwd });
  started = time();
  const tree = await project.tree(null, { limit: 100, offset: 0 });
  const treeMs = time() - started;
  started = time();
  const validation = await project.validate();
  const validateMs = time() - started;
  if (tree.length !== 100 || !validation.valid || validation.counts.tickets !== total) throw new Error(`Benchmark verification failed: tree=${tree.length}, validation=${validation.valid}, count=${validation.counts.tickets}`);
  console.log(JSON.stringify({ records: total, shape: 'one root with wide child set', writeMs: Math.round(writeMs), treeMs: Math.round(treeMs), validateMs: Math.round(validateMs), memoryMiB: Math.round(process.memoryUsage().rss / 1024 / 1024), valid: validation.valid }, null, 2));
} finally {
  await fs.rm(cwd, { recursive: true, force: true });
}
