# Implementation decisions

This file records material choices made while implementing the first usable release against the merged planning contract.

## Runtime and package

- Executable: `pman`; npm package: `@mmilad/pm`, selected by the owner on 2026-10-29. This replaces the planning docs' provisional package name `planus-manus`; the executable stays `pman`.
- Registry check on 2026-10-29: unscoped `pman` resolved to version `0.0.5`; `@mmilad/pm` returned npm 404. The scoped package is not published. Registry lookup did not authenticate a publishing user, so scope ownership must be confirmed before any future publication.
- The npm scope syntax is `@scope/package`; `mmilad/pm` is represented as the scoped package `@mmilad/pm`. The current package install example is explicitly for after publication.
- Runtime floor: Node.js 22, with CI targeting Node 22, 24, and 26. These are the supported LTS lines at implementation start. No OS/CPU restriction or native dependency is introduced.
- ESM package with JavaScript runtime and first-party `.d.ts` declarations. The core has no third-party runtime dependencies.
- `@mmilad/pm` is intended to be installed as a project-local dependency. npm publication remains a separate release action.

## Data contract

- Store version and record schema version begin at `1`; canonical structured data is JSON, LF, two-space indented, and newline terminated.
- UUIDv7 IDs are generated from Node crypto primitives. Record filenames are based only on IDs and sharded by their first two characters.
- Default statuses are `todo`, `in_progress`, `done`, and `cancelled`. Custom status catalogs are project configuration; reads preserve unknown stored statuses, while writes require a configured status.
- Ticket rollups are query-time values and never mutate stored child statuses.
- Reads validate but never migrate or rewrite data. There is no earlier released format to migrate in this initial release; unsupported store/schema versions fail with a typed diagnostic.
- Writes use same-directory temporary files and rename, with stale-revision checking. This is local filesystem protection, not distributed locking.

## Browser UI

- `pman serve` binds only to `127.0.0.1:4000` by default and fails clearly if occupied; only a caller-supplied `--port` may override it. No random fallback or automatic process termination. `--open` runs only after a successful bind. No LAN option is provided. It resolves one project from cwd/ancestors and does not enumerate projects.
- Mutating requests require the server's exact Host, same-origin Origin, and a per-server CSRF token. CORS is disabled; no external assets or project code are executed.

## Scope

- MVP includes core project/config, ticket, planning document, comment, relationship, search, context, validate and browser workflows.
- Agent execution, auth/hosted sharing, MCP, extensions/hooks, binary asset ingestion, global installation, and publication remain excluded. Semantic search remains post-MVP: planned as local Node.js + ONNX `all-MiniLM-L6-v2` embeddings and a rebuildable SQLite vector index, with keyword search always available; see `open-questions.md` and the pman search roadmap.
- Cross-platform CI definitions will cover Windows, macOS and Linux; only platforms actually run in this task will be reported as executed.

## Agent planning, code plans and contracts (owner decision 2026-11-07)

- Purpose: pman lets agents plan a whole product (goals, UI, services, code and contracts) before implementation and check that plan for consistency before code is touched.
- Tickets get a small `kind`: `task`, `feature`, `bug`. The ticket kind does not decide whether a contract is required.
- Code structure is not modelled as ticket subtypes. A ticket carries an optional **code plan** that references central, long-lived architecture records instead of copying them:
  - `components`: `module`, `service`, `class`, `method`, `function`, `ui-component`, nested via `parentId`; the kind catalog is project configuration like statuses.
  - `contracts`: one contract per method/function, maintained centrally and versioned, never duplicated per ticket.
  - `types`: shared types (for example `User`) referenced with `$ref`, using a JSON Schema subset (string, number, boolean, array, object, required, `$ref`).
