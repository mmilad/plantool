import { ValidationError, NotFoundError, ConflictError, uuidv7, _store } from './index.js';

export const DEFAULT_COMPONENT_KINDS = Object.freeze(['module', 'service', 'class', 'method', 'function', 'ui-component']);
export const CODE_PLAN_KEYS = Object.freeze(['implements', 'consumes', 'changes']);
/** implements.stage: 'mock' is a stand-in with the contract's shape; 'full' is the real implementation (default). consumes.needs says which one a consumer waits for. */
export const CODE_STAGES = Object.freeze(['mock', 'full']);
const PRIMITIVES = ['string', 'number', 'integer', 'boolean', 'null', 'any'];
const SCHEMA_TYPES = [...PRIMITIVES, 'array', 'object'];
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kindsOf = p => p.config.componentKinds ?? DEFAULT_COMPONENT_KINDS;

// ---------- schema subset ----------

/**
 * Normalises a schema written in full JSON-Schema-subset form or in shorthand:
 *   "string" | "string?" | "string[]" | "User" | ["User"] | { field: <shorthand>, ... }
 * Full form: { type, properties, required, items, enum, description } or { $ref: "TypeName" }.
 */
export function normalizeSchema(input, where = 'schema') {
  const fail = msg => { throw new ValidationError(`${where}: ${msg}`); };
  if (typeof input === 'string') {
    let s = input.trim(); if (s.endsWith('?')) fail('"?" marks optional object properties only');
    if (s.endsWith('[]')) return { type: 'array', items: normalizeSchema(s.slice(0, -2), where) };
    if (PRIMITIVES.includes(s)) return { type: s };
    if (NAME_RE.test(s)) return { $ref: s };
    fail(`unknown type "${input}"`);
  }
  if (Array.isArray(input)) { if (input.length !== 1) fail('array shorthand needs exactly one item type'); return { type: 'array', items: normalizeSchema(input[0], `${where}[]`) }; }
  if (!input || typeof input !== 'object') fail('must be a type name, an array or an object');
  if (typeof input.$ref === 'string') { if (!NAME_RE.test(input.$ref)) fail(`invalid $ref "${input.$ref}"`); return { $ref: input.$ref }; }
  if (typeof input.type === 'string' && SCHEMA_TYPES.includes(input.type)) {
    const out = { type: input.type };
    if (input.description !== undefined) out.description = String(input.description);
    if (input.enum !== undefined) { if (!Array.isArray(input.enum) || !input.enum.length) fail('enum must be a non-empty array'); out.enum = [...input.enum]; }
    if (input.type === 'array') out.items = normalizeSchema(input.items ?? 'any', `${where}[]`);
    if (input.type === 'object') {
      out.properties = {};
      for (const [k, v] of Object.entries(input.properties ?? {})) out.properties[k] = normalizeSchema(v, `${where}.${k}`);
      const req = input.required ?? [];
      if (!Array.isArray(req) || req.some(x => !(x in out.properties))) fail('required must list existing properties');
      out.required = [...new Set(req)];
    }
    return out;
  }
  const out = { type: 'object', properties: {}, required: [] };
  for (const [rawKey, v] of Object.entries(input)) {
    let key = rawKey, optional = false, value = v;
    if (typeof v === 'string' && v.trim().endsWith('?')) { optional = true; value = v.trim().slice(0, -1); }
    if (key.endsWith('?')) { optional = true; key = key.slice(0, -1); }
    out.properties[key] = normalizeSchema(value, `${where}.${key}`);
    if (!optional) out.required.push(key);
  }
  return out;
}

function refs(schema, acc = new Set()) {
  if (!schema || typeof schema !== 'object') return acc;
  if (schema.$ref) acc.add(schema.$ref);
  if (schema.items) refs(schema.items, acc);
  for (const v of Object.values(schema.properties ?? {})) refs(v, acc);
  return acc;
}

