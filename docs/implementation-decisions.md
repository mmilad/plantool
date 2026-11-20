# Implementation decisions

This file records material choices made while implementing the first usable release against the merged planning contract.

## Roadmap completion and structure (2026-11-13)

- Roadmap phases 1–3 share the canonical tickets and existing workflow readiness. Dependencies follows as phase 4 (PLAN-42); no milestones or event-history entity is introduced.
- `completedAt` is managed by the ticket write path: entering `done` sets it, ordinary edits keep it, and leaving `done` removes it. A later completion receives a new timestamp. Derived parent rollups do not create completion events.
- Legacy done tickets remain readable. Until backfill, the timeline uses `updatedAt` and identifies the date as an estimate; validation warns without invalidating the store. `plantool roadmap backfill-completion --dry-run` previews the explicit, idempotent migration; running without the flag stores the fallback date and preserves `updatedAt`. Historical completion dates cannot be reconstructed exactly from this fallback.
- An ordinary edit of a legacy done ticket pins its previous `updatedAt` as the completion estimate before advancing the update date. `completedAtSource: "updatedAt"` keeps estimates labelled after migration; reopening removes this marker too. Backfill reports invalid legacy dates in `skipped` without inventing a timestamp. Ticket updates and backfill share a write lock so neither can overwrite the other's changes.
- Timeline contains done tickets only. Cancelled work stays visible in Structure; cancellation history needs a separate timestamp contract before inclusion. Open work is not appended to completion history.
- Structure filters keep nonmatching ancestors as `contextOnly` rows, retaining real depth and explaining the context marker. These rows are navigation context, not matching tickets. `blockedBy[].via` distinguishes explicit `blocks` from contract `provider` dependencies, including inherited blockers.
- Roadmap pagination is deterministic, with a ticket-ID tie-break and a snapshot token. A stale token yields `STALE_ROADMAP` (HTTP 409); callers restart from the first page. Reads never backfill canonical data.
- Existing `plantool tree` behavior stays unchanged without new flags. Enriched projections and timeline are available through the public API, CLI and project-scoped HTTP endpoints.

## Roadmap dependencies (2026-11-14)

- Phase 4 uses an accessible edge table on desktop and small screens, sharing one read-only projection across CLI, public API and HTTP. There is no graph layout dependency or new canonical record type.
- `workGraph` supplies explicit blockers and provider edges, preserving mock/full provider selection. Equal provider/consumer pairs coalesce their component references; an explicit block between the same tickets remains a distinct edge. Direction is blocker to blocked.
- Default edges have two unfinished endpoints. `includeFinished` exposes all historical relationships, including cancelled endpoints. This view does not claim that every displayed ticket is ready or blocked solely by these edges; child, decision and claim checks still belong to readiness.
- A root selects its subtree and direct cross-boundary dependencies plus incoming blockers of its ancestors. Outside endpoints are context; inherited edges retain the actual ancestor target. We do not invent a direct block on every descendant.
- The response retains the selected root, scoped endpoints, then outside context in deterministic key/ID order. At most 200 nodes and 500 edges are returned, with endpoint closure and exact omitted counts. Dense graphs therefore remain bounded even below the node cap. The UI asks users to narrow their root when truncated.
- Snapshots cover the full scoped projection and query, including the cap. Hidden dependency changes invalidate the snapshot too. Repeated reads never mutate canonical records.

## Runtime and package

- On 2026-11-20 the owner superseded the initial naming choice: product/project `Plan`, npm package `@mmilad/plantool`, and command `plantool`.
- The 2026-10-29 registry lookup was historical evidence only; current package name and availability must be rechecked before publishing. The owner confirmed control of the `@mmilad` scope on 2026-11-20.
- The npm scope syntax is `@scope/package`; `mmilad/pm` is represented as the scoped package `@mmilad/plantool`. The current package install example is explicitly for after publication.
- Runtime floor: Node.js 22, with CI targeting Node 22, 24, and 26. These are the supported LTS lines at implementation start. No OS/CPU restriction or native dependency is introduced.
- ESM package with JavaScript runtime and first-party `.d.ts` declarations. The core has no third-party runtime dependencies.
- `@mmilad/plantool` is intended to be installed as a project-local dependency. npm publication remains a separate release action.

## Data contract