- Code-plan entries on a ticket: `implements` a component, `consumes` a contract with the fields it `requires`, `changes` a contract. A plain task (for example a colour or font-size change) has no code plan.
- `pman check` validates per-kind rules (a service needs methods, a method/function needs a contract), consumer requirements against provider contracts (for example a consumer requiring `getUser.userId` that the contract does not return), missing providers and type mismatches, and lists affected consumers for `changes`.
- A parent ticket cannot be set to `done` while children or blockers are open, unless forced. Consumers are implicitly not ready until the provider ticket of a consumed contract is done; `pman next` uses this ordering (contract, provider, consumer).
- Deferred: contract version history and breaking-change detection; generating types, mocks or contract tests from contracts and comparing plans with real code.

## Agent workflow (implemented 2026-11-07)

- Readiness: a ticket is ready when it is `todo`, has no open children, and neither it nor an ancestor has an open (not done/cancelled) `blocks` dependency or a cancelled ancestor. Done or cancelled blockers never block rollups or readiness.
- `pman next` ranking: effective priority (explicit priority wins; `normal` inherits from the nearest ancestor with an explicit priority), transitive unblock count (including edges of ancestors), focus on parents with work in progress, then creation time and ID for determinism. Every row carries human-readable reasons.
- Claims are stored on the ticket as `assignee { agent, claimedAt, expiresAt }` so they are visible in Git and across worktrees; default lease 60 minutes. Expired leases are offered again by `next` and can be claimed by another agent. A short lock directory in the OS temp folder (keyed by project root) serialises concurrent claims in one checkout; nothing is written to the repository for locking.
- `pman done` refuses to finish a ticket with open descendants or blockers unless forced, clears the claim, records an optional note as a comment authored by the agent, and returns tickets that became ready.
- `pman agent onboard` only prints a briefing for agents (tools, node types, states, relationships, workflows). It writes nothing; agents decide for themselves what they keep.
- Line endings: `.gitattributes` enforces LF for text files; planning-document parsing also tolerates CRLF.

## Code plans and contracts (implemented 2026-11-07)

- Storage: `.pman/components/`, `.pman/types/`, `.pman/contracts/`, same sharded UUIDv7 JSON format as tickets. A ticket stores its plan in `codePlan { implements, consumes, changes }`, each entry referencing a component ID; `consumes` entries carry `requires` (output paths, optionally `path:type`) and optional `provides` (input fields supplied).
- Components have a kind from `config.componentKinds` (default `module`, `service`, `class`, `method`, `function`, `ui-component`), a name without dots, and a parent; names are unique among siblings and addressed by qualified name (`UserService.getUser`), unique short name or ID. An exact qualified name wins over a short-name match.
- One contract per component; any component kind may have one (for example UI component props), method and function are expected to. Versions start at 1 and increase only when input or output change; types are versioned the same way. Previous versions are kept in the record's `history` (Git keeps the full file history as well).
- Breaking-change rules follow who reads the value: outputs break on removed fields, required-to-optional, added enum values and types the old consumers cannot accept (integer to number is compatible, number to integer is not); inputs break on new required fields, optional-to-required, removed enum values and narrowed types. `$ref`s are compared structurally. A type change is evaluated through every contract that reaches it.
- Affected consumers are open tickets whose `requires` paths overlap a breaking output change, or whose `provides` does not cover a breaking input change; consumers without `provides` are reported for every breaking input change. `--dry-run` previews impact without writing.
- Schema language: JSON Schema subset plus a shorthand that normalises to it on write; stored data is always the normalised form. Path lookup follows `$ref`s and descends into array items implicitly.
- `pman validate` stays structural (dangling references, duplicate contracts or type names). `pman check` is the design check and exits non-zero on errors; warnings never fail it.
- A consumer ticket implicitly depends on every open ticket that implements the consumed component or one of its ancestors. These implicit edges count for readiness, `next` ranking, the parent-done rule and cycle detection, but are not stored as relationships.

## Server record cache (implemented 2026-11-07)