function deref(schema, types, seen = new Set()) {
  while (schema?.$ref) { if (seen.has(schema.$ref)) return null; seen.add(schema.$ref); schema = types.get(schema.$ref)?.schema ?? null; }
  return schema;
}

/** Follows a dotted path through objects, $refs and (implicitly) array items. */
export function schemaAt(schema, path, types) {
  let cur = deref(schema, types);
  for (const seg of path) {
    while (cur?.type === 'array') cur = deref(cur.items, types);
    if (!cur || cur.type !== 'object' || !cur.properties || !(seg in cur.properties)) return null;
    cur = deref(cur.properties[seg], types);
  }
  return cur;
}

const compatible = (actual, wanted) => wanted === 'any' || actual === 'any' || actual === wanted || (wanted === 'number' && actual === 'integer');
const describe = s => !s ? 'unknown' : s.type === 'array' ? `${describe(s.items?.$ref ? { type: s.items.$ref } : s.items)}[]` : s.type ?? s.$ref;

// ---------- change classification ----------

const assignable = (from, to) => to === 'any' || from === to || (from === 'integer' && to === 'number');

/**
 * Compares two versions of a schema. side 'output': consumers read the value, so removing,
 * making optional or widening is breaking. side 'input': consumers supply the value, so new
 * required fields or narrowing is breaking.
 */
export function diffSchemas(before, after, { side, typesBefore, typesAfter }) {
  const changes = [], visited = new Set();
  const walk = (o, n, path) => {
    const key = `${path}|${o?.$ref ?? ''}|${n?.$ref ?? ''}`; if (visited.has(key) || path.split('.').length > 32) return; visited.add(key);
    o = deref(o, typesBefore); n = deref(n, typesAfter); if (!o || !n) return;
    const add = (change, breaking, extra = {}) => changes.push({ side, path, change, breaking, ...extra });
    if (o.type !== n.type) {
      const ok = side === 'output' ? assignable(n.type, o.type) : assignable(o.type, n.type);
      add('type', !ok, { from: describe(o), to: describe(n) }); return;
    }
    if (o.enum || n.enum) {
      const ov = o.enum ?? null, nv = n.enum ?? null;
      const added = nv && ov ? nv.filter(x => !ov.includes(x)) : [], removed = ov && nv ? ov.filter(x => !nv.includes(x)) : [];
      if (!ov && nv) add('enum-restricted', side === 'input'); else if (ov && !nv) add('enum-removed', side === 'output');
      if (added.length) add('enum-values-added', side === 'output', { values: added });
      if (removed.length) add('enum-values-removed', side === 'input', { values: removed });
    }
    if (o.type === 'array') { walk(o.items, n.items, path); return; }
    if (o.type !== 'object') return;
    const op = o.properties ?? {}, np = n.properties ?? {}, or = new Set(o.required ?? []), nr = new Set(n.required ?? []);
    const at = k => (path ? `${path}.${k}` : k);
    for (const k of Object.keys(op)) {
      if (!(k in np)) { changes.push({ side, path: at(k), change: 'removed', breaking: side === 'output' }); continue; }
      if (or.has(k) && !nr.has(k)) changes.push({ side, path: at(k), change: 'now-optional', breaking: side === 'output' });
      if (!or.has(k) && nr.has(k)) changes.push({ side, path: at(k), change: 'now-required', breaking: side === 'input' });
      walk(op[k], np[k], at(k));
    }
    for (const k of Object.keys(np)) if (!(k in op)) changes.push({ side, path: at(k), change: nr.has(k) ? 'added-required' : 'added', breaking: side === 'input' && nr.has(k) });
  };
  walk(before, after, '');
  return changes;
}