- Store version and record schema version begin at `1`; canonical structured data is JSON, LF, two-space indented, and newline terminated.
- UUIDv7 IDs are generated from Node crypto primitives. Record filenames are based only on IDs and sharded by their first two characters.
- Default statuses are `todo`, `in_progress`, `done`, and `cancelled`. Custom status catalogs are project configuration; reads preserve unknown stored statuses, while writes require a configured status.
- Ticket rollups are query-time values and never mutate stored child statuses.
- Reads validate but never migrate or rewrite data. There is no earlier released format to migrate in this initial release; unsupported store/schema versions fail with a typed diagnostic.
- Writes use same-directory temporary files and rename, with stale-revision checking. This is local filesystem protection, not distributed locking.

## Browser UI

- `plantool serve` binds only to `127.0.0.1:4000` by default and fails clearly if occupied; only a caller-supplied `--port` may override it. No random fallback or automatic process termination. `--open` runs only after a successful bind. No LAN option is provided. The original single-project boundary was replaced on 2026-11-08; see "Multi-project workspace" below.
- Mutating requests require the server's exact Host, same-origin Origin, and a per-server CSRF token. CORS is disabled; no external assets or project code are executed.

## Scope

- MVP includes core project/config, ticket, planning document, comment, relationship, search, context, validate and browser workflows.
- Agent execution, auth/hosted sharing, extensions/hooks, binary asset ingestion and automatic publication remain excluded. MCP is implemented as an optional stdio adapter (see "MCP server" below). Semantic search is an optional local feature; keyword search is always available.
- Cross-platform CI is configured for Windows, macOS and Linux on Node 22, 24 and 26; check the run for the exact release commit before publishing.

## Agent planning, code plans and contracts (owner decision 2026-11-07)

- Purpose: plantool lets agents plan a whole product (goals, UI, services, code and contracts) before implementation and check that plan for consistency before code is touched.
- Tickets get a small `kind`: `task`, `feature`, `bug`. The ticket kind does not decide whether a contract is required.
- Code structure is not modelled as ticket subtypes. A ticket carries an optional **code plan** that references central, long-lived architecture records instead of copying them:
  - `components`: `module`, `service`, `class`, `method`, `function`, `ui-component`, nested via `parentId`; the kind catalog is project configuration like statuses.
  - `contracts`: one contract per method/function, maintained centrally and versioned, never duplicated per ticket.
  - `types`: shared types (for example `User`) referenced with `$ref`, using a JSON Schema subset (string, number, boolean, array, object, required, `$ref`).
- Code-plan entries on a ticket: `implements` a component, `consumes` a contract with the fields it `requires`, `changes` a contract. A plain task (for example a colour or font-size change) has no code plan.
- `plantool check` validates per-kind rules (a service needs methods, a method/function needs a contract), consumer requirements against provider contracts (for example a consumer requiring `getUser.userId` that the contract does not return), missing providers and type mismatches, and lists affected consumers for `changes`.
- A parent ticket cannot be set to `done` while children or blockers are open, unless forced. Consumers are implicitly not ready until the provider ticket of a consumed contract is done; `plantool next` uses this ordering (contract, provider, consumer).
- Deferred: contract version history and breaking-change detection; generating types, mocks or contract tests from contracts and comparing plans with real code.

## Agent workflow (implemented 2026-11-07)

- Readiness: a ticket is ready when it is `todo`, has no open children, and neither it nor an ancestor has an open (not done/cancelled) `blocks` dependency or a cancelled ancestor. Done or cancelled blockers never block rollups or readiness.
- `plantool next` ranking: effective priority (explicit priority wins; `normal` inherits from the nearest ancestor with an explicit priority), transitive unblock count (including edges of ancestors), focus on parents with work in progress, then creation time and ID for determinism. Every row carries human-readable reasons.
- Claims are stored on the ticket as `assignee { agent, claimedAt, expiresAt }` so they are visible in Git and across worktrees; default lease 60 minutes. Expired leases are offered again by `next` and can be claimed by another agent. A short lock directory in the OS temp folder (keyed by project root) serialises concurrent claims in one checkout; nothing is written to the repository for locking.
- `plantool done` refuses to finish a ticket with open descendants or blockers unless forced, clears the claim, records an optional note as a comment authored by the agent, and returns tickets that became ready.
- `plantool agent onboard` only prints a briefing for agents (tools, node types, states, relationships, workflows). It writes nothing; agents decide for themselves what they keep.
- Line endings: `.gitattributes` enforces LF for text files; planning-document parsing also tolerates CRLF.

