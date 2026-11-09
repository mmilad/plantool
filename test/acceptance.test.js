// Acceptance: an agent plans the Pokemon trading card app, asks the person, and builds on the answers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';

test('agent plans the Pokemon trading card app end to end', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist acceptance ')); t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  await initProject({ cwd, name: 'pokecards' }); const p = await openProject({ cwd });

  // 1. The product starts from a single sentence.
  const root = await p.tickets.create({ title: 'Pokemon trading card app' });
  const bp = await p.blueprints.apply(root.id, 'product');
  const item = name => bp.created.find(c => c.item === name);
  const goal = item('goal'), accounts = item('accounts'), platform = item('platform'), stack = item('stack');
  assert.ok(goal && accounts && platform && stack);

  // 2. Only the goal is ready; decisions are not work.
  let ready = (await p.next({ limit: 100 })).map(x => x.id);
  assert.ok(ready.includes(goal.id)); assert.ok(!ready.includes(accounts.id)); assert.ok(!ready.includes(stack.id));

  // 3. The agent owns the platform decision by default: it decides and says why. A person can reverse it later.
  const platformOptions = (await p.decisions.evaluate(platform.id)).options;
  assert.ok(platformOptions.length >= 2);
  const agentChoice = await p.decisions.decide(platform.id, platformOptions[0].id, { why: 'mobile first; the team knows the stack', by: 'bot' });
  assert.equal(agentChoice.chosen, platformOptions[0].id);
  const reversed = await p.decisions.reopen(platform.id, { by: 'human' });
  assert.equal(reversed.status, 'open');
  await p.decisions.decide(platform.id, platformOptions[1].id, { why: 'the person prefers the other platform', by: 'human' });

  // 4. Agent-owned detail: the agent decides it itself.
  const { decision: icons } = await p.decisions.ask('Which icon set?', { owner: 'agent', reversible: true });
  const lucide = await p.decisions.addOption(icons.id, { title: 'Lucide' });
  await p.decisions.decide(icons.id, lucide.id, { why: 'open source and consistent', by: 'bot' });

  // 5. The person answers; the answer is recorded with by=human and unlocks the work behind it.
  const yes = (await p.decisions.evaluate(accounts.id)).options.find(o => o.title === 'Email and password');
  const login = await p.tickets.create({ title: 'Login and account creation', parentId: root.id });
  await p.relations.add(accounts.id, login.id, 'blocks');
  assert.ok(!(await p.next({ limit: 100 })).some(x => x.id === login.id));
  await p.decisions.decide(accounts.id, yes.id, { why: 'the person said email and password', by: 'human' });
  assert.ok((await p.next({ limit: 100 })).some(x => x.id === login.id));

  // 6. A contract with a stand-in: the trade screen works against the mock, the real service comes later.
  await p.components.create({ kind: 'service', name: 'CardService' });
  await p.components.create({ kind: 'method', name: 'getCard', parentId: 'CardService' });
  await p.contracts.set('CardService.getCard', { input: { cardId: 'string' }, output: { id: 'string', name: 'string', set: 'string' } });
  const mock = await p.tickets.create({ title: 'Mock CardService with fixture cards', parentId: root.id });
  const full = await p.tickets.create({ title: 'Implement CardService with the card database', parentId: root.id });
  const trade = await p.tickets.create({ title: 'Trade screen', parentId: root.id });
  await p.codePlan.add(mock.id, 'implements', 'CardService.getCard', { stage: 'mock' });
  await p.codePlan.add(full.id, 'implements', 'CardService.getCard');
  await p.codePlan.add(trade.id, 'consumes', 'CardService.getCard', { needs: 'mock', requires: ['name'] });
  assert.equal((await p.context(trade.id)).readiness.ready, false);
  await p.tickets.update(mock.id, { status: 'done' }, { force: true });
  assert.equal((await p.context(trade.id)).readiness.ready, true);
  assert.equal((await p.context(item('goal').id)).readiness.ready, true);
  const design = await p.check();
  assert.ok(!design.errors.length, JSON.stringify(design.errors));
});
