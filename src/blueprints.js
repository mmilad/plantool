// Blueprints: reusable checklists that expand a ticket into everything it really needs
// ("a header is not just a header": logo, navigation, burger menu, states, accessibility ...).
// Built-in blueprints ship with heist; a project can add or override them in .heist/blueprints/<name>.json.
import fs from 'node:fs/promises';
import path from 'node:path';
import { ValidationError, NotFoundError, HeistError } from './index.js';

const NAME_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const ITEM_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;

const item = (id, title, why, extra = {}) => ({ id, title, why, ...extra });

/** Starter set. Items are written as tickets an agent can pick up; `optional` items are decisions, not defaults. */
export const BUILTIN_BLUEPRINTS = Object.freeze([
  {
    name: 'product', title: 'Product / app', description: 'The questions every new product has to answer before the work can be planned.',
    match: ['app', 'product', 'website', 'game', 'platform', 'saas'],
    items: [
      item('goal', 'Write the product goal, target users and what success looks like', 'Every later decision is judged against this.'),
      item('platform', 'Which platforms does it run on?', 'Decides framework, distribution and UI patterns.', { after: ['goal'],  kind: 'decision', reversible: false, options: ['Web', 'iOS and Android', 'Desktop', 'Web and mobile'] }),
      item('stack', 'Which framework and language?', 'Hard to change later; depends on the platform and the skills of the team.', { after: ['platform'],  kind: 'decision', reversible: false, criteria: 'Team knowledge:3, Fit for the platform:3, Ecosystem:2, Performance:1' }),
      item('core-features', 'List the core features of the first release', 'Keeps the first version small and makes the rest of the plan concrete.', { after: ['goal'] }),
      item('accounts', 'Do users need accounts?', 'Accounts pull in login, privacy and a backend.', { after: ['core-features'],  kind: 'decision', options: ['No accounts', 'Email and password', 'Social login'] }),
      item('data', 'Where does the data come from and where does it live?', 'Device only, own backend or a third-party service changes the whole architecture.', { after: ['core-features'],  kind: 'decision', reversible: false, options: ['Only on the device', 'Own backend', 'Third-party API or backend service'] }),
      item('ui-structure', 'Map the screens and the navigation (menu, tabs, sidebar …)', 'Decides which UI parts exist; apply the header, page and form blueprints to them.', { after: ['stack', 'core-features', 'accounts'] }),
      item('visual', 'Define the visual direction (references, colours, typography)', 'Gives every UI ticket the same target.', { after: ['platform'] }),
      item('quality', 'Decide how the product is tested and released', 'Agents need to know what "verified" means.', { after: ['stack'] }),
      item('offline', 'Must it work offline?', 'Only relevant for mobile or field use.', { kind: 'decision', optional: true, options: ['Yes', 'No'] }),
      item('monetization', 'How does it make money?', 'Only if it is a commercial product.', { kind: 'decision', optional: true, options: ['Free', 'One-time purchase', 'Subscription', 'Ads', 'In-app purchases'] }),
      item('legal', 'Check legal requirements (privacy, licences, trademarks, content rights)', 'Third-party brands, images and personal data need permission.', { optional: true }),
    ],
  },
  {
    name: 'feature', title: 'Feature', description: 'What a user-facing feature needs before it is built: behaviour, edge cases, data and proof.',
    match: ['feature', 'flow'],
    items: [
      item('behaviour', 'Describe what the user does and what happens, step by step', 'Agents build what is written; a vague sentence becomes a vague feature.'),
      item('states', 'Define empty, loading, error and permission cases', 'The happy path is the easy part; the other states decide whether it feels finished.', { after: ['behaviour'] }),
      item('data', 'Name the data it reads and writes, and where it comes from', 'Data decides storage, contracts and what can be tested.', { after: ['behaviour'] }),
      item('contracts', 'Plan the contracts it uses or provides before the code', 'Other parts can start against an agreed shape instead of waiting.', { after: ['data'] }),
      item('tests', 'Write down how it is proven to work', 'Agents need to know what "verified" means for this feature.', { after: ['behaviour'] }),
    ],
  },
  {
    name: 'ui-component', title: 'UI component', description: 'What every visible piece of UI needs besides its happy-path markup.',
    match: ['component', 'widget', 'button', 'modal', 'dialog', 'card', 'banner', 'sidebar', 'carousel', 'tooltip'],
    items: [
      item('states', 'Define empty, loading and error states', 'Real data is missing, slow or broken more often than designs assume.'),
      item('responsive', 'Decide the layout on mobile, tablet and desktop', 'Components often need a different structure, not just smaller sizes.'),
      item('a11y', 'Keyboard operation, focus order and accessible names', 'Everything clickable must work without a mouse and be announced correctly.'),
      item('content', 'Write texts and labels, including long and missing content', 'Long names, translations and empty fields break layouts.'),
      item('tests', 'Add interaction and visual tests', 'Protects the agreed behaviour from regressions.'),
    ],
  },
  {
    name: 'header', title: 'Site header', extends: 'ui-component', description: 'Logo, navigation and the mobile variant of the top of every page.',
    match: ['header', 'top bar', 'topbar', 'navbar', 'masthead', 'app bar'],
    items: [
      item('logo', 'Logo that links to the home page', 'Users expect the logo to bring them home; it also needs an accessible name.'),
      item('primary-nav', 'Primary navigation on desktop', 'Main sections must be one click away; decide which items and their order.'),
      item('mobile-menu', 'Burger menu or off-canvas navigation on mobile', 'The desktop navigation rarely fits a phone; decide how it collapses.'),
      item('active-state', 'Highlight the current page in the navigation', 'Users need to know where they are (aria-current).'),
      item('skip-link', 'Skip link to the main content', 'Keyboard users should not tab through the whole header on every page.'),
      item('nav-data', 'Decide where navigation items come from', 'Hard-coded, CMS or API? This is a contract other tickets depend on.'),
      item('search', 'Search entry in the header', 'Only if the product has search.', { optional: true }),
      item('account', 'Account / login area', 'Only if users sign in.', { optional: true }),
      item('cart', 'Cart icon with item count', 'Only for shops.', { optional: true }),
      item('sticky', 'Sticky or hiding header on scroll', 'Affects layout and focus handling.', { optional: true }),
    ],
  },
  {
    name: 'footer', title: 'Site footer', extends: 'ui-component', description: 'Legal links and secondary navigation at the bottom of every page.',
    match: ['footer'],
    items: [
      item('legal', 'Legal links (imprint, privacy policy, terms)', 'Often legally required.'),
      item('secondary-nav', 'Secondary navigation', 'Less important pages still need a way in.'),
      item('copyright', 'Copyright line', 'Small but expected.'),
      item('contact', 'Contact and social links', 'Only if the product has them.', { optional: true }),
      item('language', 'Language switch', 'Only for multilingual sites.', { optional: true }),
    ],
  },
  {
    name: 'form', title: 'Form', extends: 'ui-component', description: 'Input, validation and submission of user data.',
    match: ['form', 'signup', 'sign up', 'registration', 'checkout', 'contact form'],
    items: [
      item('fields', 'List fields with type, required flag and limits', 'The field list is the contract with the backend.'),
      item('client-validation', 'Client-side validation with messages per field', 'Users must see what is wrong next to the field.'),
      item('server-validation', 'Server-side validation and error mapping', 'Never trust the client; map server errors back to fields.'),
      item('submit-states', 'Submit states: disabled, sending, success, failure', 'Prevents double submits and lost input.'),
      item('autocomplete', 'Autocomplete attributes and input modes', 'Password managers and phone keyboards depend on them.'),
      item('spam', 'Spam / abuse protection', 'Only for public forms.', { optional: true }),
      item('consent', 'Consent and privacy notice', 'Only if personal data is collected.', { optional: true }),
    ],
  },
  {
    name: 'page', title: 'Page / route', description: 'A page users can navigate to.',
    match: ['page', 'screen', 'landing page'],
    items: [
      item('route', 'Define the URL and how it is reached', 'Deep links, back button and redirects.'),
      item('data', 'Data loading contract for the page', 'Which services are called, what happens while loading.'),
      item('not-found', 'Not found and empty variants', 'Wrong IDs and empty data are normal cases.'),
      item('meta', 'Page title and meta description', 'Browser tabs, sharing and search engines use them.'),
      item('layout', 'Compose header, content and footer', 'Make sure shared parts are reused, not copied.'),
      item('analytics', 'Analytics events', 'Only if the product measures usage.', { optional: true }),
    ],
  },
  {
    name: 'service', title: 'Service / module', description: 'Backend or domain logic with a public contract.',
    match: ['service', 'backend', 'repository', 'worker'],
    items: [
      item('contract', 'Define the public contract (inputs, outputs, errors)', 'Consumers plan against it; record it with heist contract set.'),
      item('data-model', 'Data model and persistence', 'What is stored where, and how it migrates.'),
      item('errors', 'Error cases and edge cases', 'Timeouts, missing records, invalid input.'),
      item('auth', 'Authentication and permissions', 'Who may call what.'),
      item('observability', 'Logging and metrics', 'You cannot fix what you cannot see.'),
      item('tests', 'Unit and contract tests', 'Keep the contract honest.'),
      item('config', 'Configuration and secrets', 'Only if the service needs settings or credentials.', { optional: true }),
    ],
  },
  {
    name: 'api-endpoint', title: 'API endpoint', description: 'An HTTP endpoint other code calls.',
    match: ['endpoint', 'api route', 'route handler', 'rest api', 'graphql', 'webhook'],
    items: [
      item('request', 'Request schema (method, path, body, query)', 'The input half of the contract.'),
      item('response', 'Response schema and status codes', 'The output half of the contract.'),
      item('errors', 'Error responses and codes', 'Clients need stable codes, not just messages.'),
      item('auth', 'Authentication and authorization', 'Decide who may call it.'),
      item('tests', 'Contract tests', 'Prevents silent breaking changes.'),
      item('pagination', 'Pagination', 'Only for list endpoints.', { optional: true }),
      item('rate-limit', 'Rate limiting', 'Only for public or expensive endpoints.', { optional: true }),
    ],
  },
  {
    name: 'login', title: 'Login and session', extends: 'form', description: 'Signing users in and keeping them signed in.',
    match: ['login', 'log in', 'sign in', 'signin', 'authentication'],
    items: [
      item('logout', 'Logout everywhere it is needed', 'Users must be able to end a session.'),
      item('session', 'Session lifetime and renewal', 'Decide how long users stay signed in.'),
      item('password-reset', 'Password reset flow', 'Users forget passwords.'),
      item('lockout', 'Brute-force protection', 'Limit repeated failed attempts.'),
      item('sso', 'Single sign-on / social login', 'Only if required.', { optional: true }),
      item('mfa', 'Two-factor authentication', 'Only if required.', { optional: true }),
    ],
  },
]);