## Code plans and contracts (implemented 2026-11-07)

- Storage: `.plan/components/`, `.plan/types/`, `.plan/contracts/`, same sharded UUIDv7 JSON format as tickets. A ticket stores its plan in `codePlan { implements, consumes, changes }`, each entry referencing a component ID; `consumes` entries carry `requires` (output paths, optionally `path:type`) and optional `provides` (input fields supplied).
- Components have a kind from `config.componentKinds` (default `module`, `service`, `class`, `method`, `function`, `ui-component`), a name without dots, and a parent; names are unique among siblings and addressed by qualified name (`UserService.getUser`), unique short name or ID. An exact qualified name wins over a short-name match.
- One contract per component; any component kind may have one (for example UI component props), method and function are expected to. Versions start at 1 and increase only when input or output change; types are versioned the same way. Previous versions are kept in the record's `history` (Git keeps the full file history as well).
- Breaking-change rules follow who reads the value: outputs break on removed fields, required-to-optional, added enum values and types the old consumers cannot accept (integer to number is compatible, number to integer is not); inputs break on new required fields, optional-to-required, removed enum values and narrowed types. `$ref`s are compared structurally. A type change is evaluated through every contract that reaches it.
- Affected consumers are open tickets whose `requires` paths overlap a breaking output change, or whose `provides` does not cover a breaking input change; consumers without `provides` are reported for every breaking input change. `--dry-run` previews impact without writing.
- Schema language: JSON Schema subset plus a shorthand that normalises to it on write; stored data is always the normalised form. Path lookup follows `$ref`s and descends into array items implicitly.
- `plantool validate` stays structural (dangling references, duplicate contracts or type names). `plantool check` is the design check and exits non-zero on errors; warnings never fail it.
- A consumer ticket implicitly depends on every open ticket that implements the consumed component or one of its ancestors. These implicit edges count for readiness, `next` ranking, the parent-done rule and cycle detection, but are not stored as relationships.

## Server record cache (implemented 2026-11-07)

- `openProject({ cache: true })` keeps parsed records per folder in memory; `plantool serve` enables it, the CLI does not. Every read first lists the folder and compares file names, sizes and mtimes with the cached stamp, so changes from the CLI, Git or other processes are picked up on the next read. Canonical files stay the only source of truth; there is no on-disk index.
- A load is cached only if the folder stamp is unchanged before and after loading. Cached records are deep-frozen and arrays are copied per call, so callers cannot mutate shared state.
- Measured with 6,063 synthetic tickets (2 KB descriptions): tree page 0.45 s → 0.13 s, search ~1 s → 0.11 s, ticket plan 1.3 s → 0.33 s.
- `GET /api/version` exposes per-area fingerprints (size and mtime, cached for 2 s) that the UI polls every 5 s while visible to refresh changed areas.

## Multi-project workspace, Jira look and ticket keys (owner decision 2026-11-08)

This supersedes the earlier single-project server boundary and the "no machine-global registry" constraint.

- Registry: a machine-local file `~/.plan/projects.json` (override with `PLANTOOL_HOME`) lists known projects by project ID, name, key and root path. `plantool init` and every CLI command run inside a project register it automatically; `plantool projects` lists, adds and removes entries; entries whose `.plan/config.json` is gone are shown as missing and can be pruned. The registry is a convenience index only: canonical data stays in each repository's Git-tracked `.plan/`.
- `plantool serve` works from any directory and serves every registered project on one loopback server. API routes are scoped as `/api/projects/:projectId/...`; the UI can add a project by path and remove it from the registry (never deleting files). Host/Origin/CSRF protections and loopback-only binding stay.
- Visual direction: close to Jira (owner decision, replacing "fp.dev look, Jira workflows only"): project directory, left project sidebar, board with status columns, list/backlog, issue detail with a details panel, issue-type icons, status lozenges, Jira-like colours and typography. No Jira logos, trademarks or proprietary assets.
- Ticket keys: each project has a key (2–10 uppercase letters, `config.key`, derived from the name if unset) and tickets get a sequential `number`; the display key is `KEY-number`. The UUID stays the identity; CLI commands and URLs accept either. Numbers are allocated under a short lock (max + 1); duplicates from parallel branches are reported by `plantool validate` and fixed with `plantool keys renumber`. `plantool keys init` sets the key and numbers existing tickets by creation time.

