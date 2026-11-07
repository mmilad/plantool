import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ConflictError, NotFoundError, ValidationError } from './index.js';
import { designModel } from './design.js';

export const TICKET_KINDS = Object.freeze(['task', 'feature', 'bug']);
export const PRIORITY_RANK = Object.freeze({ low: 0, normal: 1, high: 2, urgent: 3 });
const DEFAULT_LEASE_MINUTES = 60;
export const isFinished = t => t?.status === 'done' || t?.status === 'cancelled';

/** Loads tickets and blocking edges once and derives the indexes the workflow needs. */
export async function workGraph(p) {
  const tickets = await p.tickets.list({ limit: Infinity });
  const rels = (await p.relations.list()).filter(r => r.type === 'blocks');
  const byId = new Map(tickets.map(t => [t.id, t]));
  const children = new Map();
  for (const t of tickets) { if (!children.has(t.parentId)) children.set(t.parentId, []); children.get(t.parentId).push(t); }
  const blockersOf = new Map(), blocksOut = new Map(), providerOf = new Map();
  // Consumers implicitly wait for the tickets that implement the components they consume.
  const design = await designModel(p, tickets);
  for (const e of design.providerEdges) { if (!providerOf.has(e.targetId)) providerOf.set(e.targetId, new Set()); providerOf.get(e.targetId).add(e.sourceId); }
  for (const r of [...rels, ...design.providerEdges]) {
    if (!blockersOf.has(r.targetId)) blockersOf.set(r.targetId, []); blockersOf.get(r.targetId).push(r.sourceId);
    if (!blocksOut.has(r.sourceId)) blocksOut.set(r.sourceId, []); blocksOut.get(r.sourceId).push(r.targetId);
  }
  const ancestors = id => { const out = []; const seen = new Set(); let cur = byId.get(id)?.parentId; while (cur && byId.has(cur) && !seen.has(cur)) { seen.add(cur); out.push(byId.get(cur)); cur = byId.get(cur).parentId; } return out; };
  const descendants = id => { const out = [], stack = [...(children.get(id) ?? [])]; while (stack.length) { const t = stack.pop(); out.push(t); stack.push(...(children.get(t.id) ?? [])); } return out; };
  const openBlockers = id => [...new Set(blockersOf.get(id) ?? [])].map(x => byId.get(x)).filter(t => t && !isFinished(t));
  const isProviderEdge = (source, target) => !!providerOf.get(target)?.has(source);
  return { tickets, byId, children, blockersOf, blocksOut, ancestors, descendants, openBlockers, isProviderEdge, design };
}

const leaseActive = (t, now) => !!t.assignee?.expiresAt && Date.parse(t.assignee.expiresAt) > now;

/** Explains why a ticket can or cannot be started now. */
export function readinessOf(g, ticket, now = Date.now()) {
  const reasons = [];
  if (isFinished(ticket)) reasons.push(`ticket is ${ticket.status}`);
  const openChildren = (g.children.get(ticket.id) ?? []).filter(c => !isFinished(c));
  if (openChildren.length) reasons.push(`${openChildren.length} open child ticket(s)`);
  const own = g.openBlockers(ticket.id);
  const viaProvider = own.filter(t => g.isProviderEdge(t.id, ticket.id)), explicit = own.filter(t => !viaProvider.includes(t));
  if (explicit.length) reasons.push(`blocked by ${explicit.map(t => t.id).join(', ')}`);
  if (viaProvider.length) reasons.push(`waits for provider ticket(s) ${viaProvider.map(t => t.id).join(', ')}`);
  for (const a of g.ancestors(ticket.id)) {
    if (a.status === 'cancelled') reasons.push(`ancestor ${a.id} is cancelled`);
    const ab = g.openBlockers(a.id);
    if (ab.length) reasons.push(`ancestor ${a.id} is blocked by ${ab.map(t => t.id).join(', ')}`);
  }
  if (ticket.status === 'in_progress' && leaseActive(ticket, now)) reasons.push(`claimed by ${ticket.assignee.agent} until ${ticket.assignee.expiresAt}`);
  return { ready: reasons.length === 0, reasons, openChildren: openChildren.map(t => t.id), blockers: own.map(t => t.id) };
}

