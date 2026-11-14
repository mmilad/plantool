import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, openProject } from '../src/index.js';
import { closeCaches } from '../src/semantic.js';
import { createMcpHandler, MCP_PROTOCOL } from '../src/mcp.js';

process.env.HEIST_EMBEDDER = 'hash';
async function setup(t) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-mcp-home-')); const prev = process.env.HEIST_HOME; process.env.HEIST_HOME = home;
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'heist-mcp-'));
  t.after(async () => { closeCaches(); process.env.HEIST_HOME = prev; await fs.rm(home, { recursive: true, force: true }); await fs.rm(cwd, { recursive: true, force: true }); });
  await initProject({ cwd, name: 'Mcp', key: 'MCP' });
  return openProject({ cwd });
}
let nextId = 1;
const call = async (handle, name, args = {}) => {
  const res = await handle({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } });
  return { isError: !!res.result?.isError, text: res.result?.content?.[0]?.text ?? res.error?.message, json: () => JSON.parse(res.result.content[0].text) };
};

test('the handshake names the server and notifications get no answer', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'claude' });
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(init.result.protocolVersion, MCP_PROTOCOL);
  assert.equal(init.result.serverInfo.name, 'heist');
  assert.match(init.result.instructions, /heist_next/);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await handle({ jsonrpc: '2.0', id: 9, method: 'nope' })).error.code, -32601);
  assert.throws(() => createMcpHandler(p, {}), /agent name/);
});

test('no tool lets the caller choose who decides or who owns a decision', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'claude' });
  const tools = (await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).result.tools;
  assert.ok(tools.length >= 15);
  for (const tool of tools) {
    const props = Object.keys(tool.inputSchema.properties ?? {});
    assert.ok(!props.includes('by') && !props.includes('owner') && !props.includes('author') && !props.includes('agent') && !props.includes('createdBy'), tool.name);
    assert.match(tool.name, /^heist_/);
  }
});

test('the agent works the loop: next, claim, todo, done; the name comes from the server', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'claude' });
  await p.tickets.create({ title: 'Write the docs', todos: [{ text: 'outline', met: false }, { text: 'review', met: false }] });
  const next = await call(handle, 'heist_next', { limit: 3 });
  assert.equal(next.json()[0].key, 'MCP-1');
  assert.equal((await call(handle, 'heist_claim', { ticket: 'MCP-1' })).isError, false);
  const todo = await call(handle, 'heist_todo', { ticket: 'MCP-1', n: 1 });
  assert.deepEqual(todo.json()[0], { n: 1, met: true, text: 'outline' });
  const renamed = await call(handle, 'heist_todo', { ticket: 'MCP-1', n: 2, text: 'review with the owner' });
  assert.equal(renamed.json()[1].text, 'review with the owner');
  assert.equal((await call(handle, 'heist_todo', { ticket: 'MCP-1', n: 9 })).isError, true);
  const done = await call(handle, 'heist_done', { ticket: 'MCP-1', note: 'docs written', verified: 'read through' });
  assert.equal(done.json().ticket.status, 'done');
  const stored = await p.tickets.get('MCP-1');
  assert.equal(stored.outcome.summary, 'docs written');
  assert.equal(stored.outcome.verifiedBy, 'read through');
});

test('a person decides; the agent cannot, and the agent can decide its own question', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'claude' });
  await p.decisions.ask('Which vendor?', { owner: 'human', options: ['Acme', 'Beta'] });
  const human = await call(handle, 'heist_decisions', { all: false });
  const decision = human.json().find(d => d.question === 'Which vendor?');
  assert.equal(decision.owner, 'human');
  const option = (await p.tickets.list()).find(x => x.kind === 'option' && x.parentId === decision.id);
  const refused = await call(handle, 'heist_decision_decide', { decision: decision.key ?? decision.id, option: option.id, why: 'cheapest' });
  assert.equal(refused.isError, true);
  assert.match(refused.text, /CONFLICT/);
  assert.equal((await p.decisions.list({ all: true })).find(d => d.id === decision.id).status, 'open');

  const ask = await call(handle, 'heist_decision_ask', { question: 'Which colour?', options: ['Blue', 'Green'], why: 'for the header' });
  assert.equal(ask.isError, false);
  const own = (await p.decisions.list()).find(d => d.question === 'Which colour?');
  assert.equal(own.owner, 'agent');
  const blue = (await p.tickets.list()).find(x => x.kind === 'option' && x.parentId === own.id);
  assert.equal((await call(handle, 'heist_decision_decide', { decision: own.id, option: blue.id, why: 'matches the logo' })).isError, false);
});

test('the read tools answer, and an unknown topic or ticket is reported as a tool error', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'claude' });
  const t1 = await p.tickets.create({ title: 'Login page', description: 'Email and password.' });
  assert.equal((await call(handle, 'heist_ticket_show', { ticket: p.ticketKey(t1) })).json().key, 'MCP-1');
  assert.equal((await call(handle, 'heist_ticket_list', { status: 'todo' })).json().length, 1);
  assert.match((await call(handle, 'heist_guide', {})).json().topics.join(','), /decisions/);
  assert.match((await call(handle, 'heist_guide', { topic: 'workflow' })).json().text, /Working the plan/);
  assert.equal((await call(handle, 'heist_guide', { topic: 'nope' })).isError, true);
  const missing = await call(handle, 'heist_ticket_show', { ticket: 'MCP-99' });
  assert.equal(missing.isError, true);
  assert.match(missing.text, /NOT_FOUND/);
});

test('create and update tickets, add comments and relations as the agent', async t => {
  const p = await setup(t); const handle = createMcpHandler(p, { agent: 'codex' });
  const created = await call(handle, 'heist_ticket_create', { title: 'Add search', why: 'people look for things', accept: ['finds a ticket'], todo: ['index', 'query'] });
  assert.equal(created.json().key, 'MCP-1');
  assert.equal(created.json().createdBy, 'codex');
  assert.equal((await call(handle, 'heist_ticket_update', { ticket: 'MCP-1', accept: ['finds a ticket', 'ranks it'] })).isError, false);
  assert.equal((await p.tickets.get('MCP-1')).acceptance.length, 2);
  assert.equal((await call(handle, 'heist_ticket_update', { ticket: 'MCP-1' })).isError, true);
  assert.equal((await call(handle, 'heist_comment_add', { ticket: 'MCP-1', body: 'start with the index' })).isError, false);
  assert.equal((await p.comments.list((await p.tickets.get('MCP-1')).id))[0].author, 'codex');
  await call(handle, 'heist_ticket_create', { title: 'Index it' });
  assert.equal((await call(handle, 'heist_relation_add', { source: 'MCP-2', target: 'MCP-1', type: 'blocks' })).isError, false);
  assert.equal((await call(handle, 'heist_relation_add', { source: 'MCP-2', target: 'MCP-1', type: 'friends' })).isError, true);
});