- `openProject({ cache: true })` keeps parsed records per folder in memory; `pman serve` enables it, the CLI does not. Every read first lists the folder and compares file names, sizes and mtimes with the cached stamp, so changes from the CLI, Git or other processes are picked up on the next read. Canonical files stay the only source of truth; there is no on-disk index.
- A load is cached only if the folder stamp is unchanged before and after loading. Cached records are deep-frozen and arrays are copied per call, so callers cannot mutate shared state.
- Measured with 6,063 synthetic tickets (2 KB descriptions): tree page 0.45 s → 0.13 s, search ~1 s → 0.11 s, ticket plan 1.3 s → 0.33 s.
- `GET /api/version` exposes per-area fingerprints (size and mtime, cached for 2 s) that the UI polls every 5 s while visible to refresh changed areas.

## Multi-project workspace, Jira look and ticket keys (owner decision 2026-11-08)

This supersedes the earlier single-project server boundary and the "no machine-global registry" constraint.

- Registry: a machine-local file `~/.pman/projects.json` (override with `PMAN_HOME`) lists known projects by project ID, name, key and root path. `pman init` and every CLI command run inside a project register it automatically; `pman projects` lists, adds and removes entries; entries whose `.pman/config.json` is gone are shown as missing and can be pruned. The registry is a convenience index only: canonical data stays in each repository's Git-tracked `.pman/`.
- `pman serve` works from any directory and serves every registered project on one loopback server. API routes are scoped as `/api/projects/:projectId/...`; the UI can add a project by path and remove it from the registry (never deleting files). Host/Origin/CSRF protections and loopback-only binding stay.
- Visual direction: close to Jira (owner decision, replacing "fp.dev look, Jira workflows only"): project directory, left project sidebar, board with status columns, list/backlog, issue detail with a details panel, issue-type icons, status lozenges, Jira-like colours and typography. No Jira logos, trademarks or proprietary assets.
- Ticket keys: each project has a key (2–10 uppercase letters, `config.key`, derived from the name if unset) and tickets get a sequential `number`; the display key is `KEY-number`. The UUID stays the identity; CLI commands and URLs accept either. Numbers are allocated under a short lock (max + 1); duplicates from parallel branches are reported by `pman validate` and fixed with `pman keys renumber`. `pman keys init` sets the key and numbers existing tickets by creation time.

## Storage stays in the repository (owner decision 2026-11-08)

- Canonical planning data remains Git-tracked under `.pman/` in each repository. Record-per-file JSON/Markdown keeps merges readable, and agents review plan changes in pull requests together with code. No central data directory and no gitignored mode for now.
- Known trade-off: claims and status changes made in one worktree or branch are visible to agents in other worktrees only after a merge. Revisit if parallel agents in separate worktrees start colliding.
- Until a usable version exists, Planus Manus is the only planned project. The final product name and npm publication follow later.

## Local cache database (owner decision 2026-11-08)

- Derived data lives in one SQLite file per project: `~/.pman/cache/<projectId>/db.sqlite` (under `PMAN_HOME`), never in the repository. It holds the search index, embeddings and file fingerprints as separate tables; it can be deleted at any time and is rebuilt from the canonical `.pman/` files.
- Worktrees and branches of one repository share a project ID but can contain different plan files. Rows are therefore keyed by checkout root and file, and embeddings are stored content-addressed (hash of the embedded text), so switching branches or worktrees only re-embeds text that actually changed and never mixes results between checkouts.
- Concurrency: WAL journal mode (many readers in parallel with one writer), a busy timeout of a few seconds so concurrent writers wait instead of failing, and short write transactions. Index updates are best effort: if the database stays locked or is corrupt, pman falls back to keyword search over the files and retries later; canonical writes never wait for the cache. Use Node's built-in `node:sqlite` to avoid native dependencies.
- Target audience for now is the solo developer on one machine: `~/.pman` (registry and cache) stays local. A hosted API for teams may come later; the file format and the API routes should keep that option open, but no remote features are built yet.

## Embedding model and duplicate detection (owner decision 2026-11-08)

