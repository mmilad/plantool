import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initProject, openProject } from '../src/index.js';
import { registerProject, addProjectPath, removeProject, listProjects, pruneProjects, entryId } from '../src/registry.js';

const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'plantool.js');
async function home(t) { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plantool-home-')); const prev = process.env.PLANTOOL_HOME; process.env.PLANTOOL_HOME = dir; t.after(async () => { process.env.PLANTOOL_HOME = prev; await fs.rm(dir, { recursive: true, force: true }); }); return dir; }
async function proj(t, name) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `plantool reg ${name} `)); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd, name }); return cwd; }

test('registry registers, lists, removes and prunes projects by root path', async t => {
  await home(t); const a = await proj(t, 'Shop'), b = await proj(t, 'Game Studio');
  await registerProject(await openProject({ cwd: a })); await registerProject(await openProject({ cwd: a }));
  await addProjectPath(path.join(b, '.plan'));
  let all = await listProjects(); assert.deepEqual(all.map(x => [x.name, x.key, x.available]), [['Game Studio', 'GS', true], ['Shop', 'SHOP', true]]);
  assert.equal(all.find(x => x.key === 'SHOP').id, entryId(a));
  await removeProject('GS'); assert.deepEqual((await listProjects()).map(x => x.key), ['SHOP']);
  await addProjectPath(b); await fs.rm(path.join(b, '.plan'), { recursive: true, force: true });
  all = await listProjects(); assert.equal(all.find(x => x.root === path.resolve(b)).available, false);
  assert.equal((await pruneProjects()).length, 1); assert.deepEqual((await listProjects()).map(x => x.key), ['SHOP']);
  await assert.rejects(() => addProjectPath(os.tmpdir()), { code: 'NOT_FOUND' });
  await assert.rejects(() => removeProject('NOPE'), { code: 'NOT_FOUND' });
});

test('CLI registers projects automatically and lists them from any directory', async t => {
  const dir = await home(t); const a = await proj(t, 'Shop');
  const env = { ...process.env, PLANTOOL_HOME: dir }; delete env.PLANTOOL_NO_REGISTER;
  assert.equal(spawnSync(process.execPath, [cli, 'ticket', 'list'], { cwd: a, env, encoding: 'utf8' }).status, 0);
  const listed = spawnSync(process.execPath, [cli, 'projects', '--format', 'json'], { cwd: os.tmpdir(), env, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr); assert.deepEqual(JSON.parse(listed.stdout).map(x => x.key), ['SHOP']);
  const none = spawnSync(process.execPath, [cli, 'ticket', 'list'], { cwd: a, env: { ...env, PLANTOOL_NO_REGISTER: '1', PLANTOOL_HOME: path.join(dir, 'other') }, encoding: 'utf8' });
  assert.equal(none.status, 0); assert.equal(await fs.access(path.join(dir, 'other')).then(() => true, () => false), false);
});
