// Blueprints: what is expected of a ticket of a kind, like an issue or pull request template.
// A blueprint names the fields a task, feature, bug or decision should have filled, and may carry a template for the description.
// It complements checklists: a blueprint describes the ticket itself, a checklist the parts it breaks into.
// Built-in blueprints ship with heist; a project replaces one with .heist/blueprints/<kind>.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ValidationError, NotFoundError, HeistError } from './index.js';
import { fieldsFor } from './fields.js';

const KINDS = ['task', 'feature', 'bug', 'decision', 'option'];
const expect = (field, hint, extra = {}) => ({ field, hint, ...extra });
export const BUILTIN_BLUEPRINTS = Object.freeze([
  {
    kind: 'task', title: 'Task', description: 'One piece of work an agent can finish and verify.',
    expects: [
      expect('why', 'The reason this exists; what breaks or is missing without it.'),
      expect('acceptance', 'Checkable conditions for "done".', { when: 'leaf' }),
      expect('files', 'Files or folders the work is expected to touch.', { optional: true }),
      expect('size', 'Rough effort (xs, s, m, l, xl).', { optional: true }),
    ],
  },
  {
    kind: 'feature', title: 'Feature', description: 'Something a user can do that they could not do before.',
    expects: [
      expect('why', 'Who needs it and what it is for.'),
      expect('description', 'What the user does and what happens, step by step, including what happens outside the happy path.'),
      expect('acceptance', 'How it is proven to work.', { when: 'leaf' }),
      expect('risks', 'What could go wrong with this feature.', { optional: true }),
      expect('size', 'Rough effort (xs, s, m, l, xl).', { optional: true }),
    ],
  },
  {
    kind: 'bug', title: 'Bug', description: 'Something that behaves differently from what was meant.',
    expects: [
      expect('repro', 'Steps to reproduce, expected and actual behaviour.'),
      expect('acceptance', 'How the fix is shown to work.', { when: 'leaf' }),
      expect('why', 'Who is affected and how badly.', { optional: true }),
      expect('files', 'Where the cause is suspected.', { optional: true }),
    ],
  },
  {
    kind: 'decision', title: 'Decision', description: 'A question with options.',
    expects: [
      expect('why', 'Why this has to be decided, and what waits for it.'),
      expect('risks', 'What a wrong choice would cost.', { optional: true }),
    ],
  },
]);
const FLAGS = { description: '--description', why: '--why', acceptance: '--accept "a;b"', files: '--files a,b', size: '--size', risks: '--risks "a;b"', assumptions: '--assume "a;b"', refs: '--refs a,b', repro: '--steps "a;b" --expected T --actual T', evaluation: '--evaluation' };