/** Open consumer tickets that a set of breaking changes to one component may break. */
function affectedConsumers(tickets, componentId, changes) {
  const breaking = changes.filter(c => c.breaking); if (!breaking.length) return [];
  const out = [];
  for (const t of tickets) {
    if (t.status === 'done' || t.status === 'cancelled') continue;
    for (const e of t.codePlan?.consumes ?? []) {
      if (e.component !== componentId) continue;
      const reasons = [];
      for (const c of breaking) {
        if (c.side === 'output') {
          const hit = (e.requires ?? []).map(r => r.split(':')[0].trim()).filter(r => !c.path || r === c.path || r.startsWith(`${c.path}.`) || c.path.startsWith(`${r}.`));
          if (hit.length) reasons.push(`output.${c.path || '(root)'} ${c.change} (requires ${hit.join(', ')})`);
        } else if (!e.provides) reasons.push(`input.${c.path || '(root)'} ${c.change} (ticket does not declare provides)`);
        else if (c.change === 'added-required' || c.change === 'now-required' ? !e.provides.includes(c.path) : e.provides.some(f => !c.path || f === c.path || f.startsWith(`${c.path}.`))) reasons.push(`input.${c.path || '(root)'} ${c.change}`);
      }
      if (reasons.length) out.push({ ticketId: t.id, title: t.title, reasons });
    }
  }
  return out;
}

function summarise(changes, consumers) { return { breaking: changes.some(c => c.breaking), changes, affectedConsumers: consumers }; }

// ---------- records ----------

function componentApi(p) {
  const api = {
    async list() { return _store.list(p, 'components'); },
    async get(id) { return _store.get(p, 'components', id); },
    async create(input) {
      const kinds = kindsOf(p);
      if (!kinds.includes(input?.kind)) throw new ValidationError(`Component kind must be one of: ${kinds.join(', ')}`);
      if (!NAME_RE.test(input.name ?? '')) throw new ValidationError(`Invalid component name "${input.name}" (letters, digits, _ and -; no dots)`);
      const all = await api.list();
      const parentId = input.parentId ? (await api.resolve(input.parentId, all)).id : null;
      if (all.some(c => c.parentId === parentId && c.name === input.name)) throw new ConflictError(`A component named ${input.name} already exists here`);
      const now = new Date().toISOString();
      return _store.create(p, 'components', { schemaVersion: 1, id: uuidv7(), kind: input.kind, name: input.name, description: input.description ?? '', parentId, createdAt: now, updatedAt: now });
    },
    async update(ref, patch) {
      const all = await api.list(), c = await api.resolve(ref, all);
      const next = { ...c, ...patch, id: c.id, schemaVersion: 1, createdAt: c.createdAt, updatedAt: new Date().toISOString() };
      if (!kindsOf(p).includes(next.kind)) throw new ValidationError(`Unknown component kind: ${next.kind}`);
      if (!NAME_RE.test(next.name)) throw new ValidationError(`Invalid component name "${next.name}"`);
      if (next.parentId && next.parentId !== c.parentId) {
        next.parentId = (await api.resolve(next.parentId, all)).id;
        const byId = new Map(all.map(x => [x.id, x])); for (let cur = next.parentId; cur; cur = byId.get(cur)?.parentId) if (cur === c.id) throw new ValidationError('Component parent would create a cycle');
      }
      if (all.some(x => x.id !== c.id && x.parentId === next.parentId && x.name === next.name)) throw new ConflictError(`A component named ${next.name} already exists here`);
      return _store.write(p, 'components', next);
    },
    /** Accepts a UUID, a qualified name (UserService.getUser) or a unique short name. */
    async resolve(ref, all) {
      all ??= await api.list();
      if (UUID_RE.test(ref)) { const c = all.find(x => x.id === ref); if (!c) throw new NotFoundError(`Component not found: ${ref}`); return c; }
      const q = qualifiedNames(all);
      const exact = all.filter(c => q.get(c.id) === ref);
      if (exact.length === 1) return exact[0];
      const short = all.filter(c => c.name === ref);
      if (short.length === 1) return short[0];
      if (short.length > 1) throw new ValidationError(`Component name ${ref} is ambiguous: ${short.map(c => q.get(c.id)).join(', ')}`);
      throw new NotFoundError(`Component not found: ${ref}`);
    },
  };
  return api;
}