function validateBlueprint(bp, source) {
  const where = source ? ` (${source})` : '';
  if (!bp || typeof bp !== 'object') throw new ValidationError(`Blueprint must be an object${where}`);
  if (!NAME_RE.test(bp.name ?? '')) throw new ValidationError(`Blueprint name must be lowercase letters, digits and dashes${where}`);
  if (bp.extends !== undefined && !NAME_RE.test(bp.extends)) throw new ValidationError(`Blueprint ${bp.name}: invalid extends${where}`);
  if (!Array.isArray(bp.items)) throw new ValidationError(`Blueprint ${bp.name} needs an items array${where}`);
  const seen = new Set();
  for (const it of bp.items) {
    if (!ITEM_RE.test(it?.id ?? '')) throw new ValidationError(`Blueprint ${bp.name}: item ids must be lowercase letters, digits and dashes${where}`);
    if (seen.has(it.id)) throw new ValidationError(`Blueprint ${bp.name}: duplicate item ${it.id}${where}`);
    seen.add(it.id);
    if (typeof it.title !== 'string' || !it.title.trim()) throw new ValidationError(`Blueprint ${bp.name}: item ${it.id} needs a title${where}`);
    if (it.options !== undefined && (!Array.isArray(it.options) || it.options.some(o => typeof o !== 'string'))) throw new ValidationError(`Blueprint ${bp.name}: item ${it.id} options must be a list of texts${where}`);
    if (it.kind !== undefined && !['task', 'feature', 'bug', 'decision'].includes(it.kind)) throw new ValidationError(`Blueprint ${bp.name}: item ${it.id} has an invalid kind${where}`);
  }
  if (bp.match !== undefined && (!Array.isArray(bp.match) || bp.match.some(x => typeof x !== 'string'))) throw new ValidationError(`Blueprint ${bp.name}: match must be a list of words${where}`);
  return bp;
}

