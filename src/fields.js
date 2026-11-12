// Which metadata each kind of plan node carries. One table drives validation, the CLI, agent context and the UI.
// Everything is stored as plain JSON on the ticket; empty fields are omitted so diffs and merges stay small.
import { ValidationError } from './index.js';

const WORK = ['task', 'feature', 'bug'];
const ALL = [...WORK, 'decision', 'option'];

/** type: text | list | checklist | enum | bool | object; kinds: where the field belongs. */
export const FIELD_DEFS = Object.freeze([
  { name: 'why', type: 'text', kinds: ALL, label: 'Why', help: 'The reason this exists; what breaks or is missing without it.' },
  { name: 'assumptions', type: 'list', kinds: ALL, label: 'Assumptions', help: 'What was assumed without asking; a person should confirm these.' },
  { name: 'refs', type: 'list', kinds: ALL, label: 'References', help: 'Links, issues, pull requests, designs.' },
  { name: 'createdBy', type: 'text', kinds: ALL, label: 'Created by', help: 'Person or agent that created the node.' },
  { name: 'acceptance', type: 'checklist', kinds: WORK, label: 'Acceptance criteria', help: 'Checkable conditions for "done".' },
  { name: 'todos', type: 'checklist', kinds: WORK, label: 'To do', help: 'The steps to take, in order; tick them off while working.' },
  { name: 'size', type: 'enum', values: ['xs', 's', 'm', 'l', 'xl'], kinds: [...WORK, 'option'], label: 'Size', help: 'Rough effort; used to compare options.' },
  { name: 'files', type: 'list', kinds: WORK, label: 'Planned files', help: 'Files or folders this work is expected to touch.' },
  { name: 'evaluation', type: 'bool', kinds: WORK, label: 'Evaluation work', help: 'A spike or prototype that helps to decide; ready before the decision is made.' },
  { name: 'outcome', type: 'object', kinds: WORK, label: 'Outcome', help: 'What was done: summary, how it was verified, changed files and commits.',
    shape: { summary: 'text', verifiedBy: 'text', changedFiles: 'list', commits: 'list' } },
  { name: 'repro', type: 'object', kinds: ['bug'], label: 'Reproduction', help: 'Steps, expected and actual behaviour, environment.',
    shape: { steps: 'list', expected: 'text', actual: 'text', environment: 'text' } },
  { name: 'risks', type: 'list', kinds: ['option', 'decision', 'feature'], label: 'Risks', help: 'What could go wrong with this choice or feature.' },
  { name: 'decision', type: 'object', kinds: ['decision'], label: 'Decision', internal: true },
  { name: 'option', type: 'object', kinds: ['option'], label: 'Option', internal: true },
]);
const BY_NAME = new Map(FIELD_DEFS.map(f => [f.name, f]));
const isText = v => typeof v === 'string';
const isList = v => Array.isArray(v) && v.every(x => typeof x === 'string');

function checkValue(def, v, where) {
  const fail = msg => { throw new ValidationError(`${where}: ${msg}`); };
  switch (def.type) {
    case 'text': if (!isText(v)) fail('must be text'); break;
    case 'number': if (!Number.isFinite(v)) fail('must be a number'); break;
    case 'bool': if (typeof v !== 'boolean') fail('must be true or false'); break;
    case 'list': if (!isList(v)) fail('must be a list of texts'); break;
    case 'enum': if (!def.values.includes(v)) fail(`must be one of ${def.values.join(', ')}`); break;
    case 'checklist': if (!Array.isArray(v) || v.some(a => !a || !isText(a.text) || !a.text.trim() || (a.met !== undefined && typeof a.met !== 'boolean'))) fail('must be a list of {text, met}'); break;
    case 'object':
      if (!v || typeof v !== 'object' || Array.isArray(v)) fail('must be an object');
      for (const [k, t] of Object.entries(def.shape ?? {})) if (v[k] !== undefined && !(t === 'list' ? isList(v[k]) : isText(v[k]))) fail(`${k} must be ${t === 'list' ? 'a list of texts' : 'text'}`);
      break;
    default: fail(`unknown field type ${def.type}`);
  }
}

/** Throws on malformed values. Fields that do not fit the kind are allowed (kinds can change) and reported by fieldWarnings. */
export function validateFields(t, config = {}) {
  for (const def of FIELD_DEFS) if (t[def.name] !== undefined && t[def.name] !== null && !def.internal) checkValue(def, t[def.name], def.name);
  for (const def of customFields(config)) { const v = t.properties?.[def.name]; if (v !== undefined && v !== null) checkValue(def, v, `properties.${def.name}`); }
}

/** Project-specific fields from .heist/config.json: {"fields": [{"name": "platform", "type": "enum", "values": [...], "kinds": ["feature"]}]} */
export function customFields(config = {}) {
  const list = config.fields ?? [];
  if (!Array.isArray(list)) throw new ValidationError('config.fields must be a list');
  return list.map(f => {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,47}$/.test(f?.name ?? '')) throw new ValidationError('Custom field names must start with a letter');
    if (BY_NAME.has(f.name)) throw new ValidationError(`Custom field ${f.name} clashes with a built-in field`);
    if (!['text', 'number', 'bool', 'list', 'enum'].includes(f.type)) throw new ValidationError(`Custom field ${f.name}: type must be text, number, bool, list or enum`);
    if (f.type === 'enum' && (!Array.isArray(f.values) || !f.values.length)) throw new ValidationError(`Custom field ${f.name}: enum needs values`);
    return { ...f, kinds: f.kinds ?? ALL, label: f.label ?? f.name, custom: true };
  });
}

/** Fields present on a ticket that do not belong to its kind (e.g. after changing the kind). */
export function fieldWarnings(t, config = {}) {
  const kind = t.kind ?? 'task', out = [];
  for (const def of FIELD_DEFS) if (t[def.name] !== undefined && t[def.name] !== null && !def.kinds.includes(kind)) out.push(def.name);
  for (const def of customFields(config)) if (t.properties?.[def.name] !== undefined && !def.kinds.includes(kind)) out.push(`properties.${def.name}`);
  return out;
}

/** Field definitions for one kind, for the UI and `heist fields`. */
export function fieldsFor(kind, config = {}) {
  return [...FIELD_DEFS.filter(d => !d.internal), ...customFields(config)].filter(d => d.kinds.includes(kind)).map(({ name, type, values, label, help, shape, custom }) => ({ name, type, values, label, help, shape, custom: !!custom }));
}
