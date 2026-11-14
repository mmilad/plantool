// `heist agent onboard`: a briefing for agents. It only prints; what an agent keeps (instruction files, skills, its own tools) is its own decision.
import { DEFAULT_STATUSES, RELATION_TYPES, SEARCH_TYPES } from './index.js';
import { TICKET_KINDS } from './workflow.js';
import { fieldsFor } from './fields.js';
import { DEFAULT_COMPONENT_KINDS } from './design.js';
import { BUILTIN_CHECKLISTS } from './checklists.js';
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

Never edit the plan's records under \`.heist/\` by hand (tickets, relationships, comments, decisions, components, contracts): the CLI and the API validate, number and lock, and they carry out what a change implies. Blueprints and checklists are settings; change them with \`heist blueprint …\` or edit their files under \`.heist/blueprints/\` and \`.heist/checklists/\`.

## Language

Write everything that goes into the plan and the code in English: ticket titles and descriptions, decisions and options, rationales, checklists, commit messages, code and code comments. Talk to the person in whatever language they use.

## Node types

Ticket kinds: ${list(TICKET_KINDS)}.
${kindLines()}

Any ticket can have children, so features break into parts and parts into tasks. Decisions have options as children. Components (${list(DEFAULT_COMPONENT_KINDS)}), shared types and contracts describe the interfaces between parts. Documents and comments attach to tickets.

Sizes for effort: ${list(TICKET_SIZES)}.

## States

Ticket status: ${list(DEFAULT_STATUSES)}. A parent is rolled up from its children; a parent cannot be done while children or blockers are open.
\`heist next\` lists only work that is ready: todo, not blocked, decisions made, and the providers of the contracts it consumes finished.
Claims are leases (default 60 minutes), shared between git worktrees. Decisions have a status of their own (open, decided, cancelled) and an owner (human or agent).

## Roadmap

Use \`heist tree --fields plan --format json\` for readiness, explicit/provider blockers and filtered ancestor context.
Use \`heist timeline --order desc --limit 50 --format json\` for completed work; page with the returned offset and snapshot.
If the snapshot is stale, restart at offset zero. \`completedAt\` is stable after completion and cleared on reopen.
Legacy dates are estimates from updatedAt; \`heist roadmap backfill-completion --dry-run\` previews the explicit backfill.
Use \`heist deps --root KEY --format json\` for explicit/provider edges (blocker to blocked). Finished endpoints are excluded unless \`--include-finished\` is set.
Dependencies retains cross-branch and inherited ancestor blockers; contextOnly marks external nodes. Limits are 200 nodes and 500 edges; inspect omitted counts and narrow the root when truncated.
The local UI uses \`?view=roadmap&mode=structure|timeline|deps|graph&ticket=KEY\`. Roadmap adds no workflow requirement.
Use \`heist graph --format json\` for the tickets that have relations (nodes with layer and row, edges, hidden, truncated); the UI shows it as \`mode=graph\`.

## Relationships

Relation types: ${list(RELATION_TYPES)}.
- \`blocks\` (blocker → blocked) is the one that decides readiness. Cycles are refused.
- \`implements\`, \`validates\`, \`duplicates\`, \`supersedes\`, \`relates_to\` describe links without changing readiness.
- Contracts link through \`codePlan\` on a ticket: \`implements\` a component, \`consumes\` a contract with the fields it needs, or \`changes\` one.
- A stand-in for a provider is an \`implements\` with \`--stage mock\`. A consumer that can start on a stand-in says \`--needs mock\`; the default \`full\` waits for the real implementation. Whether a stand-in is worth it is your call: use one when the logic is complex enough that the consumer needs something to run against.

## Workflows

${GUIDE.workflow}

${GUIDE.decisions}

${GUIDE.blueprints}

${GUIDE.checklists}

${GUIDE.contracts}

Checklists available by default: ${list(BUILTIN_CHECKLISTS.map(b => b.name))}. Projects can add their own.

Search covers ${list(SEARCH_TYPES)} by text, and semantically when the index is available. Use search to find an existing ticket before you create a new one.

## Keep what you learned

A later session starts without this briefing. Make sure it finds heist again:

- If your tool reads an instruction file in the project (for example \`AGENTS.md\` or \`CLAUDE.md\`) and that file does not mention heist yet, add a short note: this project plans its work with heist, run \`heist agent onboard\` first. Keep what is already in the file.
- Write down how you use heist here, in whatever form your tool keeps notes: the commands you rely on, the project's own conventions, mistakes you do not want to repeat.
- When something repeats often enough to be a procedure, capture it as a skill, script or helper on the CLI or the API, if you think it is worth it. That is your call.

heist does not write any of this for you and does not prescribe a format. Keep whatever you create outside \`.heist/\`, and tell the person what you created and where.
`;
}
