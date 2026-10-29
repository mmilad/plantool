# Implementation decisions

This file records material choices made while implementing the first usable release against the merged planning contract.

## Runtime and package

- Executable: `pman`. The merged product contract recommends npm package `planus-manus`; that value remains provisional while the owner resolves a separate brief that called the npm package itself `pman`. The public registry already has a package named `pman`, so do not publish or advertise a final package identity before that decision.
- Registry check on 2026-10-29: `planus-manus` returned npm 404 and `pman` resolved to version `0.0.5`. The owner chose to defer the name decision; this work continues with the merged docs' package name for local packaging checks.
- Runtime floor: Node.js 22, with CI targeting Node 22, 24, and 26. These are the supported LTS lines at implementation start. No OS/CPU restriction or native dependency is introduced.
- ESM package with JavaScript runtime and first-party `.d.ts` declarations. The core has no third-party runtime dependencies.
- `pman` is intended to be installed as a project-local dependency. `package.json` temporarily follows the merged docs' `planus-manus` name for packaging checks; npm publication and final identity confirmation remain separate release actions.

## Data contract

- Store version and record schema version begin at `1`; canonical structured data is JSON, LF, two-space indented, and newline terminated.
- UUIDv7 IDs are generated from Node crypto primitives. Record filenames are based only on IDs and sharded by their first two characters.
- Default statuses are `todo`, `in_progress`, `done`, and `cancelled`. Custom status catalogs are project configuration; reads preserve unknown stored statuses, while writes require a configured status.
- Ticket rollups are query-time values and never mutate stored child statuses.
- Reads validate but never migrate or rewrite data. There is no earlier released format to migrate in this initial release; unsupported store/schema versions fail with a typed diagnostic.
- Writes use same-directory temporary files and rename, with stale-revision checking. This is local filesystem protection, not distributed locking.

## Browser UI

- `pman serve` binds only to `127.0.0.1`; no LAN option is provided. It resolves one project from cwd/ancestors and does not enumerate projects.
- Mutating requests require the server's exact Host, same-origin Origin, and a per-server CSRF token. CORS is disabled; no external assets or project code are executed.

## Scope

- MVP includes core project/config, ticket, planning document, comment, relationship, search, context, validate and browser workflows.
- Agent execution, auth/hosted sharing, MCP, extensions/hooks, binary asset ingestion, semantic search, global installation, and publication remain excluded.
- Cross-platform CI definitions will cover Windows, macOS and Linux; only platforms actually run in this task will be reported as executed.

## Verification and remaining release work

- Local checks were run on Node 24.22.1/Linux: package syntax checks, 11 tests (including a 10,000-deep parent chain and HTTP security checks), JSON Schema parsing, `npm pack --dry-run`, local tarball install, `npm exec -- pman --help`, and a public API import smoke check.
- GitHub Actions is configured for Windows, macOS and Linux on Node 22, 24 and 26. The matrix results should be checked on this branch before treating the release as validated.
- No migration is needed from a prior released format; schema/store version 1 is the initial version. A 100,000-record scale run and Windows/macOS execution are not part of the local verification above.
- Before publishing, resolve the npm package identity with the owner, rerun the cross-platform matrix, and review the remaining CLI/API coverage against the roadmap. This task does not publish or merge.
