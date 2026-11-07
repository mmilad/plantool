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
- `pman agent init` previews by default and with `--write` adds or refreshes a section between `<!-- pman:start -->` and `<!-- pman:end -->` in `AGENTS.md`; text outside the markers is never changed.
- Line endings: `.gitattributes` enforces LF for text files; planning-document parsing also tolerates CRLF.

## Code plans and contracts (implemented 2026-11-07)

- Storage: `.pman/components/`, `.pman/types/`, `.pman/contracts/`, same sharded UUIDv7 JSON format as tickets. A ticket stores its plan in `codePlan { implements, consumes, changes }`, each entry referencing a component ID; `consumes` entries carry `requires` (output paths, optionally `path:type`) and optional `provides` (input fields supplied).
- Components have a kind from `config.componentKinds` (default `module`, `service`, `class`, `method`, `function`, `ui-component`), a name without dots, and a parent; names are unique among siblings and addressed by qualified name (`UserService.getUser`), unique short name or ID. An exact qualified name wins over a short-name match.
- One contract per component; any component kind may have one (for example UI component props), method and function are expected to. Versions start at 1 and increase only when input or output change. Version history and breaking-change detection remain open.
- Schema language: JSON Schema subset plus a shorthand that normalises to it on write; stored data is always the normalised form. Path lookup follows `$ref`s and descends into array items implicitly.
- `pman validate` stays structural (dangling references, duplicate contracts or type names). `pman check` is the design check and exits non-zero on errors; warnings never fail it.
- A consumer ticket implicitly depends on every open ticket that implements the consumed component or one of its ancestors. These implicit edges count for readiness, `next` ranking, the parent-done rule and cycle detection, but are not stored as relationships.

## Verification and remaining release work

- Local checks were run on Node 24.22.1/Linux: package syntax checks, 11 tests (including a 10,000-deep parent chain and HTTP security checks), JSON Schema parsing, `npm pack --dry-run`, local tarball install, `npm exec -- pman --help`, and a public API import smoke check.
- The 100,000-record wide-tree benchmark passed locally: record fixture generation 9,950 ms, tree query 14,855 ms, validation 12,606 ms, peak RSS about 450 MiB. These are measurements from this environment, not release performance guarantees.
- GitHub Actions is configured for Windows, macOS and Linux on Node 22, 24 and 26. The matrix results should be checked on this branch before treating the release as validated.
- No migration is needed from a prior released format; schema/store version 1 is the initial version. Windows/macOS execution remains subject to the pending GitHub Actions jobs.
- Before publishing, resolve the npm package identity with the owner, rerun the cross-platform matrix, and review the remaining CLI/API coverage against the roadmap. This task does not publish or merge.