export function qualifiedNames(components) {
  const byId = new Map(components.map(c => [c.id, c])), out = new Map();
  for (const c of components) { const parts = []; const seen = new Set(); for (let cur = c; cur && !seen.has(cur.id); cur = byId.get(cur.parentId)) { seen.add(cur.id); parts.unshift(cur.name); } out.set(c.id, parts.join('.')); }
  return out;
}

function typeApi(p) {
  const api = {
    async list() { return _store.list(p, 'types'); },
    async get(name) { const t = (await api.list()).find(x => x.name === name); if (!t) throw new NotFoundError(`Type not found: ${name}`); return t; },
    async set(name, schema, { description, dryRun = false } = {}) {
      if (!NAME_RE.test(name ?? '') || PRIMITIVES.includes(name)) throw new ValidationError(`Invalid type name "${name}"`);
      const normal = normalizeSchema(schema, name), all = await api.list(), current = all.find(x => x.name === name), now = new Date().toISOString();
      if (!current) { const rec = { schemaVersion: 1, id: uuidv7(), name, version: 1, description: description ?? '', schema: normal, history: [], createdAt: now, updatedAt: now }; if (!dryRun) await _store.create(p, 'types', rec); return { ...rec, impact: summarise([], []) }; }
      const changed = JSON.stringify(normal) !== JSON.stringify(current.schema), version = (current.version ?? 1) + (changed ? 1 : 0);
      const rec = { ...current, version, schema: normal, description: description ?? current.description, history: changed ? [...(current.history ?? []), { version: current.version ?? 1, schema: current.schema, updatedAt: current.updatedAt }] : (current.history ?? []), updatedAt: now };
      // impact: every contract whose input or output reaches this type
      const typesBefore = new Map(all.map(x => [x.name, x])), typesAfter = new Map(typesBefore); typesAfter.set(name, rec);
      const tickets = await p.tickets.list({ limit: Infinity }), changes = [], consumers = [];
      if (changed) for (const k of await p.contracts.list()) {
        const c = [...diffSchemas(k.input, k.input, { side: 'input', typesBefore, typesAfter }), ...diffSchemas(k.output, k.output, { side: 'output', typesBefore, typesAfter })].map(x => ({ ...x, componentId: k.componentId }));
        changes.push(...c); consumers.push(...affectedConsumers(tickets, k.componentId, c).map(x => ({ ...x, componentId: k.componentId })));
      }
      if (!dryRun) await _store.write(p, 'types', rec);
      return { ...rec, impact: summarise(changes, consumers) };
    },
  };
  return api;
}

function contractApi(p) {
  const api = {
    async list() { return _store.list(p, 'contracts'); },
    async get(componentRef) { const c = await p.components.resolve(componentRef); const k = (await api.list()).find(x => x.componentId === c.id); if (!k) throw new NotFoundError(`No contract for ${componentRef}`); return k; },
    /** Creates or replaces the contract of a component; the version increases when input or output change. */
    async set(componentRef, { input, output, description, dryRun = false } = {}) {
      const comp = await p.components.resolve(componentRef), all = await api.list(), current = all.find(x => x.componentId === comp.id), now = new Date().toISOString();
      const next = { input: normalizeSchema(input ?? current?.input ?? {}, 'input'), output: normalizeSchema(output ?? current?.output ?? 'null', 'output') };
      if (!current) { const rec = { schemaVersion: 1, id: uuidv7(), componentId: comp.id, version: 1, description: description ?? '', ...next, history: [], createdAt: now, updatedAt: now }; if (!dryRun) await _store.create(p, 'contracts', rec); return { ...rec, impact: summarise([], []) }; }
      const changed = JSON.stringify(next) !== JSON.stringify({ input: current.input, output: current.output });
      const types = new Map((await p.types.list()).map(x => [x.name, x])), ctx = { typesBefore: types, typesAfter: types };
      const changes = changed ? [...diffSchemas(current.input, next.input, { ...ctx, side: 'input' }), ...diffSchemas(current.output, next.output, { ...ctx, side: 'output' })] : [];
      const rec = { ...current, ...next, description: description ?? current.description, version: current.version + (changed ? 1 : 0), history: changed ? [...(current.history ?? []), { version: current.version, input: current.input, output: current.output, updatedAt: current.updatedAt }] : (current.history ?? []), updatedAt: now };
      if (!dryRun) await _store.write(p, 'contracts', rec);
      return { ...rec, impact: summarise(changes, affectedConsumers(await p.tickets.list({ limit: Infinity }), comp.id, changes)) };
    },
  };
  return api;
}