function validateBlueprint(bp, config, source) {
  const where = source ? ` (${source})` : '';
  if (!bp || typeof bp !== 'object' || Array.isArray(bp)) throw new ValidationError(`Blueprint must be an object${where}`);
  if (Array.isArray(bp.items)) throw new ValidationError(`This file looks like a checklist (it has items). Checklists live in .heist/checklists/${where}`);
  if (!KINDS.includes(bp.kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}${where}`);
  if (bp.template !== undefined && typeof bp.template !== 'string') throw new ValidationError(`Blueprint ${bp.kind}: template must be text${where}`);
  if (!Array.isArray(bp.expects)) throw new ValidationError(`Blueprint ${bp.kind} needs an expects array${where}`);
  const known = new Set(['description', ...fieldsFor(bp.kind, config).map(f => f.name)]); const seen = new Set();
  for (const e of bp.expects) {
    if (!e || typeof e.field !== 'string' || !known.has(e.field)) throw new ValidationError(`Blueprint ${bp.kind}: unknown field ${e?.field}; a ${bp.kind} has ${[...known].join(', ')}${where}`);
    if (seen.has(e.field)) throw new ValidationError(`Blueprint ${bp.kind}: field ${e.field} is listed twice${where}`);
    seen.add(e.field);
    if (e.hint !== undefined && typeof e.hint !== 'string') throw new ValidationError(`Blueprint ${bp.kind}: hint of ${e.field} must be text${where}`);
    if (e.when !== undefined && e.when !== 'leaf') throw new ValidationError(`Blueprint ${bp.kind}: when of ${e.field} can only be "leaf"${where}`);
  }
}

const filled = (v, template) => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return !!v.trim() && v.trim() !== String(template ?? '').trim();
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(x => filled(x));
  return true;
};

export function attachBlueprintApi(p) {
  const dir = path.join(p.dir, 'blueprints');
  async function all() {
    const map = new Map(BUILTIN_BLUEPRINTS.map(b => [b.kind, { ...b, source: 'built-in' }]));
    let names = [];
    try { names = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    for (const f of names.sort()) {
      let bp; try { bp = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8')); } catch (e) { throw new ValidationError(`Blueprint file ${f} is not valid JSON: ${e.message}`); }
      validateBlueprint(bp, p.config, `.heist/blueprints/${f}`);
      if (`${bp.kind}.json` !== f) throw new ValidationError(`Blueprint file ${f} must be named ${bp.kind}.json`);
      map.set(bp.kind, { ...bp, source: 'project' });
    }
    return map;
  }
  /** What the blueprint of the ticket's kind expects and which of it is still empty. `tickets` avoids re-reading the plan in loops. */
  async function expected(ticketOrRef, { tickets, blueprints } = {}) {
    const ticket = typeof ticketOrRef === 'object' ? ticketOrRef : await p.tickets.get(ticketOrRef);
    const kind = ticket.kind ?? 'task'; const bp = (blueprints ?? await all()).get(kind);
    if (!bp) return { ticketId: ticket.id, kind, blueprint: null, items: [], missing: [], optional: [] };
    const hasChildren = (tickets ?? await p.tickets.list({ limit: Infinity })).some(t => t.parentId === ticket.id);
    const defs = new Map(fieldsFor(kind, p.config).map(f => [f.name, f]));
    const items = bp.expects.filter(e => !(e.when === 'leaf' && hasChildren)).map(e => {
      const def = defs.get(e.field); const value = e.field === 'description' ? ticket.description : def?.custom ? ticket.properties?.[e.field] : ticket[e.field];
      return { field: e.field, label: def?.label ?? 'Description', hint: e.hint ?? def?.help ?? '', optional: !!e.optional, filled: filled(value, e.field === 'description' ? bp.template : undefined), flag: FLAGS[e.field] ?? `--set ${e.field}=VALUE` };
    });
    return { ticketId: ticket.id, kind, blueprint: { kind, title: bp.title ?? kind, source: bp.source }, items, missing: items.filter(i => !i.filled && !i.optional).map(i => i.field), optional: items.filter(i => !i.filled && i.optional).map(i => i.field) };
  }
  p.blueprints = {
    async list() { return [...(await all()).values()].map(b => ({ kind: b.kind, title: b.title ?? b.kind, description: b.description ?? '', source: b.source, expects: b.expects.filter(e => !e.optional).map(e => e.field), optional: b.expects.filter(e => e.optional).map(e => e.field), template: !!b.template })); },
    async get(kind) { const bp = (await all()).get(kind); if (!bp) throw new NotFoundError(`No blueprint for kind ${kind}`); return bp; },
    /** The description a new ticket of this kind starts with, or undefined. */
    async template(kind) { return (await all()).get(kind ?? 'task')?.template; },
    expected,
    /** Write the built-in blueprint of a kind into .heist/blueprints/ so the project can change what it expects. */
    async init(kind) {
      if (!KINDS.includes(kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}`);
      const base = BUILTIN_BLUEPRINTS.find(b => b.kind === kind) ?? { kind, title: kind, description: '', expects: [{ field: 'why', hint: 'The reason this exists.' }] };
      const file = path.join(dir, `${kind}.json`);
      await fs.mkdir(dir, { recursive: true });
      try { await fs.writeFile(file, `${JSON.stringify({ ...structuredClone(base), template: base.template ?? '' }, null, 2)}\n`, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') throw new HeistError(`Blueprint ${kind} already exists in .heist/blueprints/`, 'CONFLICT'); throw e; }
      return { kind, file: path.relative(p.root, file).split(path.sep).join('/') };
    },
    /** Open tickets that lack something their blueprint expects (required fields only). */
    async check() {
      const tickets = await p.tickets.list({ limit: Infinity }); const blueprints = await all(); const rows = [];
      for (const t of tickets) {
        if (['done', 'cancelled'].includes(t.status)) continue;
        const e = await expected(t, { tickets, blueprints });
        if (e.missing.length) rows.push({ ticketId: t.id, key: p.ticketKey(t), title: t.title, kind: e.kind, missing: e.missing });
      }
      return rows;
    },
  };
}
