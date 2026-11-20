import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

async function project(t) { const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'plantool decisions ')); t.after(() => fs.rm(cwd, { recursive: true, force: true })); await initProject({ cwd, name: 'Shop' }); return openProject({ cwd }); }

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

test('an agent cannot decide a decision that belongs to a person; a reversible agent decision it can', async t => {
  const p = await project(t);
  const { decision: human } = await p.decisions.ask('Do users need accounts?', { owner: 'human' });
  const yes = await p.decisions.addOption(human.id, { title: 'Accounts' });
  await assert.rejects(p.decisions.decide(human.id, yes.id, { why: 'agent guess', by: 'bot' }), { code: 'CONFLICT' });
  await assert.rejects(p.decisions.decide(human.id, yes.id, { why: 'no name given' }), { code: 'CONFLICT' });
  const done = await p.decisions.decide(human.id, yes.id, { why: 'the person said yes', by: 'human' });
  assert.equal(done.chosen, yes.id);

  const { decision: icons } = await p.decisions.ask('Which icon set?', { owner: 'agent', reversible: true });
  const lucide = await p.decisions.addOption(icons.id, { title: 'Lucide' });
  const r = await p.decisions.decide(icons.id, lucide.id, { why: 'widely used, MIT licensed', by: 'bot' });
  assert.equal(r.chosen, lucide.id);
});
