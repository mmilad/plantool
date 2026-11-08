import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { initProject, openProject } from '../src/index.js';
import { gitCommonDir } from '../src/claims.js';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).toString();
let hasGit = true; try { execFileSync('git', ['--version'], { stdio: 'pipe' }); } catch { hasGit = false; }

test('claims are shared between git worktrees of the same repository', { skip: !hasGit && 'git not installed' }, async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-wt-')); t.after(() => fs.rm(base, { recursive: true, force: true }));
  const main = path.join(base, 'main'); await fs.mkdir(main);
  git(main, 'init', '-q'); await initProject({ cwd: main });
  const p1 = await openProject({ cwd: main }); const ticket = await p1.tickets.create({ title: 'Shared work' }); const other = await p1.tickets.create({ title: 'Other work' });
  git(main, 'add', '-A'); git(main, 'commit', '-qm', 'plan');
  const wt = path.join(base, 'wt'); git(main, 'worktree', 'add', '-q', wt);
  assert.equal(path.resolve(await gitCommonDir(wt)), path.resolve(main, '.git'));
  const p2 = await openProject({ cwd: wt });
  await p1.claim(ticket.id, { agent: 'alice' });
  assert.ok(!(await p2.next({ limit: 10 })).some(r => r.id === ticket.id), 'claimed elsewhere is not offered');
  await assert.rejects(p2.claim(ticket.id, { agent: 'bob' }), e => e.code === 'CONFLICT' && /another worktree/.test(e.message));
  await p2.claim(other.id, { agent: 'bob' });
  assert.ok(!(await p1.next({ limit: 10 })).some(r => r.id === other.id));
  await p1.release(ticket.id, { agent: 'alice' });
  await p2.claim(ticket.id, { agent: 'bob' });
  await p2.finish(ticket.id, { agent: 'bob' });
  const shared = JSON.parse(await fs.readFile(path.join(main, '.git', 'heist', 'claims.json'), 'utf8'));
  assert.deepEqual(Object.keys(shared.claims), [other.id]);
  assert.equal(git(main, 'status', '--porcelain').includes('claims.json'), false);
});