## Storage stays in the repository (owner decision 2026-11-08)

- Canonical planning data remains Git-tracked under `.plan/` in each repository. Record-per-file JSON/Markdown keeps merges readable, and agents review plan changes in pull requests together with code. No central data directory and no gitignored mode for now.
- Known trade-off: claims and status changes made in one worktree or branch are visible to agents in other worktrees only after a merge. Revisit if parallel agents in separate worktrees start colliding.
- Until a usable version exists, Plan is the only planned project. The final product name and npm publication follow later.

## Local cache database (owner decision 2026-11-08)

- Derived data lives in one SQLite file per project: `~/.plan/cache/<projectId>/db.sqlite` (under `PLANTOOL_HOME`), never in the repository. It holds the search index, embeddings and file fingerprints as separate tables; it can be deleted at any time and is rebuilt from the canonical `.plan/` files.
- Worktrees and branches of one repository share a project ID but can contain different plan files. Rows are therefore keyed by checkout root and file, and embeddings are stored content-addressed (hash of the embedded text), so switching branches or worktrees only re-embeds text that actually changed and never mixes results between checkouts.
- Concurrency: WAL journal mode (many readers in parallel with one writer), a busy timeout of a few seconds so concurrent writers wait instead of failing, and short write transactions. Index updates are best effort: if the database stays locked or is corrupt, plantool falls back to keyword search over the files and retries later; canonical writes never wait for the cache. Use Node's built-in `node:sqlite` to avoid native dependencies.
- Target audience for now is the solo developer on one machine: `~/.plan` (registry and cache) stays local. A hosted API for teams may come later; the file format and the API routes should keep that option open, but no remote features are built yet.

## Embedding model and duplicate detection (owner decision 2026-11-08)

- Plans are written in English. Default model: `Xenova/multilingual-e5-small` (q8 ONNX via the optional `@huggingface/transformers`), chosen by the quality gate in `bench/search-eval.mjs` (24 queries; Recall@5 English 0.67, overall 0.55; `all-MiniLM-L6-v2` 0.60/0.44, `paraphrase-multilingual-MiniLM-L12-v2` 0.44/0.51). A project can override it with `semantic.model` in `.plan/config.json`. Models download once into `~/.plan/cache/models/`.
- e5 needs `query:` for queries and `passage:` for indexed text. Each ticket additionally stores its title as a `query:`-embedded identity vector, used only for similarity between tickets (symmetric task); search uses the passage vectors only.
- e5 compresses cosine scores into a narrow band, so "likely overlap" is relative: a candidate must stand at least 3.5 standard deviations above the mean similarity of all other tickets (planted duplicate z 3.7, related siblings up to 3.0) and must not already be linked. Ancestors and descendants are excluded. Calibrate again with more real duplicates.
- Keyword search remains available at all times; besides phrase matches it now also matches when all query words occur.
- Server: `GET /api/search?mode=hybrid|semantic` (paged, snapshot bound to the index generation, keyword fallback with `fallbackReason`), `GET /api/search/status`, `POST /api/index/update` (202, runs in the background), `GET /api/tickets/:id/similar` (returns `available:false` instead of an error when there is no index), `POST /api/relations`.
- Indexing is opt-in: `plantool serve` never downloads a model on its own. It re-indexes in the background (every 10 s at most, single-flight, only when tickets, documents or comments changed) only for checkouts that already have an index or where the UI's **Enable semantic search** was used.

## Checklists (PM-83, 2026-11-08)

- A checklist is a named checklist (`items` with id, title, why, optional flag) that may `extend` another; resolution puts own items first, then inherited ones, and an own item overrides an inherited one with the same id.
- Built-ins live in `src/checklists.js`; projects add or override them as readable JSON in `.plan/checklists/<name>.json` (validated on load).
- Applying stores `checklist: {name, skipped}` on the ticket and creates child tickets with `origin: {checklist, item}`. Coverage is derived from those children and the skip reasons, so nothing is duplicated and re-applying only fills gaps. One checklist per ticket; nest tickets for more.
- Optional items are never created by default; they count as "undecided" until created or skipped with a reason. Missing and undecided items are warnings in `plantool check`, not blockers for `done`.
- An item is covered in one of three ways, chosen by the planner per item and not by the checklist (owner guidance 2026-11-12, PLAN-14): a child ticket when it is work of its own (`apply --only`), an answer on the ticket itself when it is information (`answer --note`, stored in `checklist.answered`), or a skip with a reason. `checklist attach` puts the checklist on a ticket without creating tickets. `apply` without `--only` still creates every required item.
- Suggestions are keyword based (title and labels, or a `checklist:<name>` label) and only shown, never applied automatically. A ticket of kind `feature` is also offered the `feature` checklist (2026-11-11).

