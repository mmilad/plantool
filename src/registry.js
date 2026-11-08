import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { NotFoundError, ValidationError, findProject, openProject } from './index.js';

/**
 * Machine-local list of known pman projects (~/.pman/projects.json, override with PMAN_HOME).
 * It is only an index for `pman serve` and `pman projects`; canonical data stays in each repository.
 */
export const registryHome = () => process.env.PMAN_HOME || path.join(os.homedir(), '.pman');
const registryFile = () => path.join(registryHome(), 'projects.json');
const normalize = root => { const r = path.resolve(root); return process.platform === 'win32' ? r.toLowerCase() : r; };
export const entryId = root => createHash('sha256').update(normalize(root)).digest('hex').slice(0, 12);

async function read() {
  try { const data = JSON.parse(await fs.readFile(registryFile(), 'utf8')); return Array.isArray(data.projects) ? data.projects : []; }
  catch (e) { if (e.code === 'ENOENT') return []; throw new ValidationError(`Cannot read project registry ${registryFile()}: ${e.message}`); }
}
async function write(projects) {
  await fs.mkdir(registryHome(), { recursive: true });
  const file = registryFile(), temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(temp, `${JSON.stringify({ schemaVersion: 1, projects }, null, 2)}\n`); await fs.rename(temp, file);
}
/** Serialises read-modify-write cycles between processes with a lock directory next to the registry. */
async function locked(fn) {
  await fs.mkdir(registryHome(), { recursive: true });
  const lock = path.join(registryHome(), 'projects.lock');
  for (let i = 0; ; i++) {
    try { await fs.mkdir(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const st = await fs.stat(lock).catch(() => null); if (st && Date.now() - st.mtimeMs > 10_000) { await fs.rm(lock, { recursive: true, force: true }); continue; }
      if (i > 100) throw new Error('Project registry is locked by another pman process');
      await new Promise(r => setTimeout(r, 30));
    }
  }
  try { return await fn(); } finally { await fs.rm(lock, { recursive: true, force: true }); }
}

/** Adds or refreshes a project by its root directory. */
export async function registerProject(project) {
  const root = path.resolve(project.root), id = entryId(root), now = new Date().toISOString();
  return locked(async () => {
    const list = await read(); const current = list.find(x => x.id === id);
    const entry = { id, root, projectId: project.config.projectId, name: project.config.name, key: project.key, addedAt: current?.addedAt ?? now, lastSeenAt: now };
    await write([...list.filter(x => x.id !== id), entry].sort((a, b) => a.name.localeCompare(b.name) || a.root.localeCompare(b.root)));
    return entry;
  });
}

/** Registers the project at or above a path. */
export async function addProjectPath(dir) {
  const root = await findProject(path.resolve(dir));
  if (!root) throw new NotFoundError(`No .pman project found at or above ${path.resolve(dir)}`);
  return registerProject(await openProject({ cwd: root }));
}

/** Removes an entry by registry id, project key or path; project files are never touched. */
export async function removeProject(ref) {
  return locked(async () => {
    const list = await read(); const byPath = /[\\/]/.test(ref) || ref === '.' ? entryId(ref) : null;
    const hit = list.find(x => x.id === ref || x.id === byPath || x.key === String(ref).toUpperCase());
    if (!hit) throw new NotFoundError(`Project not in registry: ${ref}`);
    await write(list.filter(x => x.id !== hit.id)); return hit;
  });
}

/** Lists registry entries with a live availability check. */
export async function listProjects() {
  const list = await read();
  return Promise.all(list.map(async e => {
    try { const p = await openProject({ cwd: e.root }); return { ...e, name: p.config.name, key: p.key, available: path.resolve(p.root) === path.resolve(e.root) }; }
    catch (error) { return { ...e, available: false, problem: error.message }; }
  }));
}

/** Drops entries whose project no longer exists. */
export async function pruneProjects() {
  const missing = (await listProjects()).filter(x => !x.available).map(x => x.id);
  if (!missing.length) return [];
  return locked(async () => { const list = await read(); await write(list.filter(x => !missing.includes(x.id))); return missing; });
}
