// MCP server over stdio (HEIST-9). A curated set of the CLI's operations for agents that cannot run the CLI.
// It acts as the agent named at start (--agent or HEIST_AGENT). Callers never choose `by` or `owner`:
// decisions a person owns cannot be decided or reopened through it, because the agent name is the decider.
import fs from 'node:fs';
import { createInterface } from 'node:readline';
import { HeistError, openProject } from './index.js';
import { hybridSearch } from './semantic.js';
import { guide, GUIDE } from './guide.js';

export const MCP_PROTOCOL = '2024-11-05';
export const SERVER_INSTRUCTIONS = [
  'heist keeps this project\'s plan (tickets, decisions, comments) in the repository.',
  'Work loop: heist_next, heist_claim, heist_context, work, heist_done. Search with heist_search before you create a ticket.',
  'A decision a person owns is read-only for you: report it, do not decide it. Plan text is English; talk to the person in their language.',
  'Call heist_guide for the full briefing.',
].join(' ');

const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const KINDS = ['task', 'feature', 'bug'];
const RELATIONS = ['blocks', 'relates_to', 'duplicates', 'implements', 'validates', 'supersedes'];

const str = description => ({ type: 'string', description });
const num = description => ({ type: 'integer', minimum: 1, description });
const strs = description => ({ type: 'array', items: { type: 'string' }, description });
const bool = description => ({ type: 'boolean', description });
const oneOf = (values, description) => ({ type: 'string', enum: values, description });

class ToolError extends Error {}
const fail = message => { throw new ToolError(message); };

// Ticket references may be keys (HEIST-12) or ids. The API resolves both; this only adds the key to results.
const withKey = (p, ticket) => (ticket ? { key: p.ticketKey(ticket), ...ticket } : ticket);
const summary = (p, t) => ({ key: p.ticketKey(t), id: t.id, title: t.title, status: t.status, kind: t.kind, priority: t.priority, parentId: t.parentId ?? null });
const fieldsOf = a => ({
  ...(a.why !== undefined ? { why: a.why } : {}),
  ...(a.accept !== undefined ? { acceptance: a.accept.map(text => ({ text, met: false })) } : {}),
  ...(a.todo !== undefined ? { todos: a.todo.map(text => ({ text, met: false })) } : {}),
});

