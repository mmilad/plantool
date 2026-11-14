import { ValidationError } from './index.js';

const compare = (a, b) => a.localeCompare(b, 'en', { numeric: true });

/**
 * Read-only projection of all relations for the relation graph.
 * Layers follow the blocks chains (blocker left of blocked); rows are positions inside a layer.
 * Shape: contract relationGraph (nodes, edges, layers, hidden, totalNodes, truncated).
 */
export async function relationGraph(p, { root, limit = 200 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ValidationError('limit must be an integer from 1 to 200');
  if (root !== undefined && root !== null && (typeof root !== 'string' || !root.trim())) throw new ValidationError('root must be a ticket id or key');
  const rootId = root == null ? null : await p.resolveTicket(root.trim());

  const tickets = await p.tickets.list({ limit: Infinity });
  const byId = new Map(tickets.map(t => [t.id, t]));

  // Scope: all tickets, or the root and its descendants (followed through parentId).
  const scope = new Set(rootId ? [] : tickets.map(t => t.id));
  if (rootId) {
    const children = new Map();
    for (const t of tickets) {
      if (t.parentId == null) continue;
      if (!children.has(t.parentId)) children.set(t.parentId, []);
      children.get(t.parentId).push(t.id);
    }
    const pending = [rootId];
    while (pending.length) {
      const id = pending.pop();
      if (scope.has(id)) continue;
      scope.add(id);
      for (const child of children.get(id) ?? []) pending.push(child);
    }
  }

  // Relations of every type whose ends are known tickets and where at least one end is in scope.
  const relations = (await p.relations.list()).filter(r => byId.has(r.sourceId) && byId.has(r.targetId));
  const kept = relations.filter(r => !rootId || scope.has(r.sourceId) || scope.has(r.targetId));

  const nodeIds = new Set();
  for (const r of kept) { nodeIds.add(r.sourceId); nodeIds.add(r.targetId); }
  const hidden = [...scope].filter(id => byId.has(id) && !nodeIds.has(id)).length;

  // Layer: one column right of the highest blocker. Kahn's queue over blocks relations, no recursion.
  // Blocking relations are acyclic (heist refuses cycles); a node on a cycle would keep a partial layer.
  const indegree = new Map([...nodeIds].map(id => [id, 0]));
  const outgoing = new Map();
  for (const r of kept) {
    if (r.type !== 'blocks') continue;
    if (!outgoing.has(r.sourceId)) outgoing.set(r.sourceId, []);
    outgoing.get(r.sourceId).push(r.targetId);
    indegree.set(r.targetId, indegree.get(r.targetId) + 1);
  }
  const layer = new Map([...nodeIds].map(id => [id, 0]));
  const queue = [...nodeIds].filter(id => indegree.get(id) === 0);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    for (const next of outgoing.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next), layer.get(id) + 1));
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  // Row: position inside the layer, ordered by ticket number, then id.
  const numberOf = id => byId.get(id).number ?? Number.MAX_SAFE_INTEGER;
  const byLayer = new Map();
  for (const id of nodeIds) {
    const l = layer.get(id);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(id);
  }
  const row = new Map();
  for (const ids of byLayer.values()) {
    ids.sort((a, b) => numberOf(a) - numberOf(b) || compare(a, b)).forEach((id, i) => row.set(id, i));
  }

  const all = [...nodeIds].map(id => {
    const t = byId.get(id);
    return { id, key: p.ticketKey(t), title: t.title, kind: t.kind ?? 'task', status: t.status, layer: layer.get(id), row: row.get(id) };
  }).sort((a, b) => a.layer - b.layer || a.row - b.row);

  const totalNodes = all.length;
  const nodes = all.slice(0, limit);
  const truncated = totalNodes > limit;
  const finalIds = new Set(nodes.map(n => n.id));
  const edges = kept
    .filter(r => finalIds.has(r.sourceId) && finalIds.has(r.targetId))
    .map(r => ({ sourceId: r.sourceId, targetId: r.targetId, type: r.type }))
    .sort((a, b) => compare(a.sourceId, b.sourceId) || compare(a.targetId, b.targetId) || compare(a.type, b.type));
  const layers = nodes.length ? Math.max(...nodes.map(n => n.layer)) + 1 : 0;

  return { nodes, edges, layers, hidden, totalNodes, truncated };
}