// ---------- ticket code plans ----------

function normalizeEntry(key, entry) {
  const stage = entry.stage, needs = entry.needs;
  if (stage !== undefined && (key !== 'implements' || !CODE_STAGES.includes(stage))) throw new ValidationError(`stage applies to implements only and must be one of: ${CODE_STAGES.join(', ')}`);
  if (needs !== undefined && (key !== 'consumes' || !CODE_STAGES.includes(needs))) throw new ValidationError(`needs applies to consumes only and must be one of: ${CODE_STAGES.join(', ')}`);
  if (key !== 'consumes') return { component: entry.component, ...(stage !== undefined ? { stage } : {}) };
  const list = (v, what) => { if (v === undefined) return undefined; if (!Array.isArray(v) || v.some(x => typeof x !== 'string' || !x.trim())) throw new ValidationError(`consumes.${what} must be a list of field paths`); return [...new Set(v.map(x => x.trim()))]; };
  const out = { component: entry.component, requires: list(entry.requires ?? [], 'requires') };
  const provides = list(entry.provides, 'provides'); if (provides) out.provides = provides;
  if (needs !== undefined) out.needs = needs;
  return out;
}

export function validateCodePlanShape(plan) {
  if (plan == null) return;
  if (typeof plan !== 'object' || Array.isArray(plan)) throw new ValidationError('Ticket codePlan must be an object');
  for (const key of Object.keys(plan)) {
    if (!CODE_PLAN_KEYS.includes(key)) throw new ValidationError(`Unknown codePlan key: ${key}`);
    if (!Array.isArray(plan[key])) throw new ValidationError(`codePlan.${key} must be a list`);
    for (const e of plan[key]) if (!e || typeof e.component !== 'string' || !UUID_RE.test(e.component)) throw new ValidationError(`codePlan.${key} entries need a component id`);
    for (const e of plan[key]) { if (e.stage !== undefined && (key !== 'implements' || !CODE_STAGES.includes(e.stage))) throw new ValidationError(`codePlan.${key} stage must be mock or full (implements only)`); if (e.needs !== undefined && (key !== 'consumes' || !CODE_STAGES.includes(e.needs))) throw new ValidationError(`codePlan.${key} needs must be mock or full (consumes only)`); }
  }
}

function codePlanApi(p) {
  return {
    async get(ticketId) { return (await p.tickets.get(ticketId)).codePlan ?? {}; },
    /** add(ticket, 'consumes', 'UserService.getUser', { requires: ['userId', 'email'], provides: ['userId'] }) */
    async add(ticketId, key, componentRef, options = {}) {
      if (!CODE_PLAN_KEYS.includes(key)) throw new ValidationError(`Code plan entry must be one of: ${CODE_PLAN_KEYS.join(', ')}`);
      const comp = await p.components.resolve(componentRef);
      const { ticket, revision } = await p.tickets.getVersioned(ticketId);
      const plan = structuredClone(ticket.codePlan ?? {});
      const entry = normalizeEntry(key, { ...options, component: comp.id });
      plan[key] = [...(plan[key] ?? []).filter(e => e.component !== comp.id), entry];
      return p.tickets.update(ticketId, { codePlan: plan }, { expectedRevision: revision, force: true });
    },
    async remove(ticketId, key, componentRef) {
      const comp = await p.components.resolve(componentRef);
      const { ticket, revision } = await p.tickets.getVersioned(ticketId);
      const plan = structuredClone(ticket.codePlan ?? {});
      plan[key] = (plan[key] ?? []).filter(e => e.component !== comp.id); if (!plan[key].length) delete plan[key];
      return p.tickets.update(ticketId, { codePlan: Object.keys(plan).length ? plan : null }, { expectedRevision: revision, force: true });
    },
  };
}

