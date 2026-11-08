// `heist agent onboard`: a briefing for agents. It only prints; what an agent keeps (instruction files, skills, its own tools) is its own decision.
import { DEFAULT_STATUSES, RELATION_TYPES, SEARCH_TYPES } from './index.js';
import { TICKET_KINDS } from './workflow.js';
import { fieldsFor } from './fields.js';
import { DEFAULT_COMPONENT_KINDS } from './design.js';
import { BUILTIN_BLUEPRINTS } from './blueprints.js';
import { TICKET_SIZES } from './decisions.js';
import { GUIDE } from './guide.js';

const list = items => items.map(i => `\`${i}\``).join(', ');

function kindLines() {
  return TICKET_KINDS.map(kind => {
    const fields = fieldsFor(kind).map(f => f.name).join(', ');
    return `- \`${kind}\`: fields ${fields || 'none beyond the common ones'}`;
  }).join('\n');
}

export function onboardText() {
  return `# Onboarding: heist

You are working in a project that plans its work with heist. heist keeps the plan in Git-tracked files under \`.heist/\`. It is the shared plan of people and agents: people make the decisions that are theirs, agents bring domain knowledge, carry out work and record what changed.

## How you reach heist

- CLI: \`heist\` (or \`pnpm exec heist\` when it is a project dependency). \`heist --help\` lists everything. Commands that list data accept \`--format json\`.
- Programmatic API: the same operations as functions (see the package exports; the types are in \`src/index.d.ts\`). Use it when you want to script or build your own helpers.
- MCP server: planned, not available yet.
- Local web view: a human-facing view of the same plan. Editing there changes the same data.
- Planning method: \`heist guide\` (topics: ${list(Object.keys(GUIDE).filter(k => k !== 'overview'))}).

Never edit \`.heist/\` by hand. Use the CLI or the API.

## Node types

Ticket kinds: ${list(TICKET_KINDS)}.
${kindLines()}

Any ticket can have children, so features break into parts and parts into tasks. Decisions have options as children. Components (${list(DEFAULT_COMPONENT_KINDS)}), shared types and contracts describe the interfaces between parts. Documents and comments attach to tickets.

Sizes for effort: ${list(TICKET_SIZES)}.

## States

Ticket status: ${list(DEFAULT_STATUSES)}. A parent is rolled up from its children; a parent cannot be done while children or blockers are open.
\`heist next\` lists only work that is ready: todo, not blocked, decisions made, and the providers of the contracts it consumes finished.
Claims are leases (default 60 minutes), shared between git worktrees. Decisions have a status of their own (open, decided, cancelled) and an owner (human or agent).

## Relationships

Relation types: ${list(RELATION_TYPES)}.
- \`blocks\` (blocker → blocked) is the one that decides readiness. Cycles are refused.
- \`implements\`, \`validates\`, \`duplicates\`, \`supersedes\`, \`relates_to\` describe links without changing readiness.
- Contracts link through \`codePlan\` on a ticket: \`implements\` a component, \`consumes\` a contract with the fields it needs, or \`changes\` one.

## Workflows

${GUIDE.workflow}

${GUIDE.decisions}

${GUIDE.blueprints}

Blueprints available by default: ${list(BUILTIN_BLUEPRINTS.map(b => b.name))}. Projects can add their own.

Search covers ${list(SEARCH_TYPES)} by text, and semantically when the index is available. Use search to find an existing ticket before you create a new one.

## Your own tools and knowledge

heist does not tell you how to work with it beyond this briefing. You can build your own helpers on the CLI or the API, write notes, add instruction files or skills for your tool, and decide for yourself what is worth keeping. If something repeats often enough to be a procedure, you may capture it. Keep whatever you create outside \`.heist/\`, and tell the person what you created.
`;
}