## Claims across worktrees (PM-82, 2026-11-08)

- Each worktree has its own `.plan/`, so a claim used to be visible elsewhere only after a merge. Claims are now mirrored in the common Git directory (`<repo>/.git/plantool/claims.json`), found without spawning git (`.git` directory, or `.git` file → `gitdir` → `commondir`).
- `claim` fails with CONFLICT when another worktree holds an active lease (unless `--force`), `next` skips tickets claimed elsewhere, `release`/`done` remove the entry. Expired leases are cleaned up on the next claim.
- The ticket files remain the source of truth inside a worktree; the shared file is only coordination and is never committed. No Git repository or `PLANTOOL_SHARED_CLAIMS=0` → no-op.

## Verification and remaining release work

- Local checks were run on Node 24.22.1/Linux: package syntax checks, 11 tests (including a 10,000-deep parent chain and HTTP security checks), JSON Schema parsing, `npm pack --dry-run`, local tarball install, `npm exec -- plantool --help`, and a public API import smoke check.
- The 100,000-record wide-tree benchmark passed locally: record fixture generation 9,950 ms, tree query 14,855 ms, validation 12,606 ms, peak RSS about 450 MiB. These are measurements from this environment, not release performance guarantees.
- GitHub Actions is configured for Windows, macOS and Linux on Node 22, 24 and 26. The matrix results should be checked on this branch before treating the release as validated.
- No migration is needed from a prior released format; schema/store version 1 is the initial version. Windows/macOS execution remains subject to the pending GitHub Actions jobs.
- Before publishing, resolve the npm package identity with the owner, rerun the cross-platform matrix, and review the remaining CLI/API coverage against the roadmap. This task does not publish or merge.

## Decisions and stand-ins (2026-11-08)

- Decisions are owned by agents by default; an agent may decide them. A person can take a decision with `--owner human`; then only `--by human` may decide or reopen it. Anyone can change an agent-owned decision afterwards, and the decider is recorded. The decider defaults to unknown, not human. Nothing forces a person to decide. The tool guards against mistakes, not against an agent that invents an answer.
- Ready work means every `blocks` blocker is finished. A stand-in changes only what a consumer waits for: `implements --stage mock` and `consumes --needs mock`. The default `full` keeps the previous behaviour.
- Checklist items may declare `after`; that becomes `blocks` relations when the checklist is applied. The product checklist orders platform after goal, stack after platform, UI structure after stack, core features and accounts.
- Finishing a ticket with an active claim needs the claimant (`--agent`) or `--force`.
- Local web view requests act for the person (`by` defaults to human); there is no separate authorisation.

## Similarity hint in ticket create (2026-11-11)

- `ticket create` names possibly related tickets. Without a model it compares title words. With the optional model it adds tickets that are close in meaning, unless `PLANTOOL_SIMILAR=off`.
- The fixed cosine threshold of 0.86 was removed. It flagged unrelated short titles (0.864 in the first calibration; 0.88 between two unrelated email tickets in the check below) and only fits one model.
- The plain z-score of `plantool similar` (3.5 standard deviations above the mean) was tried and not used for the hint: related tickets come in groups, and a group raises mean and deviation until none of its members stands out. Measured with `multilingual-e5-small` on 20 unrelated titles: one related ticket z 3.6, two 2.9 and 2.6, four 2.0 to 2.3.
- The hint therefore uses a robust strength: distance from the median in units of 1.4826 x median absolute deviation, threshold 3.5 (`HINT_STRENGTH`). Same data: related tickets 3.8 to 5.0 with one, two or four present; unrelated ones at most 2.4. With fewer than 10 other tickets (`MIN_HINT_POPULATION`) there is no hint by meaning.
- `likelyOverlap` in `plantool similar` still uses the plain z-score. It has the same group weakness and should be checked against the robust strength once the plan has enough real tickets (PLAN-7).
- Known cost: the hint embeds every other ticket on each `ticket create` (up to 2000) and loads the model in every CLI call. Reusing the semantic index is planned (PLAN-13).
- `test/semantic-real.test.js` runs the real model when `PLANTOOL_TEST_REAL_MODEL=1`; it is skipped otherwise. It passed on Linux/Node 22 on 2026-11-11; Windows is still to be checked (PLAN-3).