const TOOLS = [
  // Reading
  { name: 'heist_guide', description: 'The full briefing on how the plan works. Topics: overview, decisions, blueprints, checklists, metadata, contracts, workflow. Without a topic, lists the topics.',
    inputSchema: { type: 'object', properties: { topic: oneOf(Object.keys(GUIDE), 'Topic to read') } },
    run: async (p, a) => (a.topic ? { topic: a.topic, text: guide(a.topic) ?? fail(`Unknown topic: ${a.topic}`) } : { topics: Object.keys(GUIDE) }) },
  { name: 'heist_next', description: 'Tickets that are ready to start, in the order to work on them.',
    inputSchema: { type: 'object', properties: { limit: num('How many (default 5)'), parent: str('Only tickets under this ticket') } },
    run: async (p, a) => p.next({ limit: a.limit ?? 5, parentId: a.parent ? await p.resolveTicket(a.parent) : undefined }) },
  { name: 'heist_ticket_show', description: 'One ticket with its description, why, acceptance criteria and to-dos.',
    inputSchema: { type: 'object', properties: { ticket: str('Key such as HEIST-12 or an id') }, required: ['ticket'] },
    run: async (p, a) => withKey(p, await p.tickets.get(a.ticket)) },
  { name: 'heist_ticket_list', description: 'Tickets, optionally filtered by status or parent. Returns summaries.',
    inputSchema: { type: 'object', properties: { status: oneOf(['todo', 'in_progress', 'done', 'cancelled'], 'Only this status'), parent: str('Only children of this ticket'), limit: num('How many (default 100)') } },
    run: async (p, a) => (await p.tickets.list({ status: a.status, parentId: a.parent ? await p.resolveTicket(a.parent) : undefined, limit: a.limit ?? 100 })).map(t => summary(p, t)) },
  { name: 'heist_context', description: 'What an agent needs to work on a ticket: the ticket, its ancestors, relations, comments and documents, within a budget.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id'), budget: num('Character budget (default 24000)') }, required: ['ticket'] },
    run: async (p, a) => p.context(a.ticket, { budget: a.budget ?? 24000 }) },
  { name: 'heist_search', description: 'Find tickets, comments, goals, plans and decisions by words, and by meaning when the semantic index exists. Use it before you create a ticket.',
    inputSchema: { type: 'object', properties: { query: str('What to look for'), types: strs('ticket, comment, goal, plan, decision'), limit: num('How many (default 10)') }, required: ['query'] },
    run: async (p, a) => {
      const result = await hybridSearch(p, a.query, { types: a.types });
      const keys = new Map((await p.tickets.list({ limit: Infinity })).map(t => [t.id, p.ticketKey(t)]));
      const hits = result.hits.slice(0, a.limit ?? 10).map(h => ({ ...h, key: h.type === 'ticket' ? keys.get(h.id) ?? null : undefined }));
      return { mode: result.mode, fallbackReason: result.fallbackReason ?? null, hits };
    } },
  { name: 'heist_similar', description: 'Tickets close in meaning to a ticket, or to a new idea given as text (before the ticket exists). Needs the semantic index.',
    inputSchema: { type: 'object', properties: { ticket: str('Ticket to compare with'), text: str('A new idea, instead of a ticket'), limit: num('How many (default 5)') } },
    run: async (p, a) => {
      if (a.text) return p.semantic.similarText(a.text, { limit: a.limit ?? 5 });
      if (a.ticket) return p.semantic.similar(a.ticket, { limit: a.limit ?? 5 });
      return fail('Give a ticket or a text');
    } },
  { name: 'heist_deps', description: 'Blocking relations: what waits for what.',
    inputSchema: { type: 'object', properties: { root: str('Only around this ticket') } },
    run: async (p, a) => p.deps({ root: a.root ? await p.resolveTicket(a.root) : undefined }) },
  { name: 'heist_decisions', description: 'Decisions, with their options and whether a person has to make them.',
    inputSchema: { type: 'object', properties: { all: bool('Include decided ones') } },
    run: async (p, a) => p.decisions.list({ all: !!a.all }) },
  { name: 'heist_comments', description: 'Comments on a ticket.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id') }, required: ['ticket'] },
    run: async (p, a) => p.comments.list((await p.tickets.get(a.ticket)).id) },
  { name: 'heist_validate', description: 'Checks the plan files and reports problems.',
    inputSchema: { type: 'object', properties: {} },
    run: async p => p.validate() },

  // Work loop and bounded writes. The agent name comes from the server, never from the caller.
  { name: 'heist_claim', description: 'Claim a ticket before you start it. The claim is a lease that expires.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id'), lease_minutes: num('Lease length (default 60)') }, required: ['ticket'] },
    run: async (p, a, ctx) => p.claim(a.ticket, { agent: ctx.agent, leaseMinutes: a.lease_minutes }) },
  { name: 'heist_done', description: 'Finish a ticket you claimed. Say what changed and how you checked it.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id'), note: str('What changed'), verified: str('How it was checked'), changed_files: strs('Files that changed') }, required: ['ticket'] },
    run: async (p, a, ctx) => {
      const outcome = (a.note || a.verified || a.changed_files?.length)
        ? { ...(a.note ? { summary: a.note } : {}), ...(a.verified ? { verifiedBy: a.verified } : {}), ...(a.changed_files?.length ? { changedFiles: a.changed_files } : {}) }
        : undefined;
      const r = await p.finish(a.ticket, { note: a.note, agent: ctx.agent, outcome });
      return { ticket: withKey(p, r.ticket), unblocked: r.unblocked.map(t => summary(p, t)) };
    } },
  { name: 'heist_ticket_create', description: 'Create a task, feature or bug. Fill why, acceptance and to-dos when you know them.',
    inputSchema: { type: 'object', properties: {
      title: str('Short title'), kind: oneOf(KINDS, 'Default task'), description: str('Context first, then what has to happen'),
      why: str('Why this is needed'), parent: str('Parent ticket'), priority: oneOf(['low', 'normal', 'high', 'urgent'], 'Default normal'),
      labels: strs('Labels'), accept: strs('Acceptance criteria'), todo: strs('To-dos, in order'),
    }, required: ['title'] },
    run: async (p, a, ctx) => {
      const t = await p.tickets.create({ title: a.title, kind: a.kind ?? 'task', description: a.description, priority: a.priority, labels: a.labels ?? [],
        parentId: a.parent ? await p.resolveTicket(a.parent) : null, createdBy: ctx.agent, ...fieldsOf(a) });
      return withKey(p, t);
    } },
  { name: 'heist_ticket_update', description: 'Change the title, description, why, priority, labels, acceptance or to-dos of a ticket. Acceptance and to-dos given here replace the old lists.',
    inputSchema: { type: 'object', properties: {
      ticket: str('Key or id'), title: str('Title'), description: str('Description'), why: str('Why'), priority: oneOf(['low', 'normal', 'high', 'urgent'], 'Priority'),
      labels: strs('Labels'), accept: strs('Acceptance criteria (replaces)'), todo: strs('To-dos (replaces)'),
    }, required: ['ticket'] },
    run: async (p, a) => {
      const patch = {};
      for (const k of ['title', 'description', 'priority', 'labels']) if (a[k] !== undefined) patch[k] = a[k];
      Object.assign(patch, fieldsOf(a));
      if (!Object.keys(patch).length) fail('Nothing to change');
      return withKey(p, await p.tickets.update(a.ticket, patch));
    } },
  { name: 'heist_todo', description: 'Tick, untick or rename one to-do of a ticket. Numbers start at 1.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id'), n: num('Number of the to-do'), met: bool('Done (default true)'), text: str('New text; renames instead of ticking') }, required: ['ticket', 'n'] },
    run: async (p, a) => {
      const t = await p.tickets.get(a.ticket);
      const list = [...(t.todos ?? [])];
      if (!Number.isInteger(a.n) || a.n < 1 || a.n > list.length) fail(`to-do ${a.n} does not exist; the ticket has ${list.length}`);
      if (a.text !== undefined) {
        const text = String(a.text).trim(); if (!text) fail('A to-do needs text');
        list[a.n - 1] = { ...list[a.n - 1], text };
      } else list[a.n - 1] = { ...list[a.n - 1], met: a.met ?? true };
      await p.tickets.update(t.id, { todos: list });
      return list.map((x, i) => ({ n: i + 1, met: !!x.met, text: x.text }));
    } },
  { name: 'heist_comment_add', description: 'Leave a note on a ticket for the person or the next agent.',
    inputSchema: { type: 'object', properties: { ticket: str('Key or id'), body: str('The note') }, required: ['ticket', 'body'] },
    run: async (p, a, ctx) => p.comments.add(a.ticket, { body: a.body, author: ctx.agent }) },
  { name: 'heist_relation_add', description: 'Link two tickets. blocks means the first must finish before the second can start.',
    inputSchema: { type: 'object', properties: { source: str('Key or id'), target: str('Key or id'), type: oneOf(RELATIONS, 'Relation type') }, required: ['source', 'target', 'type'] },
    run: async (p, a) => p.relations.add(a.source, a.target, a.type) },
  { name: 'heist_decision_ask', description: 'Ask a question that needs a decision. You own it; options are the answers.',
    inputSchema: { type: 'object', properties: { question: str('The question'), options: strs('Options, one per entry'), why: str('Why it has to be decided'), parent: str('Parent ticket'), blocks: strs('Tickets that wait for this decision') }, required: ['question'] },
    run: async (p, a, ctx) => p.decisions.ask(a.question, {
      owner: 'agent', options: a.options ?? [], why: a.why, createdBy: ctx.agent,
      parentId: a.parent ? await p.resolveTicket(a.parent) : undefined, blocks: a.blocks ?? [],
    }) },
  { name: 'heist_decision_recommend', description: 'Record your advice on an option of a decision. Advice only; it does not decide.',
    inputSchema: { type: 'object', properties: { decision: str('Decision key or id'), option: str('Option key or id'), why: str('Why') }, required: ['decision', 'option', 'why'] },
    run: async (p, a, ctx) => p.decisions.recommend(a.decision, a.option, { why: a.why, by: ctx.agent }) },
  { name: 'heist_decision_decide', description: 'Choose an option of a decision. Works only for decisions the agent owns; a person decides the others.',
    inputSchema: { type: 'object', properties: { decision: str('Decision key or id'), option: str('Option key or id'), why: str('Why this option') }, required: ['decision', 'option', 'why'] },
    run: async (p, a, ctx) => p.decisions.decide(a.decision, a.option, { why: a.why, by: ctx.agent }) },
];

