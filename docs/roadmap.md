# Roadmap

This is an implementation sequence, not authorization to begin implementation in this research phase. Issue #1 ends at research and roadmap. No product code or package is included in this proposal.

## MVP boundary

A fresh checkout with supported Node LTS can initialize, read, create, update, reparent, search and validate arbitrarily nested tickets and linked planning docs entirely offline. Canonical data is ordinary Git-tracked content. MVP includes CLI and public TypeScript API, runs on Windows/macOS/Linux, and has no mandatory service, database, or MCP requirement.

Out of MVP: hosted sharing, credentials/auth/invites, live locks, agent execution/session management, arbitrary extensions/hooks, desktop app, MCP adapter, semantic search, binary asset hosting, dashboards, time tracking, auto-update.

## Milestone 0 — Lock the contract

**Depends on:** product review and name checks before package metadata.

Tasks: settle file format; publish schema v1 and JSON Schema; define statuses/relationships/IDs/errors/serialization/path rules; check npm name and command; choose tested Node LTS floor.

Acceptance:

- Schema/examples represent goals/plans/decisions/comments/relationships and tickets at arbitrary depth.
- Root, child, grandchild, and 10,000-deep chains need no special type or nested child array.
- Package/executable availability is recorded; owner chooses fallback before package setup if unavailable.
- No product runtime code in this milestone.

## Milestone 1 — Store, validation and TypeScript core

**Depends on:** Milestone 0.

Tasks: initialize .pman; canonical serialization; loaders/writers; IDs; schema validation/migration foundation; graph validators; typed errors; storage adapter.

Acceptance:

- openProject resolves repo root and reads without external service.
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

Tasks: pman commands; JSON/human output; exit codes; noninteractive and stdin/file modes; package exports, declarations and bin mapping.

Acceptance:

- npm devDependency install followed by npx pman --help and npm exec -- pman work with chosen Node.
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

## Milestone 5 — Reliability and release candidate

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
5. TUI/editor views without a required server.
6. Explicit repo-relative assets and Git LFS.
7. Optional semantic search with always-available keyword search.

## Sequencing and verification plan

Resolve names, schema, ID, status, relationship and migration choices before implementation. Build graph model before UX. Add planning/context after IDs and links stabilize. Test Windows early.

Implementation should include property-generated graphs, extreme-depth/wide-tree cases, cycle/orphan cases, canonical serialization, stale writes, disjoint Git merges, Windows path/encoding, migration fixtures, CLI JSON/exit contracts, offline checkout integration and TS API import checks. This proposal does not run or add those tests.