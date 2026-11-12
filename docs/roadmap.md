# Roadmap

> Status 2026-11-11: milestones 0 to 5 are implemented and merged. Three things were decided differently from the text below and are recorded in `implementation-decisions.md`: a machine-local project registry with a multi-project `heist serve` (2026-11-08), optional local semantic search with `multilingual-e5-small` (2026-11-08), and decisions, checklists and contracts as planning tools for agents. Open work is tracked in heist itself (`heist next`), not in this file.

This roadmap records the broader product direction and is maintained passively while the first usable release is implemented. It is not a prerequisite checklist for each UI increment. Work proceeds in small, visible slices; only the current slice is actively planned, and implementation findings are recorded here when they change scope or sequencing.

## MVP boundary

A fresh checkout with supported Node LTS can initialize, read, create, update, reparent, search and validate arbitrarily nested tickets and linked planning docs entirely offline. Canonical data is ordinary Git-tracked content. MVP includes CLI and public TypeScript API plus an optional `heist serve` browser UI. The UI binds to loopback, defaults to fixed port 4000, fails clearly if occupied (with only an explicit `--port` override) and has no auth. It was planned for the single current project and now shows every project in the machine-local registry. It runs on Windows/macOS/Linux and requires no hosted service, database, or MCP.

Out of MVP: hosted sharing, credentials/auth/invites, live locks, agent execution/session management, arbitrary extensions/hooks, desktop app, MCP adapter, binary asset hosting, dashboards, time tracking, auto-update. Semantic search was on this list and has been added as an optional feature.

## Milestone 0 — Lock the contract

**Depends on:** product review and name checks before package metadata.

Tasks: settle file format; publish schema v1 and JSON Schema; formalize the approved UUIDv7 ID and project status/rollup defaults; define relationships/errors/serialization/path rules; check npm package/bin availability and collision behavior; choose tested Node LTS floor; record MIT as the selected license and add its text before public release.

Acceptance:

- Schema/examples represent goals/plans/decisions/comments/relationships and tickets at arbitrary depth.
- Root, child, grandchild, and 10,000-deep chains need no special type or nested child array.
- Package/executable availability and heist bin collision behavior are verified; if unavailable or conflicting, owner chooses a fallback before package setup.
- The selected MIT license is documented; a LICENSE file is added before the first public release.
- No product runtime code in this milestone.

## Milestone 1 — Store, validation and TypeScript core

**Depends on:** Milestone 0.

Tasks: initialize .heist; canonical serialization; loaders/writers; IDs; schema validation/migration foundation; graph validators; typed errors; storage adapter.

Acceptance:

- openProject resolves repo root and reads without external service.
- A fresh Git clone contains all canonical goals, plans, tickets, metadata, and relationships; local commands can inspect and edit that data offline.
- heist init does not add canonical .heist files to .gitignore; only rebuildable caches and ephemeral execution state may be ignored.
- Separate records have stable IDs; title change does not change path.
- Child creation adds one child record, not a parent list.
- Duplicate IDs, missing parent, self-parent, cycle, dangling edge, unsupported schema and path traversal return path/ID diagnostics.
- Atomic create/update prevents partial JSON on supported local filesystems; stale revision is typed conflict.
- Read commands never mutate/migrate.

## Milestone 2 — Unlimited-depth ticket operations

**Depends on:** Milestone 1.

Tasks: create/get/list/update; move/reparent; iterative tree/subtree; sibling sort; derived rollups; dependency edges/readiness; bounded output.

Acceptance:

- Create/get/update/move/close work on root, child, grandchild and 10,000-deep chains without stack overflow.
- Moving a node with large subtree edits only that node's parentId; descendant IDs and paths stay fixed.
- Move ancestor under descendant rejected before write.
- Tree displays all levels with pagination; max-depth limits display only.
- Rollups are explicitly derived; manual parent status never overwrites children.
- Readiness graph is independent of containment; blocking cycles rejected.

## Milestone 3 — CLI and public npm package

**Depends on:** Milestones 1–2.

