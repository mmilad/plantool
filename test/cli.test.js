import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.HEIST_HOME ??= mkdtempSync(join(tmpdir(), 'heist-home-'));

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cli=path.join(root,'bin','heist.js');
function run(cwd,...args){return spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});}
test('CLI init, create, tree, JSON and validation work from a path with spaces',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'heistman '));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'init','--name','CLI test').status,0);
  const created=run(cwd,'ticket','create','--title','Root task');assert.equal(created.status,0,created.stderr);const id=/ticket (?:[A-Z][A-Z0-9]*-\d+ )?([0-9a-f-]{36})/.exec(created.stdout)?.[1];assert.ok(id);
  const child=run(cwd,'ticket','create','--title','Nested','--parent',id);assert.equal(child.status,0,child.stderr);
  const json=run(cwd,'tree','--format','json');assert.equal(json.status,0,json.stderr);assert.equal(JSON.parse(json.stdout).length,2);
  assert.equal(run(cwd,'validate').status,0);
});

test('ticket create points at possibly related tickets by title', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist related ')); t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const bin = path.resolve('bin/heist.js'); const env = { ...process.env, HEIST_NO_REGISTER: '1' };
  const cli = (...a) => spawnSync(process.execPath, [bin, ...a], { cwd, env, encoding: 'utf8' });
  assert.equal(cli('init', '--name', 'shop').status, 0);
  for (const flag of ['--version', '-v', 'version']) assert.match(cli(flag).stdout, /^@mmilad\/heist \d+\.\d+\.\d+\n$/);
  cli('ticket', 'create', '--title', 'Trade offer flow');
  const related = cli('ticket', 'create', '--title', 'Trade offer flow review');
  assert.match(related.stderr, /Possibly related: SHOP-1\b/);
  const unrelated = cli('ticket', 'create', '--title', 'Accounts settings page');
  assert.doesNotMatch(unrelated.stderr, /Possibly related/);
  // the blueprint of the kind says what is still expected; a complete ticket gets no hint
  assert.match(unrelated.stderr, /Expected for a task, still empty: description \(--description\), why \(--why\), acceptance/);
  const complete = cli('ticket', 'create', '--title', 'Printer queue', '--description', 'Labels wait in a queue until the printer is free.', '--todo', 'Add the queue;Show its length', '--why', 'Orders need labels', '--accept', 'A label prints');
  assert.equal(complete.stderr.trim(), '');
  assert.match(cli('blueprint', 'status', 'SHOP-3').stdout, /○ why/);
  // a ticket reads as a document: blueprint sections in order, missing ones named
  assert.match(cli('ticket', 'todo', 'SHOP-4', '1').stdout, /\[x\] 1\. Add the queue/);
  const shown = cli('ticket', 'show', 'SHOP-4').stdout;
  assert.match(shown, /SHOP-4  Printer queue\ntask · todo\n\nDescription\n  Labels wait[^]*\nWhy\n  Orders need labels\n\nTo do\n  \[x\] 1\. Add the queue\n  \[ \] 2\. Show its length\n\nAcceptance criteria\n  \[ \] 1\. A label prints/);
  assert.match(cli('ticket', 'show', 'SHOP-3').stdout, /Why\n  \(missing\) /);
  assert.match(cli('blueprint', 'check').stdout, /SHOP-1 \(task\)/);
  // relations and the code plan are listed after the blueprint sections; JSON stays the raw ticket
  assert.equal(cli('component', 'add', '--kind', 'service', '--name', 'Queue').status, 0);
  assert.equal(cli('contract', 'set', 'Queue', '--input', '{"jobId":"string"}', '--output', '{"position":"integer"}').status, 0);
  assert.equal(cli('codeplan', 'add', 'SHOP-4', 'implements', 'Queue').status, 0);
  assert.equal(cli('codeplan', 'add', 'SHOP-1', 'consumes', 'Queue', '--requires', 'jobId').status, 0);
  assert.equal(cli('relation', 'add', 'SHOP-1', 'SHOP-4', 'blocks').status, 0);
  assert.equal(cli('relation', 'add', 'SHOP-3', 'SHOP-4', 'relates_to').status, 0);
  const linked = cli('ticket', 'show', 'SHOP-4').stdout;
  assert.match(linked, /\nRelations\n  blocked by\n    SHOP-1  Trade offer flow  \(todo\)\n/);
  assert.match(linked, /\n  relates to\n    SHOP-3  Accounts settings page  \(todo\)\n/);
  assert.match(linked, /\n\nCode plan\n  implements Queue \(service\)   heist contract show Queue\n$/);
  const feeding = cli('ticket', 'show', 'SHOP-1').stdout;
  assert.match(feeding, /\n  blocks\n    SHOP-4  Printer queue  \(todo\)\n/);
  assert.match(feeding, /\n  consumes Queue \(service\)   heist contract show Queue\n    requires jobId\n$/);
  assert.equal(JSON.parse(cli('ticket', 'show', 'SHOP-4', '--format', 'json').stdout).title, 'Printer queue');
});

