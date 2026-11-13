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
});