Tasks: heist commands; JSON/human output; exit codes; noninteractive and stdin/file modes; package exports, declarations and bin mapping.

Acceptance:

- npm devDependency install followed by npx heist --help and npm exec -- heist work with chosen Node.
- Public TypeScript API imports from documented exports with no CLI side effects.
- Windows/macOS/Linux shims and paths work without WSL, global install, native dependency or separate executable.
- Outputs deterministic; errors have documented exit codes and optional machine-readable diagnostics.
- Completions derive from CLI definitions.
- Names checked before release; publishing is separate approval/action.

## Milestone 4 — Planning artifacts, context, search and instructions

**Depends on:** Milestones 1–3.

Tasks: goals, plans/specs, decisions, comments, references, deterministic text search, bounded context with provenance, optional additive AGENTS helper.

Acceptance:

- Planning docs are Git-tracked, versioned, and linkable to tickets.
- Context has ticket, ancestry, chosen relations, source paths and omission counts in stable order.
- Offline search works without an index and returns source locations.
- Agent setup is opt-in, shows preview, is idempotent and preserves user-authored AGENTS content.
- Reading/searching never executes content, hooks, or extensions.

## Milestone 5 — Project-scoped local web UI

Superseded in part on 2026-11-08: `heist serve` runs from any directory and shows all registered projects. The acceptance points about a single project and "no project discovery" below no longer apply; the security points do.

**Depends on:** Milestones 1–4.

Tasks: build a lightweight browser UI on the public TypeScript core; support project tree navigation, ticket detail and supported edits, planning documents, search/context; implement `heist serve` as a foreground server.

Acceptance:

- `heist serve` resolves exactly one initialized project from the current working directory/nearest ancestor and refuses if none exists.
- UI reads and writes through the same core validators and filesystem adapter as the CLI; all canonical state remains in Git-tracked project files.
- UI shows only that project; there is no project discovery, picker, multi-project index, or account system.
- Server binds to 127.0.0.1 only by default, prints its URL, and stops with Ctrl-C; browser launch is opt-in with `--open`.
- Mutating requests validate Host and Origin, CSRF defenses are in place, CORS is disabled, and assets are served locally without external scripts.
- UI remains optional; CLI and TypeScript API work independently with the server stopped.

## Milestone 6 — Reliability and release candidate

**Depends on:** Milestones 0–4.

Tasks: migration, doctor/recovery, benchmarks, cross-platform CI, user docs, security and package review.

Acceptance:

- 10,000-deep chain, 100,000 mixed/wide records, Unicode and long paths run within published budgets on Windows/macOS/Linux.
- Corrupt JSON, interrupted writes, stale revisions, conflicting merges and unknown fields produce safe guidance.
- Clean package install works on supported Node LTS with no native/external executable.
- Every supported migration is deterministic, idempotent and previewable.
- Offline init/list/show/create/update/tree/context/search/validate succeed after dependency install.
- Threat review includes untrusted content, symlink/path traversal, future plugins, npm install/publish and secret leakage.

## Post-MVP

1. Optional MCP adapter over stable API with least privilege, no instruction execution.
2. Import/export for GitHub Issues, Beads, Markdown and hosted trackers; external IDs remain refs.
3. Optional coordination service for leases/claims/notifications; offline files remain truth.
4. Declarative custom property/status rules before considering executable extensions.
5. Richer TUI/editor integrations beyond the single-project local browser UI.
6. Explicit repo-relative assets and Git LFS.
7. Done: optional local semantic search in Node.js with `multilingual-e5-small` (chosen over `all-MiniLM-L6-v2` by the quality gate), a rebuildable SQLite index outside the repository and always-available keyword fallback. Repository files remain canonical; the index is derived local data.

## Sequencing and verification plan (passive reference)

Resolve names, schema, ID, status, relationship and migration choices before implementation. Build graph model before UX. Add planning/context after IDs and links stabilize. Test Windows early.

These are release-level verification topics, not gates for routine UI increments. Select relevant checks when preparing a release candidate; do not expand the active planning queue in advance.
