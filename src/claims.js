// Claims shared between Git worktrees of the same repository.
// Each worktree has its own .plan/ files, so a claim in one worktree is invisible to the others until a merge.
// The shared registry lives in the machine-local Plantool home, keyed by the common Git directory. This keeps
// worktree coordination without requiring write access to .git or adding runtime state to the repository.
// Without Git (or with PLANTOOL_SHARED_CLAIMS=0) everything here is a no-op.
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ConflictError } from './index.js';

/** The common Git directory for a checkout, or null when the project is not inside a Git repository. */
export async function gitCommonDir(root) {
  for (let dir = path.resolve(root); ; dir = path.dirname(dir)) {
    const dotGit = path.join(dir, '.git');
    const st = await fs.stat(dotGit).catch(() => null);
    if (st?.isDirectory()) return dotGit;
    if (st?.isFile()) {
      const m = /^gitdir:\s*(.+)\s*$/m.exec(await fs.readFile(dotGit, 'utf8'));
      if (!m) return null;
      const gitdir = path.resolve(dir, m[1].trim());
      const common = await fs.readFile(path.join(gitdir, 'commondir'), 'utf8').catch(() => null);
      return common ? path.resolve(gitdir, common.trim()) : gitdir;
    }
    if (path.dirname(dir) === dir) return null;
  }
}

async function registry(p) {
  if (process.env.PLANTOOL_SHARED_CLAIMS === '0') return null;
  if (p._claimsDir !== undefined) return p._claimsDir;
  const common = await gitCommonDir(p.root);
  if (!common) return p._claimsDir = null;
  const home = process.env.PLANTOOL_HOME || path.join(os.homedir(), '.plan');
  // Worktree gitfiles may resolve the same common directory through an OS alias
  // (for example /var/... versus /private/var/... on macOS). Hash its physical
  // path so every worktree reaches the same machine-local registry.
  const commonPath = await fs.realpath(common).catch(() => path.resolve(common));
  const repoId = createHash('sha256').update(process.platform === 'win32' ? commonPath.toLowerCase() : commonPath).digest('hex').slice(0, 24);
  p._claimsDir = path.join(home, 'claims', repoId);
  return p._claimsDir;
}

async function withRegistry(dir, fn) {
  await fs.mkdir(dir, { recursive: true });
  const lock = path.join(dir, 'claims.lock'), file = path.join(dir, 'claims.json');
  for (let i = 0; ; i++) {
    try { await fs.mkdir(lock); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const st = await fs.stat(lock).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 10_000) { await fs.rm(lock, { recursive: true, force: true }); continue; }
      if (i > 100) throw new ConflictError('The shared claim registry is locked by another plantool process');
      await new Promise(r => setTimeout(r, 50));
    }
  }
  try {
    let data = { schemaVersion: 1, claims: {} };
    try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e; }
    data.claims ??= {};
    const result = await fn(data.claims);
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`);
    await fs.rename(temp, file);
    return result;
  } finally { await fs.rm(lock, { recursive: true, force: true }); }
}

const active = (c, now) => c && Date.parse(c.expiresAt) > now;
const norm = x => process.platform === 'win32' ? path.resolve(x).toLowerCase() : path.resolve(x);
const same = (a, b) => norm(a) === norm(b);

/** Records a claim; fails when another worktree holds an active claim on the same ticket (unless forced). */
export async function sharedClaim(p, id, assignee, { force = false, now = Date.now() } = {}) {
  const dir = await registry(p); if (!dir) return null;
  return withRegistry(dir, claims => {
    for (const [tid, c] of Object.entries(claims)) if (!active(c, now)) delete claims[tid];
    const other = claims[id];
    if (other && !same(other.worktree, p.root) && !force)
      throw new ConflictError(`Ticket is claimed by ${other.agent} in another worktree (${other.worktree}) until ${other.expiresAt}`, { id, claim: other });
    claims[id] = { ...assignee, worktree: p.root };
    return claims[id];
  });
}

/** Removes this worktree's claim (or any claim when forced). */
export async function sharedRelease(p, id, { force = false } = {}) {
  const dir = await registry(p); if (!dir) return;
  await withRegistry(dir, claims => { if (claims[id] && (force || same(claims[id].worktree, p.root))) delete claims[id]; });
}

/** Active claims held by other worktrees, keyed by ticket id. */
export async function claimsElsewhere(p, now = Date.now()) {
  const dir = await registry(p); if (!dir) return new Map();
  let data; try { data = JSON.parse(await fs.readFile(path.join(dir, 'claims.json'), 'utf8')); } catch { return new Map(); }
  return new Map(Object.entries(data.claims ?? {}).filter(([, c]) => active(c, now) && !same(c.worktree, p.root)));
}
