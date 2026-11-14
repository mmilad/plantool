import { createHash } from 'node:crypto';
import { HeistError, NotFoundError, ValidationError } from './index.js';
import { isFinished, workGraph } from './workflow.js';

const EDGE_LIMIT = 500;
const compare = (a, b) => a.localeCompare(b, 'en', { numeric: true });

/** Read-only, bounded dependency projection. Edges point from blocker to blocked ticket. */
export async function dependencies(p, { root, includeFinished = false, limit = 200, snapshot } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new ValidationError('limit must be an integer from 1 to 200');
  if (typeof includeFinished !== 'boolean') throw new ValidationError('includeFinished must be a boolean');
  if (root !== undefined && root !== null && (typeof root !== 'string' || !root.trim())) throw new ValidationError('root must be a ticket id or key');
  if (snapshot !== undefined && typeof snapshot !== 'string') throw new ValidationError('snapshot must be a string');
  const rootId = root == null ? null : await p.resolveTicket(root.trim());
  const g = await workGraph(p);
  if (rootId && !g.byId.has(rootId)) throw new NotFoundError(`Ticket not found: ${root}`);

  const scope = new Set();
  if (rootId) {
    const pending = [rootId];
    while (pending.length) {
      const id = pending.pop();
      if (scope.has(id)) continue;
      scope.add(id);
      for (const child of g.children.get(id) ?? []) pending.push(child.id);
    }
  }
  const ancestors = new Set(rootId ? g.ancestors(rootId).map(t => t.id) : []);
  const grouped = new Map();
  const add = (edge, via) => {
    const source = g.byId.get(edge.sourceId), target = g.byId.get(edge.targetId);
    if (!source || !target || (!includeFinished && (isFinished(source) || isFinished(target)))) return;
    const touchesScope = !rootId || scope.has(source.id) || scope.has(target.id);
    const inherited = !!rootId && ancestors.has(target.id);
    if (!touchesScope && !inherited) return;
    const key = `${source.id}:${target.id}:${via}`;
    if (!grouped.has(key)) grouped.set(key, { sourceId: source.id, targetId: target.id, via, inherited, ...(via === 'provider' ? { components: [] } : {}) });
    const row = grouped.get(key);
    if (via === 'provider' && !row.components.some(c => c.id === edge.component && c.stage === edge.stage)) {
      row.components.push({ id: edge.component, name: g.design.names.get(edge.component) ?? edge.component, stage: edge.stage });
    }
  };
  for (const edge of g.explicitEdges) add(edge, 'blocks');
  for (const edge of g.design.providerEdges) add(edge, 'provider');
  const allEdges = [...grouped.values()].sort((a, b) => compare(a.sourceId, b.sourceId) || compare(a.targetId, b.targetId) || compare(a.via, b.via));
  for (const edge of allEdges) edge.components?.sort((a, b) => compare(a.id, b.id) || compare(a.stage, b.stage));

  const ids = new Set(rootId ? [rootId] : []);
  for (const edge of allEdges) { ids.add(edge.sourceId); ids.add(edge.targetId); }
  const rank = id => id === rootId ? 0 : !rootId || scope.has(id) ? 1 : 2;
  const allNodes = [...ids].map(id => {
    const t = g.byId.get(id);
    return { id, key: p.ticketKey(t), title: t.title, kind: t.kind ?? 'task', status: t.status, parentId: t.parentId ?? null, contextOnly: !!rootId && !scope.has(id) };
  }).sort((a, b) => rank(a.id) - rank(b.id) || compare(a.key ?? a.id, b.key ?? b.id) || compare(a.id, b.id));

  // Hash the entire scoped projection, not just its bounded prefix: hidden changes invalidate it too.
  const current = createHash('sha256').update(JSON.stringify({ rootId, includeFinished, limit, nodes: allNodes, edges: allEdges })).digest('hex').slice(0, 16);
  if (snapshot && snapshot !== current) throw new HeistError('Dependencies changed; refresh the dependency list', 'STALE_ROADMAP', { snapshot: current });
  const nodes = allNodes.slice(0, limit), kept = new Set(nodes.map(n => n.id));
  const edges = allEdges.filter(e => kept.has(e.sourceId) && kept.has(e.targetId)).slice(0, EDGE_LIMIT);
  const omittedNodes = allNodes.length - nodes.length, omittedEdges = allEdges.length - edges.length;
  return { nodes, edges, totalNodes: allNodes.length, totalEdges: allEdges.length, limit, edgeLimit: EDGE_LIMIT, truncated: omittedNodes > 0 || omittedEdges > 0, omittedNodes, omittedEdges, rootId, snapshot: current };
}