- Plans are written in English. Default model: `Xenova/multilingual-e5-small` (q8 ONNX via the optional `@huggingface/transformers`), chosen by the quality gate in `bench/search-eval.mjs` (24 queries; Recall@5 English 0.67, overall 0.55; `all-MiniLM-L6-v2` 0.60/0.44, `paraphrase-multilingual-MiniLM-L12-v2` 0.44/0.51). A project can override it with `semantic.model` in `.pman/config.json`. Models download once into `~/.pman/cache/models/`.
- e5 needs `query:` for queries and `passage:` for indexed text. Each ticket additionally stores its title as a `query:`-embedded identity vector, used only for similarity between tickets (symmetric task); search uses the passage vectors only.
- e5 compresses cosine scores into a narrow band, so "likely overlap" is relative: a candidate must stand at least 3.5 standard deviations above the mean similarity of all other tickets (planted duplicate z 3.7, related siblings up to 3.0) and must not already be linked. Ancestors and descendants are excluded. Calibrate again with more real duplicates.
- Keyword search remains available at all times; besides phrase matches it now also matches when all query words occur.
- Server: `GET /api/search?mode=hybrid|semantic` (paged, snapshot bound to the index generation, keyword fallback with `fallbackReason`), `GET /api/search/status`, `POST /api/index/update` (202, runs in the background), `GET /api/tickets/:id/similar` (returns `available:false` instead of an error when there is no index), `POST /api/relations`.
- Indexing is opt-in: `pman serve` never downloads a model on its own. It re-indexes in the background (every 10 s at most, single-flight, only when tickets, documents or comments changed) only for checkouts that already have an index or where the UI's **Enable semantic search** was used.

## Blueprints (PM-83, 2026-11-08)

- A blueprint is a named checklist (`items` with id, title, why, optional flag) that may `extend` another; resolution puts own items first, then inherited ones, and an own item overrides an inherited one with the same id.
- Built-ins live in `src/blueprints.js`; projects add or override them as readable JSON in `.pman/blueprints/<name>.json` (validated on load).
- Applying stores `blueprint: {name, skipped}` on the ticket and creates child tickets with `origin: {blueprint, item}`. Coverage is derived from those children and the skip reasons, so nothing is duplicated and re-applying only fills gaps. One blueprint per ticket; nest tickets for more.
- Optional items are never created by default; they count as "undecided" until created or skipped with a reason. Missing and undecided items are warnings in `pman check`, not blockers for `done`.
- Suggestions are keyword based (title and labels, or a `blueprint:<name>` label) and only shown, never applied automatically.

## Claims across worktrees (PM-82, 2026-11-08)

- Each worktree has its own `.pman/`, so a claim used to be visible elsewhere only after a merge. Claims are now mirrored in the common Git directory (`<repo>/.git/pman/claims.json`), found without spawning git (`.git` directory, or `.git` file → `gitdir` → `commondir`).
- `claim` fails with CONFLICT when another worktree holds an active lease (unless `--force`), `next` skips tickets claimed elsewhere, `release`/`done` remove the entry. Expired leases are cleaned up on the next claim.
- The ticket files remain the source of truth inside a worktree; the shared file is only coordination and is never committed. No Git repository or `PMAN_SHARED_CLAIMS=0` → no-op.

## Verification and remaining release work

- Local checks were run on Node 24.22.1/Linux: package syntax checks, 11 tests (including a 10,000-deep parent chain and HTTP security checks), JSON Schema parsing, `npm pack --dry-run`, local tarball install, `npm exec -- pman --help`, and a public API import smoke check.
- The 100,000-record wide-tree benchmark passed locally: record fixture generation 9,950 ms, tree query 14,855 ms, validation 12,606 ms, peak RSS about 450 MiB. These are measurements from this environment, not release performance guarantees.
- GitHub Actions is configured for Windows, macOS and Linux on Node 22, 24 and 26. The matrix results should be checked on this branch before treating the release as validated.
- No migration is needed from a prior released format; schema/store version 1 is the initial version. Windows/macOS execution remains subject to the pending GitHub Actions jobs.
- Before publishing, resolve the npm package identity with the owner, rerun the cross-platform matrix, and review the remaining CLI/API coverage against the roadmap. This task does not publish or merge.
