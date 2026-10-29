# Goal: first usable Planus Manus release

## Outcome

Implement and finish the first usable `planus-manus` release in this repository. The project must provide a project-local `pman` CLI and public TypeScript API over canonical Git-tracked `.pman/` files, arbitrary-depth tickets, core planning artifacts, offline search/context/validation, and an optional single-project loopback browser UI.

The product contract is the merged planning baseline on `main` (commit `28f6da3`, including merged PRs #2 and #3): `README.md`, `docs/product-vision.md`, `docs/architecture-proposal.md`, `docs/roadmap.md`, `docs/open-questions.md`, and `docs/research/fp-feature-matrix.md`.

## Constraints

- No FP dependency, machine-global project registry, global install requirement, native executable, hosted service, database, agent launching, executable extensions, package publication, or PR merge.
- Canonical project state stays in `.pman/`; `pman init` must not ignore it.
- IDs are UUIDv7; statuses are `todo`, `in_progress`, `done`, and `cancelled` by default.
- Ticket parent links have arbitrary depth. Parent rollups are derived views and status edits never cascade to children.
- `pman serve` is foreground, loopback-only, current-project-only, no-auth, same validators/storage, with Host/Origin/CSRF protections and no external assets.

## Dependency-ordered work

- [x] Inspect the current default branch and verify planning PRs #2 and #3 are merged.
- [x] Record implementation contract and sequence in this goal.
- [ ] M0: finish the package identity decision (the existing `pman` registry name conflicts with the implementation brief); runtime floor, schema v1, default statuses, UUIDv7, relationships, serialization and MIT license are recorded.
- [x] M1: implement project discovery, `.pman/` initialization, canonical storage, typed errors and graph validation.
- [x] M2: implement unlimited-depth ticket CRUD, reparenting, paginated trees, derived rollups, relationships and readiness.
- [x] M3: expose the public TypeScript API and `pman` CLI with deterministic text/JSON and stable failures.
- [x] M4: implement goals/plans/decisions/comments, offline search and bounded context with provenance.
- [x] M5: implement project-scoped `pman serve` with browser request protections.
- [ ] M6: complete remaining release checks. Seven of nine GitHub Actions OS/runtime jobs passed; macOS Node 22 and 26 are still queued, and the 100,000-record benchmark is pending.
- [x] Open a reviewable PR from this branch; PR #4 is open. Do not publish or merge.

## Completion evidence

The goal is complete when the acceptance criteria in the merged roadmap are implemented for the first usable release, relevant tests pass, the supported OS/runtime checks are documented accurately, and an open PR is available for review. Any deferred roadmap work and platform checks that cannot be run in this environment must be listed as limitations.

## Material implementation decisions

Record schema, Node floor, migration behavior, server security, and any acceptance criteria intentionally narrowed in `docs/implementation-decisions.md` as they are settled.
