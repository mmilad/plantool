// The planning method, shipped with heist so every agent reads the same version (`heist guide [topic]`).
export const GUIDE = Object.freeze({
  overview: `# Planning with heist

heist holds the plan; you (the agent) bring the domain knowledge; the person makes the decisions that are theirs.
Plan like a heist: before anything is built, every part, every open question and every dependency is on the board.

## From "I want an app that does X" to a plan

1. heist new "Pokemon trading card app" --why "<why the person wants it>"
   Creates the top ticket and the product checklist: goal, platform, stack, core features, accounts,
   data, UI structure, visual direction, quality. Questions come in as decisions.
2. Fill what you can, ask what you must:
   - Write the goal ticket's description and acceptance criteria from what the person said.
   - For each decision, add the options you would consider (heist option add), with pros, cons and the
     criteria scores (heist option score). Recommend one with a reason (heist recommend).
   - Never decide a decision owned by a person. Hard-to-reverse choices (platform, stack, data storage,
     paid services) are always for the person. Reversible details may be owned by an agent.
3. Break features down until every leaf is one piece of work an agent can finish and verify:
   feature → parts → tasks. Apply blueprints to parts (heist blueprint suggest/apply): a header
   is never just a header.
4. Connect the plan: \`blocks\` relations for order, decisions block the work that depends on them,
   code plans and contracts for code other code calls (heist codeplan, heist check).
5. Show the person what needs them: heist decisions. Then work with heist next / claim / done.

## Rules of thumb
- Every node says why it exists (--why). Leaves have acceptance criteria (--accept "a;b").
- Write down what you assumed without asking (--assume "a;b"); the person confirms or corrects it.
- Plan where the code will go (--files) and record what really changed when done (heist done --files).
- Prefer asking one clear question with options over guessing; prefer a small first release.
- Keep titles short and concrete ("Burger menu on mobile", not "Mobile stuff").

Topics: heist guide decisions | blueprints | metadata | workflow`,

  decisions: `# Decisions

A decision is a plan node (kind decision) with options as children (kind option).
- heist ask "Which framework?" --parent APP-1 --options "React Native;Flutter" --criteria "Team knowledge:3, Performance:2" --blocks APP-7
- Owner: agent (default) or human (--owner human). Reversible or not is information for whoever reads the decision.
- Options can carry their own plan: create tickets under an option ("Set up Expo"). They wait until the
  option is chosen. Mark prototypes that help to decide with --evaluation; those are ready right away.
- Scores (0-5 per criterion) and the open effort of each option's plan (sizes xs..xl) give a suggestion:
  heist decide DECISION shows the comparison. heist recommend DECISION OPTION --why records your advice.
- Decisions are owned by agents by default: decide them when you have enough to go on, and say why.
  A person can take one with --owner human; then only --by human may decide or reopen it. A person can always change
  any decision: heist decide DECISION OPTION --by human --why "what they said" (or --reopen first).
- heist decide DECISION OPTION --why "…" chooses: other options and their plans are cancelled, the chosen plan
  becomes ready, blocked work is released. heist decide DECISION --reopen undoes it.
- heist decisions lists open decisions; '?' marks the ones a person has to make.`,

  blueprints: `# Blueprints

Checklists of what a kind of thing really needs (header, footer, form, page, service, api-endpoint, login,
ui-component, product). Items can be tasks or decisions; optional items are decisions to make, not defaults.
A blueprint lists what to think of. What becomes a ticket is your call, item by item:
- Work of its own becomes a child ticket: heist blueprint apply TICKET NAME --only a,b (without --only: every
  required item; --dry-run shows what would be created).
- Information belongs on the ticket itself (description, --accept, --files, --why …). Write it there, then record
  it: heist blueprint answer TICKET ITEM --note "see acceptance". Do not create tickets whose only work is writing.
- heist blueprint skip TICKET ITEM --reason "…" when an item does not apply.
- heist blueprint suggest TICKET finds a fitting blueprint; heist blueprint attach TICKET NAME puts the checklist
  on the ticket without creating anything.
- When you notice the same parts again and again, capture them: heist blueprint init NAME, edit
  .heist/blueprints/NAME.json (items with id, title, why, optional, kind, options). That is how a project
  teaches the next agent.`,

  metadata: `# Metadata

heist fields [KIND] lists what each kind supports. Common: why, assumptions, refs, createdBy.
Work (task/feature/bug): acceptance, size, files (planned), evaluation, outcome (summary, verifiedBy,
changedFiles, commits). Bugs: repro (steps, expected, actual, environment). Options: pros, cons, scores,
size, risks. Decisions: owner, reversible, criteria, recommendation, chosen, rationale.
Projects can add typed fields in .heist/config.json ("fields": [{"name": "platform", "type": "enum",
"values": ["web", "ios"], "kinds": ["feature"]}]) and set them with --set name=value.
heist which PATH shows which tickets planned or changed a file.`,

  contracts: `# Contracts, components and stand-ins

Describe the boundary between parts before the code exists: heist component add --kind service --name UserService,
heist component add --kind method --name getUser --parent UserService, heist contract set UserService.getUser --input '{...}' --output '{...}'.
Contracts stay central and versioned; they may change before they are implemented. After a change, heist check lists the
consumers that are affected.
- A ticket declares its code plan: heist codeplan add TICKET implements|consumes|changes COMPONENT. A consumer lists the
  fields it needs with --requires; heist check verifies them against the contract.
- A stand-in (mock) is an implements entry with --stage mock. A consumer that can work against a stand-in says --needs mock;
  the default (--needs full) waits for the real implementation. Use a stand-in when the logic is complex enough that the
  consumer needs something to run against; for simple logic, implement directly.
- heist check warns when a full consumer has only a stand-in planned.`,

  workflow: `# Working the plan

heist next → heist claim ID --agent NAME → heist context ID → work → heist done ID --note "…" --verified "…" --files
- next only offers work that is ready: todo, no open children, no open blockers, decisions made.
- Claims are leases (60 min) and are shared between git worktrees.
- A parent is done only after its children; heist check warns about missing blueprint items and
  inconsistent contracts; heist validate checks the files.`,
});
export const guide = topic => GUIDE[topic ?? 'overview'] ?? null;