test('ticket create and update link tickets with --blocked-by, --blocks and --relates', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist links '));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const env = { ...process.env, HEIST_NO_REGISTER: '1', HEIST_SIMILAR: 'off' };
  const heist = (...a) => spawnSync(process.execPath, [cli, ...a], { cwd, env, encoding: 'utf8' });
  const idOf = key => JSON.parse(heist('ticket', 'show', key, '--format', 'json').stdout).id;
  const relations = () => JSON.parse(heist('relation', 'list', '--format', 'json').stdout);
  const linked = (type, source, target) => relations().some(r => r.type === type && r.sourceId === source && r.targetId === target);
  assert.equal(heist('init', '--name', 'links', '--key', 'LNK').status, 0);
  assert.equal(heist('ticket', 'create', '--title', 'Base one').status, 0);
  assert.equal(heist('ticket', 'create', '--title', 'Base two').status, 0);
  // create: --blocked-by X makes X the blocker, --relates links both ways in the stored direction
  const third = heist('ticket', 'create', '--title', 'Third', '--blocked-by', 'LNK-1', '--relates', 'LNK-2');
  assert.equal(third.status, 0, third.stderr);
  assert.match(third.stderr, /--blocked-by LNK-1, --relates LNK-2/);
  assert.ok(linked('blocks', idOf('LNK-1'), idOf('LNK-3')));
  assert.ok(linked('relates_to', idOf('LNK-3'), idOf('LNK-2')));
  // create: --blocks X makes the new ticket the blocker
  assert.equal(heist('ticket', 'create', '--title', 'Fourth', '--blocks', 'LNK-3').status, 0);
  assert.ok(linked('blocks', idOf('LNK-4'), idOf('LNK-3')));
  // update: new link is written, a repeated link is skipped without failing
  assert.equal(heist('ticket', 'update', 'LNK-2', '--blocks', 'LNK-1').status, 0);
  assert.ok(linked('blocks', idOf('LNK-2'), idOf('LNK-1')));
  const again = heist('ticket', 'update', 'LNK-2', '--blocks', 'LNK-1');
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stderr, /already linked/);
  // an unknown key exits non-zero and creates no ticket
  const before = JSON.parse(heist('ticket', 'list', '--format', 'json').stdout).length;
  const ghost = heist('ticket', 'create', '--title', 'Ghost', '--blocked-by', 'LNK-99');
  assert.notEqual(ghost.status, 0);
  assert.equal(JSON.parse(heist('ticket', 'list', '--format', 'json').stdout).length, before);
  // a ticket listed in both --blocked-by and --blocks is refused
  assert.notEqual(heist('ticket', 'create', '--title', 'Both', '--blocked-by', 'LNK-1', '--blocks', 'LNK-1').status, 0);
  // the usage text lists the flags
  const help = heist('--help');
  assert.match(help.stdout + help.stderr, /--blocked-by KEYS/);
});

test('context prints one stderr line for a cut packet and keeps stdout as JSON', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist cut ')); t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const env = { ...process.env, HEIST_NO_REGISTER: '1' };
  const cliBin = path.resolve('bin/heist.js');
  const cli = (...a) => spawnSync(process.execPath, [cliBin, ...a], { cwd, encoding: 'utf8', env });
  assert.equal(cli('init', '--name', 'Cut test').status, 0);
  const made = cli('ticket', 'create', '--title', 'Long', '--description', 'x'.repeat(5000));
  assert.equal(made.status, 0, made.stderr);
  const key = /ticket ([A-Z][A-Z0-9]*-\d+) /.exec(made.stdout)?.[1];
  assert.ok(key, made.stdout);
  const cut = cli('context', key, '--budget', '600');
  assert.equal(cut.status, 0, cut.stderr);
  assert.doesNotThrow(() => JSON.parse(cut.stdout));
  assert.match(cut.stderr, /^Context for .+ was cut to fit 600 bytes: left out .+\. Use --budget \d+ to get all of it\.\n$/);
  const full = cli('context', key, '--budget', '100000');
  assert.equal(full.status, 0, full.stderr);
  assert.equal(full.stderr, '');
});

test('ticket todo renames a to-do with --text and keeps its state; empty text is refused', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist todo '));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const env = { ...process.env, HEIST_NO_REGISTER: '1', HEIST_SIMILAR: 'off' };
  const heist = (...a) => spawnSync(process.execPath, [cli, ...a], { cwd, env, encoding: 'utf8' });
  assert.equal(heist('init', '--name', 'todo', '--key', 'TDO').status, 0);
  assert.equal(heist('ticket', 'create', '--title', 'Steps', '--todo', 'first;second').status, 0);
  assert.equal(heist('ticket', 'todo', 'TDO-1', '1').status, 0);
  const renamed = heist('ticket', 'todo', 'TDO-1', '2', '--text', 'second, renamed');
  assert.equal(renamed.status, 0, renamed.stderr);
  assert.match(renamed.stdout, /\[ \] 2\. second, renamed/);
  assert.match(heist('ticket', 'show', 'TDO-1').stdout, /\[x\] 1\. first/);
  assert.notEqual(heist('ticket', 'todo', 'TDO-1', '2', '--text', '   ').status, 0);
});
