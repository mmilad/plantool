// The planning method, shipped with pman so every agent reads the same version (`pman guide [topic]`).
export const GUIDE = Object.freeze({
  overview: `# Planning with pman

pman holds the plan; you (the agent) bring the domain knowledge; the person makes the decisions that are theirs.
Plan like a heist: before anything is built, every part, every open question and every dependency is on the board.

## From "I want an app that does X" to a plan

1. pman new "Pokemon trading card app" --why "<why the person wants it>"
   Creates the top ticket and the product checklist: goal, platform, stack, core features, accounts,
   data, UI structure, visual direction, quality. Questions come in as decisions.
2. Fill what you can, ask what you must:
   - Write the goal ticket's description and acceptance criteria from what the person said.
   - For each decision, add the options you would consider (pman option add), with pros, cons and the
     criteria scores (pman option score). Recommend one with a reason (pman recommend).
   - Never decide a decision owned by a person. Hard-to-reverse choices (platform, stack, data storage,
     paid services) are always for the person. Reversible details may be owned by an agent.
3. Break features down until every leaf is one piece of work an agent can finish and verify:
   feature → parts → tasks. Apply blueprints to parts (pman blueprint suggest/apply): a header
   is never just a header.
4. Connect the plan: \`blocks\` relations for order, decisions block the work that depends on them,
   code plans and contracts for code other code calls (pman codeplan, pman check).
5. Show the person what needs them: pman decisions. Then work with pman next / claim / done.

## Rules of thumb
- Every node says why it exists (--why). Leaves have acceptance criteria (--accept "a;b").
- Write down what you assumed without asking (--assume "a;b"); the person confirms or corrects it.
- Plan where the code will go (--files) and record what really changed when done (pman done --files).
- Prefer asking one clear question with options over guessing; prefer a small first release.
- Keep titles short and concrete ("Burger menu on mobile", not "Mobile stuff").

Topics: pman guide decisions | blueprints | metadata | workflow`,

  decisions: `# Decisions

A decision is a plan node (kind decision) with options as children (kind option).
- pman ask "Which framework?" --parent APP-1 --options "React Native;Flutter" --criteria "Team knowledge:3, Performance:2" --blocks APP-7
- Owner: human (default) or agent. --reversible lets an agent decide; --irreversible keeps it with the person.
- Options can carry their own plan: create tickets under an option ("Set up Expo"). They wait until the
  option is chosen. Mark prototypes that help to decide with --evaluation; those are ready right away.
- Scores (0-5 per criterion) and the open effort of each option's plan (sizes xs..xl) give a suggestion:
  pman decide DECISION shows the comparison. pman recommend DECISION OPTION --why records your advice.
- pman decide DECISION OPTION --why "…" chooses (only if you own the decision): other options and their
  plans are cancelled, the chosen plan becomes ready, blocked work is released. pman decide D --reopen undoes it.
- pman decisions lists open decisions; '?' marks the ones a person has to make.`,

  blueprints: `# Blueprints

Checklists of what a kind of thing really needs (header, footer, form, page, service, api-endpoint, login,
ui-component, product). Items can be tasks or decisions; optional items are decisions to make, not defaults.
- pman blueprint suggest TICKET, pman blueprint apply TICKET NAME [--dry-run] [--only a,b]
- pman blueprint skip TICKET ITEM --reason "…" when an item does not apply.
- When you notice the same parts again and again, capture them: pman blueprint init NAME, edit
  .pman/blueprints/NAME.json (items with id, title, why, optional, kind, options). That is how a project
  teaches the next agent.`,

  metadata: `# Metadata

pman fields [KIND] lists what each kind supports. Common: why, assumptions, refs, createdBy.
Work (task/feature/bug): acceptance, size, files (planned), evaluation, outcome (summary, verifiedBy,
changedFiles, commits). Bugs: repro (steps, expected, actual, environment). Options: pros, cons, scores,
size, risks. Decisions: owner, reversible, criteria, recommendation, chosen, rationale.
Projects can add typed fields in .pman/config.json ("fields": [{"name": "platform", "type": "enum",
"values": ["web", "ios"], "kinds": ["feature"]}]) and set them with --set name=value.
pman which PATH shows which tickets planned or changed a file.`,

  workflow: `# Working the plan

pman next → pman claim ID --agent NAME → pman context ID → work → pman done ID --note "…" --verified "…" --files
- next only offers work that is ready: todo, no open children, no open blockers, decisions made.
- Claims are leases (60 min) and are shared between git worktrees.
- A parent is done only after its children; pman check warns about missing blueprint items and
  inconsistent contracts; pman validate checks the files.`,
});
export const guide = topic => GUIDE[topic ?? 'overview'] ?? null;