export function validateTicketBlueprint(value) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object' || Array.isArray(value) || !NAME_RE.test(value.name ?? '')) throw new ValidationError('Ticket blueprint must be {name, skipped}');
  if (value.skipped !== undefined && (typeof value.skipped !== 'object' || Array.isArray(value.skipped) || Object.entries(value.skipped).some(([k, v]) => !ITEM_RE.test(k) || typeof v !== 'string'))) throw new ValidationError('Ticket blueprint.skipped must map item ids to reasons');
}
export function validateTicketOrigin(value) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object' || !NAME_RE.test(value.blueprint ?? '') || !ITEM_RE.test(value.item ?? '')) throw new ValidationError('Ticket origin must be {blueprint, item}');
}

const words = s => String(s ?? '').toLocaleLowerCase();
function matchScore(bp, ticket) {
  const title = words(ticket.title), text = `${title} ${words(ticket.description)}`, labels = (ticket.labels ?? []).map(words);
  if (labels.includes(`blueprint:${bp.name}`)) return 100;
  let score = 0;
  for (const m of bp.match ?? []) {
    const re = new RegExp(`(^|[^a-z0-9])${m.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?([^a-z0-9]|$)`);
    if (re.test(title)) score += 3; else if (re.test(text)) score += 1;
    if (labels.includes(m.toLocaleLowerCase())) score += 3;
  }
  return score;
}