## Blueprints and checklists (owner decision 2026-11-12)

- What was called a blueprint until now (a list of parts that expands a ticket, for example header or product) is a **checklist**: `plantool checklist`, `project.checklists`, `.plan/checklists/`, ticket fields `checklist` and `origin.checklist`, warning codes `CHECKLIST_*`. Older sections of this file were renamed with it. Nothing was published, so there is no compatibility layer; this repository's plan was migrated.
- A **blueprint** is now what the owner first meant by the word: what is expected of a ticket of a kind, like a Linear issue template or a GitHub pull request template. One blueprint per kind (`task`, `feature`, `bug`, `decision`), built in, replaceable per project with `.plan/blueprints/<kind>.json`.
- A blueprint lists `expects` (field, hint, `optional`, `when: "leaf"` for fields that only make sense on tickets without children) and may carry a `template` for the description. Fields are the existing ticket fields plus `description` and the project's custom fields; no new ticket fields were added.
- Nothing is enforced. `ticket create` names what is still empty, `plantool blueprint status` and the context packet (`expected`) show it later, `plantool blueprint check` lists the tickets, and `plantool check` adds one summary warning instead of one per ticket.
- A file with `items` in `.plan/blueprints/` is refused with a pointer to `.plan/checklists/`, in case an old checklist is left there.
- The feature checklist lost its items `behaviour` and `tests`; the feature blueprint expects them on the ticket (description, acceptance). It keeps `states`, `data` and `contracts`.
- Not done yet: the web view does not show the expected fields (PLAN-21).

## Onboarding keeps itself alive (owner decision 2026-11-12)

- `plantool agent onboard` still only prints. It now tells the agent to make sure a later session finds plantool again: add a short note to the instruction file its tool reads (for example `AGENTS.md` or `CLAUDE.md`) if plantool is not mentioned there, write down how it uses plantool, and capture procedures as skills or helpers when it thinks that is worth it. plantool writes none of this itself and prescribes no format.
- There is therefore no `plantool` command that edits `AGENTS.md`. The one thing a person still has to do is tell the first agent in a project to run `plantool agent onboard`; `plantool --help` now starts with that line.
- For the MCP server (PLAN-9): a short version of the briefing belongs in the server instructions, the full text behind a guide tool, so not every session pays for the whole briefing.

## Readable tickets (owner feedback 2026-11-12)

- The owner opened the tickets in the web view and could not tell what they were about: they had a title, a why and acceptance criteria, but no description, and the web view showed only the description. The point of a blueprint is that a ticket can be understood without asking, like a pull request written from a template: title, description, acceptance criteria, to-dos.
- Blueprints now expect a `description` for tasks, features and bugs, and offer `todos`: a new ticket field for work kinds, a checklist like `acceptance` (`--todo "a;b"`, `--add-todo`, `plantool ticket todo ID N`). It holds the steps in order, including commands.
- A ticket is presented as a document in blueprint order, with missing expected sections named, followed by other filled fields: `plantool ticket show` (text; `--format json` is unchanged) and the ticket page of the web view. In the web view to-dos and acceptance criteria can be ticked.
- Still missing in the web view: editing these fields and starting a new ticket from the description template (PLAN-21).
- The open tickets of this repository were rewritten to this standard.

## Editing blueprints, tickets and comments (owner decision 2026-11-12)

