// Blueprints: what is expected of a ticket of a kind, like an issue or pull request template.
// A blueprint names the fields a task, feature, bug or decision should have filled, and may carry a template for the description.
// It complements checklists: a blueprint describes the ticket itself, a checklist the parts it breaks into.
// Built-in blueprints ship with heist; a project replaces one with .heist/blueprints/<kind>.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ValidationError, NotFoundError, HeistError } from './index.js';
import { fieldsFor, customFields } from './fields.js';

const KINDS = ['task', 'feature', 'bug', 'decision', 'option'];
const expect = (field, hint, extra = {}) => ({ field, hint, ...extra });
const DESCRIPTION = 'What this is about and what has to happen, written for someone who was not there: context first, then the task.';
const TODOS = 'The steps to take, in order, when the way is known (commands to run, things to click).';
export const BUILTIN_BLUEPRINTS = Object.freeze([
  {
    kind: 'task', title: 'Task', description: 'One piece of work a person or an agent can finish and verify.',
    expects: [
      expect('description', DESCRIPTION),
      expect('why', 'The reason this exists; what breaks or is missing without it.'),
      expect('todos', TODOS, { optional: true }),
      expect('acceptance', 'Checkable conditions for "done".', { when: 'leaf' }),
      expect('files', 'Files or folders the work is expected to touch.', { optional: true }),
      expect('size', 'Rough effort (xs, s, m, l, xl).', { optional: true }),
    ],
  },
  {
    kind: 'feature', title: 'Feature', description: 'Something a user can do that they could not do before.',
    expects: [
      expect('description', 'What the user does and what happens, step by step, including what happens outside the happy path.'),
      expect('why', 'Who needs it and what it is for.'),
      expect('todos', TODOS, { optional: true }),
      expect('acceptance', 'How it is proven to work.', { when: 'leaf' }),
      expect('risks', 'What could go wrong with this feature.', { optional: true }),
      expect('size', 'Rough effort (xs, s, m, l, xl).', { optional: true }),
    ],
  },
  {
    kind: 'bug', title: 'Bug', description: 'Something that behaves differently from what was meant.',
    expects: [
      expect('description', 'What goes wrong, where it was seen and who is affected.'),
      expect('repro', 'Steps to reproduce, expected and actual behaviour.'),
      expect('todos', TODOS, { optional: true }),
      expect('acceptance', 'How the fix is shown to work.', { when: 'leaf' }),
      expect('why', 'How badly it hurts, if the description does not say.', { optional: true }),
      expect('files', 'Where the cause is suspected.', { optional: true }),
    ],
  },
  {
    kind: 'decision', title: 'Decision', description: 'A question with options.',
    expects: [
      expect('why', 'Why this has to be decided, and what waits for it.'),
      expect('description', 'Background a person needs to choose: what is known, what was tried.', { optional: true }),
      expect('risks', 'What a wrong choice would cost.', { optional: true }),
    ],
  },
]);
const FLAGS = { todos: '--todo "a;b"', description: '--description', why: '--why', acceptance: '--accept "a;b"', files: '--files a,b', size: '--size', risks: '--risks "a;b"', assumptions: '--assume "a;b"', refs: '--refs a,b', repro: '--steps "a;b" --expected T --actual T', evaluation: '--evaluation' };

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
    if (!bp) return { ticketId: ticket.id, kind, blueprint: null, items: [], others: [], editable: [], missing: [], optional: [] };
    const hasChildren = (tickets ?? await p.tickets.list({ limit: Infinity })).some(t => t.parentId === ticket.id);
    const defs = new Map(fieldsFor(kind, p.config).map(f => [f.name, f]));
    const items = bp.expects.filter(e => !(e.when === 'leaf' && hasChildren)).map(e => {
      const def = defs.get(e.field); const value = e.field === 'description' ? ticket.description : def?.custom ? ticket.properties?.[e.field] : ticket[e.field];
      const isFilled = filled(value, e.field === 'description' ? bp.template : undefined);
      return { field: e.field, label: def?.label ?? 'Description', type: def?.type ?? 'text', value: isFilled ? value : undefined, hint: e.hint ?? def?.help ?? '', optional: !!e.optional, filled: isFilled, flag: FLAGS[e.field] ?? `--set ${e.field}=VALUE` };
    });
    // Filled fields the blueprint does not name are still part of the ticket; views show them after the expected ones.
    const named = new Set(bp.expects.map(e => e.field));
    const others = [...defs.values()].filter(d => !named.has(d.name) && d.name !== 'createdBy').map(d => ({ field: d.name, label: d.label, type: d.type, value: d.custom ? ticket.properties?.[d.name] : ticket[d.name] })).filter(o => filled(o.value));
    // Everything a person may edit on this ticket: blueprint sections first, then the other fields of the kind.
    const order = [...bp.expects.map(e => e.field), ...[...defs.keys()].filter(n => !named.has(n))];
    const editable = order.filter(n => !['createdBy', 'outcome'].includes(n)).map(n => { const d = defs.get(n), e = bp.expects.find(x => x.field === n); return { field: n, label: d?.label ?? 'Description', type: d?.type ?? 'text', values: d?.values, shape: d?.shape, custom: !!d?.custom, hint: e?.hint ?? d?.help ?? '', expected: !!e && !e.optional, value: n === 'description' ? ticket.description : d?.custom ? ticket.properties?.[n] : ticket[n] }; });
    return { ticketId: ticket.id, kind, blueprint: { kind, title: bp.title ?? kind, source: bp.source }, items, others, editable, missing: items.filter(i => !i.filled && !i.optional).map(i => i.field), optional: items.filter(i => !i.filled && i.optional).map(i => i.field) };
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
    /** A blueprint with everything a form needs: labels and types of its sections, and the fields of the kind it does not use yet. */
    async describe(kind) {
      if (!KINDS.includes(kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}`);
      const bp = (await all()).get(kind) ?? { kind, title: kind, description: '', expects: [], source: 'none' };
      const defs = new Map(fieldsFor(kind, p.config).map(f => [f.name, f])); const used = new Set(bp.expects.map(e => e.field));
      const info = n => ({ field: n, label: defs.get(n)?.label ?? 'Description', type: defs.get(n)?.type ?? 'text', custom: !!defs.get(n)?.custom });
      return { kind, title: bp.title ?? kind, description: bp.description ?? '', source: bp.source, template: bp.template ?? '',
        expects: bp.expects.map(e => ({ ...info(e.field), hint: e.hint ?? '', optional: !!e.optional, leaf: e.when === 'leaf' })),
        available: ['description', ...defs.keys()].filter(n => !used.has(n) && !['createdBy', 'outcome'].includes(n)).map(info), fieldTypes: ['text', 'list', 'number', 'bool', 'enum'] };
    },
    /** Replace the sections and the template of a kind's blueprint; written to .heist/blueprints/<kind>.json. */
    async save(kind, { expects, template } = {}) {
      if (!KINDS.includes(kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}`);
      const cur = (await all()).get(kind) ?? { kind, title: kind, description: '', expects: [] };
      if (expects !== undefined && !Array.isArray(expects)) throw new ValidationError('expects must be a list');
      const clean = (expects ?? cur.expects).map(e => ({ field: e?.field, ...(e?.hint ? { hint: String(e.hint) } : {}), ...(e?.optional ? { optional: true } : {}), ...(e?.leaf || e?.when === 'leaf' ? { when: 'leaf' } : {}) }));
      const text = template === undefined ? cur.template : template;
      const bp = { kind, title: cur.title ?? kind, description: cur.description ?? '', expects: clean, ...(text ? { template: String(text) } : {}) };
      validateBlueprint(bp, p.config);
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, `${kind}.json`), temp = `${file}.${process.pid}.${randomBytes(5).toString('hex')}.tmp`;
      await fs.writeFile(temp, `${JSON.stringify(bp, null, 2)}\n`, { flag: 'wx' }); await fs.rename(temp, file);
      return this.describe(kind);
    },
    /**
     * Expect a section, or change one that is expected already. A field the kind does not have yet is created as a
     * project field (config.fields) in the same step, so a new section needs one call.
     */
    async expect(kind, field, { hint, optional, leaf, before, type, values, label } = {}) {
      if (!KINDS.includes(kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}`);
      if (typeof field !== 'string' || !field) throw new ValidationError('Name the field to expect');
      let created = false;
      if (field !== 'description' && !fieldsFor(kind, p.config).some(f => f.name === field)) {
        const list = [...(p.config.fields ?? [])]; const i = list.findIndex(f => f.name === field);
        if (i >= 0) list[i] = { ...list[i], kinds: [...new Set([...(list[i].kinds ?? KINDS), kind])] };
        else { list.push({ name: field, type: type ?? 'text', ...(label ? { label } : {}), ...(values?.length ? { values } : {}), kinds: [kind] }); created = true; }
        customFields({ fields: list });
        await p.saveConfig({ ...p.config, fields: list });
      } else if (type !== undefined) throw new ValidationError(`${field} exists already; its type cannot be changed here`);
      const cur = (await all()).get(kind) ?? { expects: [] }; const expects = cur.expects.map(e => ({ ...e }));
      let entry = expects.find(e => e.field === field);
      if (!entry) { entry = { field }; expects.push(entry); }
      if (hint !== undefined) entry.hint = hint;
      if (optional !== undefined) entry.optional = !!optional;
      if (leaf !== undefined) entry.when = leaf ? 'leaf' : undefined;
      if (before !== undefined) {
        const rest = expects.filter(e => e !== entry), at = rest.findIndex(e => e.field === before);
        if (at < 0) throw new ValidationError(`Blueprint ${kind} does not expect ${before}`);
        rest.splice(at, 0, entry); expects.splice(0, expects.length, ...rest);
      }
      return { ...(await this.save(kind, { expects })), created };
    },
    /** Stop expecting a section. The field itself stays; tickets keep what they have. */
    async drop(kind, field) {
      const cur = await this.get(kind);
      if (!cur.expects.some(e => e.field === field)) throw new ValidationError(`Blueprint ${kind} does not expect ${field}`);
      return this.save(kind, { expects: cur.expects.filter(e => e.field !== field) });
    },
    /** Remove the project's blueprint of a kind, so the built-in one applies again. */
    async reset(kind) {
      if (!KINDS.includes(kind)) throw new ValidationError(`Blueprint kind must be one of ${KINDS.join(', ')}`);
      let removed = true;
      try { await fs.unlink(path.join(dir, `${kind}.json`)); } catch (e) { if (e.code !== 'ENOENT') throw e; removed = false; }
      return { kind, reset: removed, blueprint: await this.describe(kind) };
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