// ---------- design model shared by check, readiness and context ----------

export async function designModel(p, tickets) {
  const [components, types, contracts] = await Promise.all([p.components.list(), p.types.list(), p.contracts.list()]);
  tickets ??= await p.tickets.list({ limit: Infinity });
  const byId = new Map(components.map(c => [c.id, c]));
  const typeMap = new Map(types.map(t => [t.name, t]));
  const contractOf = new Map(contracts.map(c => [c.componentId, c]));
  const names = qualifiedNames(components);
  const selfAndAncestors = id => { const out = []; const seen = new Set(); for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(cur.parentId)) { seen.add(cur.id); out.push(cur.id); } return out; };
  const implementers = new Map();
  for (const t of tickets) for (const e of t.codePlan?.implements ?? []) { if (!implementers.has(e.component)) implementers.set(e.component, []); implementers.get(e.component).push(t); }
  /** Tickets that build the component or one of its ancestors. */
  const providersOf = componentId => [...new Set(selfAndAncestors(componentId).flatMap(id => implementers.get(id) ?? []))];
  /** Implicit dependency edges provider ticket -> consumer ticket. */
  const providerEdges = [];
  const stageOf = (ticket, componentId) => { const ids = selfAndAncestors(componentId); const own = (ticket.codePlan?.implements ?? []).filter(x => ids.includes(x.component)); return own.length && own.every(x => x.stage === 'mock') ? 'mock' : 'full'; };
  for (const t of tickets) for (const e of t.codePlan?.consumes ?? []) {
    const provs = providersOf(e.component).filter(prov => prov.id !== t.id);
    const wanted = e.needs ?? 'full';
    let chosen = provs.filter(prov => stageOf(prov, e.component) === wanted);
    if (!chosen.length && wanted === 'mock') chosen = provs.filter(prov => stageOf(prov, e.component) === 'full');
    for (const prov of chosen) providerEdges.push({ sourceId: prov.id, targetId: t.id, component: e.component, stage: stageOf(prov, e.component) });
  }
  return { components, types, contracts, byId, typeMap, contractOf, names, providersOf, providerEdges, tickets };
}

