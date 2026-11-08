import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),cli=path.join(root,'bin','pman.js');
function run(cwd,...args){return spawnSync(process.execPath,[cli,...args],{cwd,encoding:'utf8'});}
test('CLI init, create, tree, JSON and validation work from a path with spaces',async t=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'planus manus '));t.after(()=>fs.rm(cwd,{recursive:true,force:true}));
  assert.equal(run(cwd,'init','--name','CLI test').status,0);
  const created=run(cwd,'ticket','create','--title','Root task');assert.equal(created.status,0,created.stderr);const id=/ticket (?:[A-Z][A-Z0-9]*-\d+ )?([0-9a-f-]{36})/.exec(created.stdout)?.[1];assert.ok(id);
  const child=run(cwd,'ticket','create','--title','Nested','--parent',id);assert.equal(child.status,0,child.stderr);
  const json=run(cwd,'tree','--format','json');assert.equal(json.status,0,json.stderr);assert.equal(JSON.parse(json.stdout).length,2);
  assert.equal(run(cwd,'validate').status,0);
});
