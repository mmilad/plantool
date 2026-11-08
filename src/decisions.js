// Decisions as plan nodes: a `decision` ticket asks a question, its `option` children are the candidate answers.
// Options can carry their own plan (child tickets); that plan only becomes ready when the option is chosen,
// except tickets marked `evaluation` (prototypes/spikes that help to decide). Choosing cancels the other options'
// plans and unblocks everything the decision blocks.
import { ValidationError, ConflictError, HeistError } from './index.js';

export const TICKET_SIZES = Object.freeze(['xs', 's', 'm', 'l', 'xl']);
export const SIZE_POINTS = Object.freeze({ xs: 1, s: 2, m: 3, l: 5, xl: 8 });
const DEFAULT_POINTS = 2;
const CRIT_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
export const slug = s => String(s ?? '').toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'criterion';

const strList = (v, name) => { if (v !== undefined && (!Array.isArray(v) || v.some(x => typeof x !== 'string'))) throw new ValidationError(`${name} must be a list of texts`); };

/** Validates the decision/option payloads of a ticket record (the generic fields are checked in fields.js). */
export function validatePlanningFields(t) {
  if (t.decision !== undefined && t.decision !== null) {
    const d = t.decision;
    if (typeof d !== 'object' || Array.isArray(d)) throw new ValidationError('decision must be an object');
    if (d.owner !== undefined && !['human', 'agent'].includes(d.owner)) throw new ValidationError('decision.owner must be human or agent');
    if (d.criteria !== undefined && (!Array.isArray(d.criteria) || d.criteria.some(c => !CRIT_RE.test(c?.id ?? '') || typeof c.name !== 'string' || !(Number(c.weight) > 0)))) throw new ValidationError('decision.criteria must be a list of {id, name, weight>0}');
    if (d.chosen !== undefined && d.chosen !== null && typeof d.chosen !== 'string') throw new ValidationError('decision.chosen must be an option id');
    if (d.reversible !== undefined && typeof d.reversible !== 'boolean') throw new ValidationError('decision.reversible must be true or false');
    if (d.decideBy !== undefined && d.decideBy !== null && Number.isNaN(Date.parse(d.decideBy))) throw new ValidationError('decision.decideBy must be a date');
  }
  if (t.option !== undefined && t.option !== null) {
    const o = t.option;
    if (typeof o !== 'object' || Array.isArray(o)) throw new ValidationError('option must be an object');
    strList(o.pros, 'option.pros'); strList(o.cons, 'option.cons');
    if (o.scores !== undefined && (typeof o.scores !== 'object' || Array.isArray(o.scores) || Object.entries(o.scores).some(([k, v]) => !CRIT_RE.test(k) || !(Number.isFinite(v) && v >= 0 && v <= 5)))) throw new ValidationError('option.scores must map criteria to numbers from 0 to 5');
  }
}

/** Parses "Performance:3, Team knowledge:2" into criteria. */
export function parseCriteria(text) {
  if (!text) return [];
  const out = [];
  for (const part of String(text).split(',').map(s => s.trim()).filter(Boolean)) {
    const m = /^(.*?)(?::\s*(\d+(?:\.\d+)?))?$/.exec(part);
    const name = m[1].trim(), weight = m[2] ? Number(m[2]) : 1;
    if (!name) throw new ValidationError(`Invalid criterion: ${part}`);
    const id = slug(name); if (out.some(c => c.id === id)) throw new ValidationError(`Duplicate criterion: ${name}`);
    out.push({ id, name, weight });
  }
  return out;
}