export async function checkProject(p) {
  const tickets = await p.tickets.list({ limit: Infinity });
  const m = await designModel(p, tickets);
  const errors = [], warnings = [];
  const err = (code, message, extra = {}) => errors.push({ code, message, ...extra });
  const warn = (code, message, extra = {}) => warnings.push({ code, message, ...extra });
  const name = id => m.names.get(id) ?? id;
  const kinds = kindsOf(p);

  for (const c of m.components) {
    if (!kinds.includes(c.kind)) err('UNKNOWN_COMPONENT_KIND', `${name(c.id)} has unknown kind ${c.kind}`, { componentId: c.id });
    if (c.parentId && !m.byId.has(c.parentId)) err('MISSING_COMPONENT_PARENT', `${name(c.id)} refers to missing parent ${c.parentId}`, { componentId: c.id });
    const parent = m.byId.get(c.parentId);
    if (c.kind === 'method' && !['class', 'service'].includes(parent?.kind)) err('METHOD_WITHOUT_OWNER', `Method ${name(c.id)} must belong to a class or service`, { componentId: c.id });
    const kids = m.components.filter(x => x.parentId === c.id);
    if (['service', 'class'].includes(c.kind) && !kids.some(x => x.kind === 'method')) warn('NO_METHODS', `${c.kind} ${name(c.id)} has no methods`, { componentId: c.id });
    if (['method', 'function'].includes(c.kind) && !m.contractOf.has(c.id)) warn('CONTRACT_MISSING', `${c.kind} ${name(c.id)} has no contract`, { componentId: c.id });
  }
  for (const k of m.contracts) {
    if (!m.byId.has(k.componentId)) err('CONTRACT_WITHOUT_COMPONENT', `Contract ${k.id} refers to missing component ${k.componentId}`, { contractId: k.id });
    for (const r of [...refs(k.input), ...refs(k.output)]) if (!m.typeMap.has(r)) err('UNKNOWN_TYPE', `Contract of ${name(k.componentId)} uses unknown type ${r}`, { componentId: k.componentId, type: r });
  }
  for (const t of m.types) for (const r of refs(t.schema)) if (!m.typeMap.has(r)) err('UNKNOWN_TYPE', `Type ${t.name} uses unknown type ${r}`, { type: r });

  for (const t of tickets) {
    const plan = t.codePlan ?? {};
    for (const key of CODE_PLAN_KEYS) for (const e of plan[key] ?? []) if (!m.byId.has(e.component)) err('UNKNOWN_COMPONENT', `Ticket ${t.id} ${key} missing component ${e.component}`, { ticketId: t.id });
    for (const e of plan.implements ?? []) {
      const c = m.byId.get(e.component); if (!c) continue;
      if (['method', 'function'].includes(c.kind) && !m.contractOf.has(c.id)) warn('IMPLEMENTS_WITHOUT_CONTRACT', `Ticket ${t.id} implements ${name(c.id)} before its contract is defined`, { ticketId: t.id, componentId: c.id });
    }
    for (const e of plan.consumes ?? []) {
      const c = m.byId.get(e.component); if (!c) continue;
      const k = m.contractOf.get(c.id);
      if (!k) { err('CONSUMES_WITHOUT_CONTRACT', `Ticket ${t.id} consumes ${name(c.id)}, which has no contract`, { ticketId: t.id, componentId: c.id }); continue; }
      for (const raw of e.requires ?? []) {
        const [field, wanted] = raw.split(':').map(s => s.trim());
        const at = schemaAt(k.output, field.split('.'), m.typeMap);
        if (!at) {
          const top = deref(k.output, m.typeMap);
          const offered = top?.type === 'object' ? Object.keys(top.properties ?? {}).join(', ') : describe(top);
          err('REQUIRED_FIELD_MISSING', `Ticket ${t.id} needs ${name(c.id)} → output.${field}, but the contract returns: ${offered || 'nothing'}`, { ticketId: t.id, componentId: c.id, field });
        } else if (wanted && !compatible(at.type, wanted)) err('REQUIRED_FIELD_TYPE', `Ticket ${t.id} needs ${name(c.id)} → output.${field} as ${wanted}, contract has ${describe(at)}`, { ticketId: t.id, componentId: c.id, field, expected: wanted, actual: describe(at) });
      }
      if (e.provides) {
        const input = deref(k.input, m.typeMap);
        const missing = (input?.required ?? []).filter(f => !e.provides.includes(f));
        if (missing.length) err('INPUT_NOT_PROVIDED', `Ticket ${t.id} calls ${name(c.id)} without required input: ${missing.join(', ')}`, { ticketId: t.id, componentId: c.id, missing });
        const unknown = e.provides.filter(f => !schemaAt(k.input, f.split('.'), m.typeMap));
        if (unknown.length) warn('INPUT_UNKNOWN', `Ticket ${t.id} provides ${unknown.join(', ')}, which ${name(c.id)} does not accept`, { ticketId: t.id, componentId: c.id, unknown });
      }
      if (!m.providersOf(c.id).length) warn('NO_PROVIDER', `${name(c.id)} is consumed by ticket ${t.id} but no ticket implements it`, { ticketId: t.id, componentId: c.id });
    }
    for (const e of plan.changes ?? []) {
      const consumers = tickets.filter(x => x.id !== t.id && x.status !== 'done' && x.status !== 'cancelled' && (x.codePlan?.consumes ?? []).some(y => y.component === e.component));
      if (consumers.length) warn('CHANGE_AFFECTS_CONSUMERS', `Ticket ${t.id} changes ${name(e.component)}; affected open consumer tickets: ${consumers.map(x => x.id).join(', ')}`, { ticketId: t.id, componentId: e.component, consumers: consumers.map(x => x.id) });
    }
  }
  // provider/consumer edges combined with explicit blocks must not deadlock
  const rels = (await p.relations.list()).filter(r => r.type === 'blocks');
  const adj = new Map(); for (const r of [...rels, ...m.providerEdges]) { if (!adj.has(r.sourceId)) adj.set(r.sourceId, []); adj.get(r.sourceId).push(r.targetId); }
  const state = new Map(), cyclic = new Set();
  for (const start of adj.keys()) { if (state.get(start)) continue; const stack = [[start, 0]]; state.set(start, 1);
    while (stack.length) { const top = stack.at(-1), edges = adj.get(top[0]) ?? []; if (top[1] >= edges.length) { state.set(top[0], 2); stack.pop(); continue; } const n = edges[top[1]++], s = state.get(n) ?? 0; if (s === 1) { cyclic.add(top[0]); cyclic.add(n); } else if (s === 0) { state.set(n, 1); stack.push([n, 0]); } } }
  if (cyclic.size) err('DEPENDENCY_CYCLE', `Provider/consumer and blocking dependencies form a cycle between tickets: ${[...cyclic].sort().join(', ')}`, { tickets: [...cyclic].sort() });

  for (const w of await p.blueprints?.check?.() ?? []) if (w.code !== 'BLUEPRINT_SUGGESTED') warnings.push(w);
  return { valid: errors.length === 0, errors, warnings, counts: { components: m.components.length, types: m.types.length, contracts: m.contracts.length, ticketsWithCodePlan: tickets.filter(t => t.codePlan && Object.keys(t.codePlan).length).length } };
}

