import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

async function project(t) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist decisions ')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd, name: 'Shop' }); return openProject({ cwd }); }

test('an unscored option gives no suggestion, scoring it does', async t => {
  const p = await project(t);
  const { decision: d } = await p.decisions.ask('Which framework?', { criteria: 'Speed:3' });
  const a = await p.decisions.addOption(d.id, { title: 'A' });
  await p.decisions.addOption(d.id, { title: 'B' });
  const before = await p.decisions.evaluate(d.id);
  assert.equal(before.suggested, null);
  assert.equal(before.options.every(o => o.score === null), true);
  await p.decisions.score(a.id, { [before.criteria[0].id]: 4 });
  const after = await p.decisions.evaluate(d.id);
  assert.equal(after.suggested?.title, 'A');
});