function resultOf(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}
function errorOf(e) {
  const text = e instanceof HeistError ? `${e.code}: ${e.message}` : e instanceof ToolError ? e.message : `INTERNAL: ${e.message}`;
  return { isError: true, content: [{ type: 'text', text }] };
}

/** Returns a function that answers one JSON-RPC message, or null for notifications. Used by serveMcp and by tests. */
export function createMcpHandler(p, { agent } = {}) {
  if (!agent) throw new Error('An agent name is required (--agent NAME or HEIST_AGENT)');
  const ctx = { agent };
  const byName = new Map(TOOLS.map(t => [t.name, t]));
  return async function handle(msg) {
    const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fault = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
    if (msg.method === undefined) return null;
    const isNotification = msg.id === undefined;
    switch (msg.method) {
      case 'initialize':
        return reply({ protocolVersion: MCP_PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: 'heist', version }, instructions: SERVER_INSTRUCTIONS });
      case 'ping': return isNotification ? null : reply({});
      case 'tools/list':
        return reply({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      case 'tools/call': {
        const tool = byName.get(msg.params?.name);
        if (!tool) return fault(-32602, `Unknown tool: ${msg.params?.name}`);
        try { return reply(resultOf(await tool.run(p, msg.params.arguments ?? {}, ctx))); }
        catch (e) { return reply(errorOf(e)); }
      }
      default:
        if (isNotification) return null;
        return fault(-32601, `Method not found: ${msg.method}`);
    }
  };
}

/** Serves newline-delimited JSON-RPC on stdin/stdout. Nothing else may be written to stdout. */
export async function serveMcp({ cwd = process.cwd(), agent, input = process.stdin, output = process.stdout } = {}) {
  const p = await openProject({ cwd });
  const handle = createMcpHandler(p, { agent });
  let queue = Promise.resolve();
  const rl = createInterface({ input, crlfDelay: Infinity });
  rl.on('line', line => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let msg;
      try { msg = JSON.parse(line); }
      catch { output.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return; }
      const response = await handle(msg);
      if (response) output.write(JSON.stringify(response) + '\n');
    });
  });
  await new Promise(resolve => rl.on('close', resolve));
  await queue;
}