- Blueprints can be changed from the CLI (`plantool blueprint expect|drop|template|reset`) and on the Blueprints page of the web view; both use `project.blueprints.save/expect/drop/reset` and write `.plan/blueprints/<kind>.json`. `plantool blueprint init` remains for editing the file directly.
- A section whose name is not a field of the kind yet is created as a project field (`config.fields`, kinds limited to that kind) in the same call. Project fields can be text, list, number, bool or enum; not a checklist.
- Routes: `GET /api/blueprints/:kind`, `PUT /api/blueprints/:kind` (sections and template), `POST /api/blueprints/:kind/expect` (add or change one section, creating the field if needed), `DELETE /api/blueprints/:kind` (reset).
- The ticket page edits every field of the kind, blueprint sections first. To-dos and acceptance criteria are edited as one line per item; ticks are kept for lines whose text did not change. Emptying a field removes it from the ticket. The existing conflict handling applies: a save after someone else changed the ticket is refused and the typed text is kept.
- People comment on the ticket page (author `person`). The CLI records the author from `PLANTOOL_AGENT` or `--author`, and `plantool comment list` reads them.
- The create dialog names what the chosen kind expects and starts from its description template.
- The rule for agents was narrowed: the plan's records are never edited by hand; blueprints and checklists are settings and may be changed with the commands or in their files.
- Checked in headless Chromium on Linux: edit and save, comment, create dialog, a new section, reorder, template, save. Not checked on Windows.

## Relation graph (PLAN-47, 2026-11-14)

- The Roadmap page has a fourth tab, Graph, and there is a command `plantool graph [--root ID] [--limit N] [--format json]`. Both use `project.relationGraph` (route `GET /api/roadmap/graph`).
- Layout: layered columns. A ticket is placed in a column after the tickets that block it; rows count down inside a column.
- Drawing: our own SVG in `src/ui.js`, no graph library. This keeps the page free of dependencies and the layout fixed and testable.
- All relation types are drawn. `blocks` is a solid line with an arrow, the others are dashed lines without an arrow.
- Tickets without any relation are counted (`hidden`) but not drawn. The status line says how many.
- At most 200 tickets are drawn; `truncated` says when the result was cut, and a root ticket narrows it.
- The Dependencies table stays. It lists blockers per ticket; the Graph shows all relation types in one picture.
- Not checked in a browser: the drawing was run in Node against the real data only.

## Similar tickets for a new idea (PLAN-58)

- `plantool similar --text "..."` compares a free-text idea with every ticket's title vector, before the ticket exists. `plantool similar TICKET` is unchanged apart from its default.
- The default no longer cuts candidates by z-score (it was 1.5). The top `--limit` matches (5) are listed with their score and strength; agents decide. `--strength Z` restores a cut. `likelyOverlap` still uses the plain z-score (OVERLAP_Z 3.5), so it is only a hint.
- Measured on the real plan: related texts score about 0.85 to 0.89, unrelated ones about 0.81. A text without a match in the plan still gets a full list, so the score band, not the list, decides relevance. Calibration stays with PLAN-7.

## Calibration of likely overlap on a fixture plan (PLAN-7)

