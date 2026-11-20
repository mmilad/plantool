# Goal: first usable Heistman release

## Status (updated 2026-11-20)

The first usable release is implemented and merged to `main`: npm package `@mmilad/heist` (not published), CLI `heist`, public TypeScript API, Git-tracked `.heist/` files, tickets of arbitrary depth, planning documents, keyword and optional semantic search, context, validation, a local multi-project web UI, and an MCP stdio adapter.

The plan that led here was finished and reset on 2026-11-08 to make room for new work. Open work lives in heist itself: run `heist next`, or `heist agent onboard` for a briefing.

## What changed against the original contract

The original contract was the planning baseline of 2026-10-29 (`docs/product-vision.md`, `docs/architecture-proposal.md`, `docs/roadmap.md`, `docs/open-questions.md`, `docs/research/fp-feature-matrix.md`). These owner decisions replaced parts of it; details are in `docs/implementation-decisions.md`:

- A machine-local project registry (`~/.heist/projects.json`) exists, and `heist serve` shows every registered project from any directory. The baseline excluded both.
- Optional local semantic search and similarity hints exist. The baseline listed semantic search as post-MVP.
- Agents plan with decisions and options, blueprints, code plans and contracts, and work the plan with `next`, `claim` and `done`.
- Agents can connect through the curated MCP stdio server (`heist mcp --agent NAME`); it cannot decide for a person.
- A local cache database per project lives under `~/.heist/cache/`, outside the repository.

## Constraints that still hold

- Canonical project state stays in `.heist/`; `heist init` does not ignore it. The registry and the cache are derived, local data.
- No FP dependency, native executable, hosted service, agent launching or executable extensions.
- IDs are UUIDv7; statuses are `todo`, `in_progress`, `done` and `cancelled` by default.
- Ticket parent links have arbitrary depth. Parent rollups are derived views; status edits never cascade to children.
- `heist serve` is foreground, loopback-only and without auth, uses the same validators and storage as the CLI, has Host/Origin/CSRF protections and loads no external assets.

## Not done

- Publication to npm: a separate owner action. Confirm ownership of the `@mmilad` scope first.
- npm release remains pending: confirm the publishing account controls `@mmilad`, recheck package availability, and choose the release version.
- Cross-platform CI: the workflow covers Windows, macOS and Linux on Node 22, 24 and 26. Inspect successful runs for the exact release commit before calling a release validated.