export function attachBlueprintApi(p) {
  const dir = path.join(p.dir, 'blueprints');
  async function local() {
    let names = [];
    try { names = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const out = [];
    for (const f of names.sort()) {
      const file = path.join(dir, f);
      let bp; try { bp = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { throw new ValidationError(`Blueprint file ${f} is not valid JSON: ${e.message}`); }
      validateBlueprint(bp, `.heist/blueprints/${f}`);
      if (`${bp.name}.json` !== f) throw new ValidationError(`Blueprint file ${f} must be named ${bp.name}.json`);
      out.push({ ...bp, source: 'project' });
    }
    return out;
  }
  async function all() {
    const map = new Map(BUILTIN_BLUEPRINTS.map(b => [b.name, { ...b, source: 'built-in' }]));
    for (const b of await local()) map.set(b.name, b);
    return map;
  }
  /** Items including inherited ones; a child blueprint can override an inherited item by id. */
  function resolve(map, name, seen = new Set()) {
    const bp = map.get(name);
    if (!bp) throw new NotFoundError(`Unknown blueprint: ${name}`);
    if (seen.has(name)) throw new ValidationError(`Blueprint inheritance cycle at ${name}`);
    seen.add(name);
    const own = bp.items.map(i => ({ ...i, from: name }));
    const inherited = bp.extends ? resolve(map, bp.extends, seen).items.filter(i => !own.some(o => o.id === i.id)) : [];
    return { ...bp, items: [...own, ...inherited] };
  }
  async function coverage(ticketRef) {
    const ticket = await p.tickets.get(ticketRef);
    if (!ticket.blueprint) return { ticketId: ticket.id, blueprint: null, items: [], missing: [], undecided: [] };
    const map = await all();
    let bp; try { bp = resolve(map, ticket.blueprint.name); } catch (e) { return { ticketId: ticket.id, blueprint: { name: ticket.blueprint.name, missing: true }, error: e.message, items: [], missing: [], undecided: [] }; }
    const children = (await p.tickets.list({ limit: Infinity })).filter(t => t.parentId === ticket.id);
    const skipped = ticket.blueprint.skipped ?? {};
    const items = bp.items.map(i => {
      const child = children.find(c => c.origin?.blueprint === bp.name && c.origin?.item === i.id) ?? children.find(c => c.origin?.item === i.id);
      const state = child ? (child.status === 'done' ? 'done' : child.status === 'cancelled' ? 'cancelled' : 'planned') : skipped[i.id] !== undefined ? 'skipped' : 'open';
      return { id: i.id, title: i.title, why: i.why ?? '', optional: !!i.optional, from: i.from, state, ticket: child ? { id: child.id, key: p.ticketKey(child), title: child.title, status: child.status } : null, reason: skipped[i.id] };
    });
    return { ticketId: ticket.id, blueprint: { name: bp.name, title: bp.title, source: bp.source }, items, missing: items.filter(i => i.state === 'open' && !i.optional).map(i => i.id), undecided: items.filter(i => i.state === 'open' && i.optional).map(i => i.id) };
  }
  p.blueprints = {
    async list() { return [...(await all()).values()].map(b => ({ name: b.name, title: b.title ?? b.name, description: b.description ?? '', extends: b.extends ?? null, source: b.source, items: b.items.length })); },
    async get(name) { return resolve(await all(), name); },
    async suggest(ticketRef, { limit = 3 } = {}) {
      const ticket = await p.tickets.get(ticketRef);
      return [...(await all()).values()].map(b => ({ name: b.name, title: b.title ?? b.name, score: matchScore(b, ticket) + (ticket.kind === b.name ? 3 : 0) })).filter(x => x.score >= 3).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit);
    },
    coverage,
    /** Attach a blueprint and create child tickets for the chosen items (default: all required items not yet covered). */
    async apply(ticketRef, name, { only, includeOptional = false, dryRun = false } = {}) {
      const ticket = await p.tickets.get(ticketRef);
      if (ticket.blueprint && ticket.blueprint.name !== name) throw new HeistError(`Ticket already uses blueprint ${ticket.blueprint.name}`, 'CONFLICT', { blueprint: ticket.blueprint.name });
      const bp = resolve(await all(), name);
      if (only) for (const id of only) if (!bp.items.some(i => i.id === id)) throw new ValidationError(`Blueprint ${name} has no item ${id}`);
      const before = ticket.blueprint ? await coverage(ticket.id) : null;
      const covered = new Set(before ? before.items.filter(i => i.state !== 'open').map(i => i.id) : []);
      const chosen = bp.items.filter(i => !covered.has(i.id) && (only ? only.includes(i.id) : (includeOptional || !i.optional)));
      if (dryRun) return { ticketId: ticket.id, blueprint: name, create: chosen.map(i => ({ item: i.id, title: i.title, optional: !!i.optional })), created: [] };
      if (!ticket.blueprint) await p.tickets.update(ticket.id, { blueprint: { name, skipped: {} } });
      const created = [];
      for (const i of chosen) {
        const description = [i.why, i.description, `From blueprint ${bp.title ?? bp.name} › ${i.id} (parent: ${ticket.title}).`].filter(Boolean).join('\n\n');
        const child = i.kind === 'decision'
          ? (await p.decisions.ask(i.title, { parentId: ticket.id, why: i.why, options: i.options ?? [], criteria: i.criteria ?? [], owner: i.owner, reversible: i.reversible, origin: { blueprint: name, item: i.id } })).decision
          : await p.tickets.create({ title: i.title, description, why: i.why || undefined, acceptance: i.acceptance?.map(text => ({ text, met: false })), kind: i.kind ?? 'task', parentId: ticket.id, labels: i.labels ?? [], origin: { blueprint: name, item: i.id } });
        created.push({ item: i.id, id: child.id, key: p.ticketKey(child), title: child.title });
      }
      // `after` on an item makes its ticket wait for the tickets of the listed items (created now or earlier).
      const idOf = new Map(created.map(c => [c.item, c.id]));
      for (const c of before?.items ?? []) if (c.ticket?.id && !idOf.has(c.id)) idOf.set(c.id, c.ticket.id);
      for (const i of chosen) for (const dep of i.after ?? []) {
        const from = idOf.get(dep), to = idOf.get(i.id);
        if (from && to && from !== to) await p.relations.add(from, to, 'blocks').catch(e => { if (e.code !== 'DUPLICATE_RELATION') throw e; });
      }
      return { ticketId: ticket.id, blueprint: name, created, coverage: await coverage(ticket.id) };
    },
    /** Record that an item does not apply, with a reason (or remove that decision with reason=null). */
    async skip(ticketRef, itemId, reason) {
      const ticket = await p.tickets.get(ticketRef);
      if (!ticket.blueprint) throw new ValidationError('This ticket has no blueprint; apply one first');
      const bp = resolve(await all(), ticket.blueprint.name);
      if (!bp.items.some(i => i.id === itemId)) throw new ValidationError(`Blueprint ${bp.name} has no item ${itemId}`);
      const skipped = { ...(ticket.blueprint.skipped ?? {}) };
      if (reason === null) delete skipped[itemId];
      else { if (typeof reason !== 'string' || !reason.trim()) throw new ValidationError('Give a short reason why the item does not apply'); skipped[itemId] = reason.trim(); }
      await p.tickets.update(ticket.id, { blueprint: { ...ticket.blueprint, skipped } });
      return coverage(ticket.id);
    },
    async detach(ticketRef) { const ticket = await p.tickets.get(ticketRef); const { blueprint: _b, ...rest } = ticket; await p.tickets.update(ticket.id, { blueprint: null }); return rest; },
    /** Write a built-in (or new empty) blueprint into .heist/blueprints/ so the project can customise it. */
    async init(name, { from } = {}) {
      if (!NAME_RE.test(name ?? '')) throw new ValidationError('Blueprint name must be lowercase letters, digits and dashes');
      const file = path.join(dir, `${name}.json`);
      const base = from ? BUILTIN_BLUEPRINTS.find(b => b.name === from) ?? (await local()).find(b => b.name === from) : BUILTIN_BLUEPRINTS.find(b => b.name === name);
      if (from && !base) throw new NotFoundError(`Unknown blueprint: ${from}`);
      const bp = base ? { ...structuredClone(base), name, source: undefined } : { name, title: name, description: '', match: [name], items: [{ id: 'first-item', title: 'Describe what this kind of ticket always needs', why: '' }] };
      delete bp.source;
      validateBlueprint(bp);
      await fs.mkdir(dir, { recursive: true });
      try { await fs.writeFile(file, `${JSON.stringify(bp, null, 2)}\n`, { flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') throw new HeistError(`Blueprint ${name} already exists in .heist/blueprints/`, 'CONFLICT'); throw e; }
      return { name, file: path.relative(p.root, file).split(path.sep).join('/') };
    },
    /** Project-wide check: tickets with missing blueprint items, and tickets that look like a blueprint but have none. */
    async check() {
      const tickets = await p.tickets.list({ limit: Infinity }); const map = await all(); const warnings = [];
      for (const t of tickets) {
        if (['done', 'cancelled'].includes(t.status) || t.origin) continue;
        if (t.blueprint) {
          const c = await coverage(t.id);
          if (c.error) warnings.push({ code: 'BLUEPRINT_MISSING', ticketId: t.id, message: `${p.ticketKey(t) ?? t.id} uses unknown blueprint ${t.blueprint.name}` });
          if (c.missing.length) warnings.push({ code: 'BLUEPRINT_ITEMS_MISSING', ticketId: t.id, items: c.missing, message: `${p.ticketKey(t) ?? t.id} "${t.title}" is missing ${c.missing.length} ${t.blueprint.name} item(s): ${c.missing.join(', ')}` });
          if (c.undecided.length) warnings.push({ code: 'BLUEPRINT_UNDECIDED', ticketId: t.id, items: c.undecided, message: `${p.ticketKey(t) ?? t.id} "${t.title}" has undecided optional items: ${c.undecided.join(', ')}` });
        } else {
          const best = [...map.values()].map(b => [b, matchScore(b, t)]).filter(([, s]) => s >= 3).sort((a, b) => b[1] - a[1])[0];
          if (best) warnings.push({ code: 'BLUEPRINT_SUGGESTED', ticketId: t.id, blueprint: best[0].name, message: `${p.ticketKey(t) ?? t.id} "${t.title}" looks like a ${best[0].name}; run heist blueprint apply ${p.ticketKey(t) ?? t.id} ${best[0].name} --dry-run` });
        }
      }
      return warnings;
    },
  };
}