- `bench/search-eval.mjs` no longer reads this repository's plan. It builds a throwaway project from the 34 fixture tickets in `bench/search-eval.json` (31 related pairs in 7 groups, 1091 unrelated pairs) and reports the search quality and the calibration.
- Search with `multilingual-e5-small` on 24 queries: semantic Recall@5 0.83, MRR 0.93 (en 0.90 / 1.00, de 0.72 / 0.83, mixed 1.00 / 1.00). Keyword only: Recall@5 0.15. Hybrid equals semantic here.
- Plain z (`strength`): related pairs median 2.15, 6% reach OVERLAP_Z 3.5; unrelated pairs 0% reach it (max 2.79).
- Robust strength (`robust`, the create hint's measure): related pairs median 2.38, 26% reach HINT_STRENGTH 3.5; unrelated pairs 0.1% reach it (1 pair, max 4.31).
- Decision: `likelyOverlap` keeps the plain z-score and OVERLAP_Z 3.5. The robust value is reported next to it as `robust`. Reason: on the repository's real plan, plantool similar PLAN-24 gave PLAN-8 (Windows command name, unrelated) a robust 4.1, so the robust measure would flag unrelated short Windows tickets. The plain z stays conservative and misses most related pairs. Revisit once real duplicate pairs are recorded.

## MCP server (PLAN-9)

- `plantool mcp --agent NAME` serves the Model Context Protocol over stdio for one project (the working directory). No network port, no SDK: the protocol is newline-delimited JSON-RPC and fits in `src/mcp.js`, so the project keeps zero required dependencies.
- Stage 1 (read) and stage 2 (work loop) only: next, ticket show and list, context, search (hybrid, keyword fallback), similar, deps, decisions, comments, validate, guide, claim, done, ticket create and update, to-do tick and rename, comment, relation, and decisions the agent owns (ask, recommend, decide).
- The agent name comes from the server (`--agent` or `PLANTOOL_AGENT`), never from a tool argument. No tool accepts `by`, `owner`, `author` or `createdBy`. A person's decision is refused by the same rule as on the CLI (CONFLICT).
- Not in v1: checklist answers and skips, release, forced finish, decision and component structure, blueprints, projects, keys, index rebuilds, deletion.
- Server instructions are short; the full briefing is behind `plantool_guide`, as decided under "Onboarding keeps itself alive".
- Usage in a client configuration: command `plantool`, arguments `mcp --agent NAME`, working directory the project.

## First npm release readiness (2026-11-20)

At the initial review, the repository had no `todo` or `in_progress` tickets and no open decisions; `plantool check` reported valid with no warnings. Follow-up work reopened the release audit (PLAN-69), completed retry-safe creation (PLAN-70), and renamed the product/package/CLI. Publication is not cleared until PLAN-69 is closed and the exact-commit CI and final npm checks are complete.

Before publishing, close these evidence/owner checks:

- Owner confirmed control of the `@mmilad` user scope on 2026-11-20. Recheck the current published versions and choose an unused version immediately before publishing. npm documents that each user's scope is unique and only that user can add packages; a public scoped package's first publication must explicitly use `--access public` ([scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)).
- The latest GitHub Actions run visible during this review, [run 20](https://github.com/mmilad/plantool/actions/runs/43633080902) on commit `a5e48ba`, failed. Windows and macOS exposed a brittle worktree path assertion; macOS also exposed a comment paging test that assumed unique millisecond timestamps. The local branch now compares real paths and waits for distinct timestamps in that fixture. Those test changes still need a successful fresh matrix run before release.
- Run the release-candidate checks against the exact commit: syntax and tests, declaration/package contents, tarball installation, CLI and API smoke checks, and the opt-in semantic-model flow. Existing tickets record successful checks on Windows Node 24; that is not a substitute for checking the release commit.
- `npm pack --dry-run --json` lists the expected 25 files under `@mmilad/plantool`: package metadata, executable, source, schema, README and MIT license; it excludes tests, plan data and development docs. A real tarball was installed in a clean temporary project with optional dependencies omitted; the installed `plantool --version` returned `@mmilad/plantool 0.1.0` and package metadata pointed to `bin/plantool.js`.
- Decide the release version and confirm npm's required two-factor authentication or an appropriately scoped granular access token. Current version is `0.1.0`; no version bump or publication was performed as part of this audit. npm requires 2FA or an eligible token for direct publishing and recommends reviewing package contents and installing the tarball before release ([publishing guidance](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)).
- PLAN-70 is complete. Close PLAN-69 after a fresh cross-platform CI run passes on the renamed commit and remaining release checks are recorded.

The owner chose to block the first npm release until ticket creation is retry-safe. The implementation now accepts an optional `requestKey`, stores a canonical SHA-256 payload fingerprint with the ticket, replays identical requests, and rejects key reuse with a changed payload. The browser preserves the attempted draft and key in session storage. The full suite now passes locally; a fresh cross-platform CI run is still required before the release ticket can close.

### Product and repository rename (2026-11-20)

The owner renamed the GitHub repository to `mmilad/plantool` and updated the local `origin`. The product/project identity is `Plan`; the npm package and primary executable are `@mmilad/plantool` and `plantool`. The local canonical project directory is `.plan/`, with project key `PLAN`; machine-local registry/cache defaults use `~/.plan`, and environment variables use the `PLANTOOL_` prefix. We chose the descriptive command `plantool` over the proposed short alias `pt` to keep the command aligned with the package and avoid a generic command name. No compatibility alias is included because the package has not been published.

The renamed release candidate passed `npm run check` locally (119 passed, 0 failed, 1 optional real-model test skipped), `plantool check` (0 warnings), and installation of a real tarball in a clean temporary project. A fresh cross-platform GitHub Actions run on the renamed commit and current npm package/version/authentication checks remain release gates. For a public first release, npm's documented command is `npm publish --access public`; no publish command was run during this audit.