/** Resolved code plan for context packets. */
export async function resolvedCodePlan(p, ticket) {
  const plan = ticket.codePlan ?? {}; if (!Object.keys(plan).length) return null;
  const m = await designModel(p);
  const typeNames = new Set();
  const comp = id => { const c = m.byId.get(id), k = m.contractOf.get(id); if (k) for (const r of [...refs(k.input), ...refs(k.output)]) typeNames.add(r); return { id, name: m.names.get(id) ?? id, kind: c?.kind ?? null, contract: k ? { version: k.version, input: k.input, output: k.output } : null }; };
  const out = {};
  for (const key of CODE_PLAN_KEYS) if (plan[key]?.length) out[key] = plan[key].map(e => ({ ...comp(e.component), ...(e.requires ? { requires: e.requires } : {}), ...(e.provides ? { provides: e.provides } : {}), ...(key === 'consumes' ? { providerTickets: m.providersOf(e.component).map(t => ({ id: t.id, title: t.title, status: t.status })) } : {}) }));
  const seen = new Set(); const queue = [...typeNames]; out.types = {};
  while (queue.length) { const n = queue.pop(); if (seen.has(n)) continue; seen.add(n); const t = m.typeMap.get(n); if (!t) continue; out.types[n] = t.schema; queue.push(...refs(t.schema)); }
  return out;
}

export function attachDesignApi(p) {
  p.components = componentApi(p);
  p.types = typeApi(p);
  p.contracts = contractApi(p);
  p.codePlan = codePlanApi(p);
  p.check = () => checkProject(p);
}