export function attachDecisionApi(p) {
  const all = () => p.tickets.list({ limit: Infinity });
  const isOpen = t => t.status !== 'done' && t.status !== 'cancelled';
  async function getDecision(ref) {
    const t = await p.tickets.get(ref);
    if (t.kind !== 'decision') throw new ValidationError(`${p.ticketKey(t) ?? t.id} is not a decision`);
    return t;
  }
  function subtree(tickets, id) { const out = [], stack = [id]; while (stack.length) { const x = stack.pop(); for (const t of tickets) if (t.parentId === x) { out.push(t); stack.push(t.id); } } return out; }

  /** Ranking of the options: weighted criteria score, open effort of each option's plan, and the stated recommendation. */
  async function evaluate(ref) {
    const d = await getDecision(ref), tickets = await all();
    const criteria = d.decision?.criteria ?? [];
    const options = tickets.filter(t => t.parentId === d.id && t.kind === 'option');
    const rows = options.map(o => {
      const scores = o.option?.scores ?? {};
      const rated = criteria.filter(c => Number.isFinite(scores[c.id]));
      const total = criteria.reduce((s, c) => s + c.weight * 5, 0);
      const score = total && rated.length ? Math.round(1000 * rated.reduce((s, c) => s + c.weight * scores[c.id], 0) / total) / 1000 : null;
      const plan = subtree(tickets, o.id);
      const effort = plan.filter(isOpen).reduce((s, t) => s + (SIZE_POINTS[t.size] ?? DEFAULT_POINTS), 0) + (o.size ? SIZE_POINTS[o.size] : 0);
      return { id: o.id, key: p.ticketKey(o), title: o.title, status: o.status, why: o.why ?? '', risks: o.risks ?? [], size: o.size ?? null, pros: o.option?.pros ?? [], cons: o.option?.cons ?? [], scores, rated: rated.length, score, effort, planned: plan.length, chosen: d.decision?.chosen === o.id };
    });
    const ranked = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.effort - b.effort || a.title.localeCompare(b.title));
    const best = ranked.find(r => r.score !== null && r.status !== 'cancelled');
    return {
      id: d.id, key: p.ticketKey(d), question: d.title, why: d.why ?? '', owner: d.decision?.owner ?? 'human', reversible: d.decision?.reversible ?? null, decideBy: d.decision?.decideBy ?? null, status: d.decision?.chosen ? 'decided' : d.status === 'cancelled' ? 'cancelled' : 'open',
      criteria, options: rows, ranking: ranked.map(r => r.id), suggested: best ? { option: best.id, title: best.title, reason: `highest weighted score (${Math.round(best.score * 100)}%)${ranked.filter(r => r.score === best.score).length > 1 ? ', tie broken by lower effort' : ''}` } : null,
      recommendation: d.decision?.recommendation ?? null, chosen: d.decision?.chosen ?? null, rationale: d.decision?.rationale ?? '', decidedBy: d.decision?.decidedBy ?? null, decidedAt: d.decision?.decidedAt ?? null,
    };
  }

  p.decisions = {
    evaluate,
    /** Creates a decision (a question) with optional options, criteria and the tickets it blocks. */
    async ask(question, { parentId, options = [], criteria = [], owner, reversible, decideBy, why, blocks = [], priority, createdBy, origin } = {}) {
      owner ??= reversible === true ? 'agent' : 'human';
      if (!question?.trim()) throw new ValidationError('A decision needs a question');
      const d = await p.tickets.create({ title: question.trim(), kind: 'decision', parentId: parentId ?? null, why, priority, createdBy, origin, decision: { owner, criteria: typeof criteria === 'string' ? parseCriteria(criteria) : criteria, chosen: null, ...(reversible !== undefined ? { reversible } : {}), ...(decideBy ? { decideBy } : {}) } });
      const created = [];
      for (const o of options) created.push(await this.addOption(d.id, typeof o === 'string' ? { title: o } : o));
      for (const b of blocks) await p.relations.add(d.id, b, 'blocks');
      return { decision: await p.tickets.get(d.id), options: created };
    },
    async addOption(decisionRef, { title, why, pros = [], cons = [], scores = {}, size, risks, createdBy } = {}) {
      const d = await getDecision(decisionRef);
      if (d.decision?.chosen) throw new ConflictError('This decision is already made; reopen it first');
      return p.tickets.create({ title, why, kind: 'option', parentId: d.id, size, risks, createdBy, option: { pros, cons, scores } });
    },
    /** Sets scores (0-5) per criterion id or name. */
    async score(optionRef, scores) {
      const o = await p.tickets.get(optionRef);
      if (o.kind !== 'option') throw new ValidationError('Only options can be scored');
      const d = await p.tickets.get(o.parentId); const crit = d.decision?.criteria ?? [];
      const next = { ...(o.option?.scores ?? {}) };
      for (const [k, v] of Object.entries(scores)) {
        const c = crit.find(c => c.id === k || c.id === slug(k) || c.name.toLocaleLowerCase() === String(k).toLocaleLowerCase());
        if (!c) throw new ValidationError(`Unknown criterion "${k}"; known: ${crit.map(c => c.id).join(', ') || 'none (add criteria to the decision first)'}`);
        const n = Number(v); if (!(Number.isFinite(n) && n >= 0 && n <= 5)) throw new ValidationError('Scores go from 0 to 5');
        next[c.id] = n;
      }
      return p.tickets.update(o.id, { option: { ...(o.option ?? {}), scores: next } });
    },
    async setCriteria(decisionRef, criteria) {
      const d = await getDecision(decisionRef);
      return p.tickets.update(d.id, { decision: { ...(d.decision ?? {}), criteria: typeof criteria === 'string' ? parseCriteria(criteria) : criteria } });
    },
    /** An agent's (or person's) recommendation; it does not decide. */
    async recommend(decisionRef, optionRef, { why, by } = {}) {
      const d = await getDecision(decisionRef), o = await p.tickets.get(optionRef);
      if (o.parentId !== d.id || o.kind !== 'option') throw new ValidationError('The option does not belong to this decision');
      if (!why?.trim()) throw new ValidationError('Explain the recommendation with --why');
      await p.tickets.update(d.id, { decision: { ...(d.decision ?? {}), recommendation: { option: o.id, why: why.trim(), by: by ?? 'agent', at: new Date().toISOString() } } });
      return evaluate(d.id);
    },
    /** Chooses an option: the decision is done, other options and their open plans are cancelled. */
    async decide(decisionRef, optionRef, { why, by } = {}) {
      const d = await getDecision(decisionRef);
      if (d.decision?.chosen) throw new ConflictError('This decision is already made; reopen it to change it', { chosen: d.decision.chosen });
      const tickets = await all(), o = await p.tickets.get(optionRef);
      if (o.parentId !== d.id || o.kind !== 'option') throw new ValidationError('The option does not belong to this decision');
      if (o.status === 'cancelled') throw new ValidationError('This option was cancelled');
      if (!why?.trim()) throw new ValidationError('Say why with --why; the reason is kept with the decision');
      const decider = by ?? 'unknown', owner = d.decision?.owner ?? 'human';
      if (owner === 'human' && decider !== 'human') throw new ConflictError('A person decides this. Ask them, then record their answer with --by human', { owner, by: decider });
      const cancelled = [];
      for (const other of tickets.filter(t => t.parentId === d.id && t.kind === 'option' && t.id !== o.id)) {
        for (const t of [other, ...subtree(tickets, other.id)]) if (isOpen(t)) { await p.tickets.update(t.id, { status: 'cancelled' }, { force: true }); cancelled.push(t.id); }
      }
      const plan = subtree(tickets, o.id).filter(isOpen);
      if (!plan.length) await p.tickets.update(o.id, { status: 'done' }, { force: true });
      await p.tickets.update(d.id, { status: 'done', decision: { ...(d.decision ?? {}), chosen: o.id, rationale: why.trim(), decidedBy: decider, decidedAt: new Date().toISOString(), cancelled } }, { force: true });
      return { ...(await evaluate(d.id)), cancelled, activated: plan.map(t => ({ id: t.id, key: p.ticketKey(t), title: t.title })) };
    },
    /** Undo a decision: restores what choosing it cancelled. */
    async reopen(decisionRef, { by } = {}) {
      const d = await getDecision(decisionRef);
      if (!d.decision?.chosen) return evaluate(d.id);
      if ((d.decision?.owner ?? 'human') === 'human' && by !== 'human') throw new ConflictError('A person decides this. Ask them before reopening it, then pass --by human', { owner: 'human', by: by ?? 'unknown' });
      for (const id of d.decision.cancelled ?? []) { const t = await p.tickets.get(id).catch(() => null); if (t?.status === 'cancelled') await p.tickets.update(id, { status: 'todo' }, { force: true }); }
      const chosen = await p.tickets.get(d.decision.chosen).catch(() => null);
      if (chosen?.status === 'done') await p.tickets.update(chosen.id, { status: 'todo' }, { force: true });
      const { chosen: _c, rationale: _r, decidedBy: _b, decidedAt: _a, cancelled: _x, ...rest } = d.decision;
      await p.tickets.update(d.id, { status: 'todo', decision: { ...rest, chosen: null } }, { force: true });
      return evaluate(d.id);
    },
    /** When the last open ticket of a chosen option's plan is finished, the option itself is done. */
    async settle(ticket) {
      const parent = ticket.parentId && await p.tickets.get(ticket.parentId).catch(() => null);
      if (!parent || parent.kind !== 'option' || !isOpen(parent)) return;
      const d = await p.tickets.get(parent.parentId).catch(() => null);
      if (d?.decision?.chosen !== parent.id) return;
      if ((await all()).filter(t => t.parentId === parent.id).every(t => !isOpen(t))) await p.tickets.update(parent.id, { status: 'done' }, { force: true });
    },
    /** Open decisions; `needsHuman` are the ones a person has to make. */
    async list({ all: includeDecided = false } = {}) {
      const tickets = await all();
      const rows = [];
      for (const d of tickets.filter(t => t.kind === 'decision' && (includeDecided || (!t.decision?.chosen && t.status !== 'cancelled')))) {
        const e = await evaluate(d.id);
        const anc = []; for (let cur = d.parentId && tickets.find(t => t.id === d.parentId); cur; cur = cur.parentId && tickets.find(t => t.id === cur.parentId)) anc.unshift(cur.title);
        rows.push({ id: d.id, key: e.key, question: e.question, owner: e.owner, reversible: e.reversible, decideBy: e.decideBy, status: e.status, options: e.options.length, suggested: e.suggested?.title ?? null, recommendation: e.recommendation ? e.options.find(o => o.id === e.recommendation.option)?.title ?? null : null, path: anc, priority: d.priority });
      }
      return rows.sort((a, b) => (a.owner === 'human' ? 0 : 1) - (b.owner === 'human' ? 0 : 1) || (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || a.question.localeCompare(b.question));
    },
  };
}

/** Readiness rules for decision-related nodes; returns extra reasons (empty = no objection). */
export function decisionReasons(g, ticket) {
  const reasons = [];
  if (ticket.kind === 'option') reasons.push('options are answers to a decision, not work items');
  if (ticket.kind === 'decision' && (ticket.decision?.owner ?? 'human') === 'human') reasons.push('a person has to make this decision (heist decisions)');
  // Plans under an option wait until that option is chosen, unless they are evaluation work.
  for (let parent = g.byId.get(ticket.parentId); parent; parent = g.byId.get(parent.parentId)) {
    if (parent.kind !== 'option') continue;
    const decision = g.byId.get(parent.parentId);
    const chosen = decision?.decision?.chosen;
    if (!chosen && !ticket.evaluation) reasons.push(`waits for the decision "${decision?.title ?? parent.parentId}" (option "${parent.title}" is not chosen yet)`);
    break;
  }
  return reasons;
}
export { HeistError };