/** Ready tickets, ranked for an agent: priority (inherited), unblocking impact, focus, age. */
export async function nextTickets(p, { limit = 5, parentId, now = Date.now() } = {}) {
  const g = await workGraph(p);
  let pool = g.tickets;
  if (parentId) { if (!g.byId.has(parentId)) throw new NotFoundError(`Ticket not found: ${parentId}`); pool = [g.byId.get(parentId), ...g.descendants(parentId)]; }
  const candidates = pool.filter(t => t.status === 'todo' || (t.status === 'in_progress' && t.assignee && !leaseActive(t, now)));
  const rows = [];
  for (const t of candidates) {
    if (!readinessOf(g, t, now).ready) continue;
    const ancestors = g.ancestors(t.id);
    // An explicit priority wins; the default 'normal' inherits from the nearest ancestor with an explicit priority.
    const source = [t, ...ancestors].find(x => x.priority && x.priority !== 'normal');
    const rank = PRIORITY_RANK[source?.priority] ?? 1;
    const seen = new Set(), stack = [t.id, ...ancestors.map(a => a.id)].flatMap(id => g.blocksOut.get(id) ?? []);
    while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); stack.push(...(g.blocksOut.get(id) ?? [])); }
    const unblocks = [...seen].filter(id => !isFinished(g.byId.get(id))).length;
    const parent = t.parentId ? g.byId.get(t.parentId) : null;
    const focus = !!parent && ((g.children.get(parent.id) ?? []).some(s => s.id !== t.id && s.status === 'in_progress') || parent.status === 'in_progress');
    const effectivePriority = Object.keys(PRIORITY_RANK).find(k => PRIORITY_RANK[k] === rank);
    const reasons = [`priority ${effectivePriority}${effectivePriority !== t.priority ? ' (inherited)' : ''}`];
    if (unblocks) reasons.push(`unblocks ${unblocks} ticket(s)`);
    if (focus) reasons.push('continues active work in the same parent');
    if (t.status === 'in_progress') reasons.push(`lease of ${t.assignee.agent} expired`);
    rows.push({ id: t.id, title: t.title, kind: t.kind ?? 'task', status: t.status, priority: t.priority, effectivePriority, unblocks, focus, path: ancestors.map(a => a.title).reverse(), createdAt: t.createdAt, reasons });
  }
  rows.sort((a, b) => PRIORITY_RANK[b.effectivePriority] - PRIORITY_RANK[a.effectivePriority] || b.unblocks - a.unblocks || Number(b.focus) - Number(a.focus) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  return rows.slice(0, Math.max(0, limit));
}

/** Short cross-process lock outside the repository; protects claim against concurrent agents in one checkout. */
async function withLock(p, id, fn) {
  const dir = path.join(os.tmpdir(), `pman-locks-${createHash('sha256').update(p.root).digest('hex').slice(0, 16)}`);
  await fs.mkdir(dir, { recursive: true });
  const lock = path.join(dir, `${id}.lock`);
  for (let i = 0; ; i++) {
    try { await fs.mkdir(lock); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const st = await fs.stat(lock).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 10_000) { await fs.rm(lock, { recursive: true, force: true }); continue; }
      if (i > 100) throw new ConflictError(`Ticket ${id} is locked by another pman process`, { id });
      await new Promise(r => setTimeout(r, 50));
    }
  }
  try { return await fn(); } finally { await fs.rm(lock, { recursive: true, force: true }); }
}

export async function claimTicket(p, id, { agent, leaseMinutes = DEFAULT_LEASE_MINUTES, force = false, now = Date.now() } = {}) {
  if (!agent || typeof agent !== 'string' || !agent.trim()) throw new ValidationError('An agent name is required to claim a ticket');
  if (!Number.isFinite(Number(leaseMinutes)) || Number(leaseMinutes) <= 0) throw new ValidationError('Lease minutes must be a positive number');
  return withLock(p, id, async () => {
    const { ticket, revision } = await p.tickets.getVersioned(id);
    if (ticket.assignee && leaseActive(ticket, now) && ticket.assignee.agent !== agent && !force)
      throw new ConflictError(`Ticket is claimed by ${ticket.assignee.agent} until ${ticket.assignee.expiresAt}`, { id, assignee: ticket.assignee });
    const g = await workGraph(p);
    const r = readinessOf(g, { ...ticket, assignee: null, status: ticket.status === 'in_progress' ? 'todo' : ticket.status }, now);
    if (!r.ready && !force) throw new ConflictError(`Ticket is not ready: ${r.reasons.join('; ')}`, { id, reasons: r.reasons });
    const assignee = { agent: agent.trim(), claimedAt: new Date(now).toISOString(), expiresAt: new Date(now + Number(leaseMinutes) * 60_000).toISOString() };
    return p.tickets.update(id, { status: 'in_progress', assignee }, { expectedRevision: revision, force: true });
  });
}

export async function releaseTicket(p, id, { agent, force = false } = {}) {
  return withLock(p, id, async () => {
    const { ticket, revision } = await p.tickets.getVersioned(id);
    if (!ticket.assignee) return ticket;
    if (agent && ticket.assignee.agent !== agent && !force) throw new ConflictError(`Ticket is claimed by ${ticket.assignee.agent}, not ${agent}`, { id, assignee: ticket.assignee });
    return p.tickets.update(id, { assignee: null, status: ticket.status === 'in_progress' ? 'todo' : ticket.status }, { expectedRevision: revision, force: true });
  });
}

export async function finishTicket(p, id, { note, agent, force = false } = {}) {
  const before = new Set((await nextTickets(p, { limit: Infinity })).map(x => x.id));
  const ticket = await withLock(p, id, async () => {
    const { ticket, revision } = await p.tickets.getVersioned(id);
    if (agent && ticket.assignee && leaseActive(ticket, Date.now()) && ticket.assignee.agent !== agent && !force)
      throw new ConflictError(`Ticket is claimed by ${ticket.assignee.agent}, not ${agent}`, { id, assignee: ticket.assignee });
    return p.tickets.update(id, { status: 'done', assignee: null }, { expectedRevision: revision, force });
  });
  const comment = note?.trim() ? await p.comments.add(id, { body: note, author: agent ?? 'local' }) : null;
  const unblocked = (await nextTickets(p, { limit: Infinity })).filter(x => !before.has(x.id));
  return { ticket, comment, unblocked };
}
