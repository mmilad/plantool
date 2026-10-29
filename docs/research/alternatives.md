# Alternatives and patterns

Research date: 29 October 2026. Pattern comparison, not a claim that any product is a full substitute.

## Comparison

| Product/pattern | State and strengths | Tradeoff for pman's target |
|---|---|---|
| [Beads](https://github.com/gastownhall/beads) | Agent-oriented issue graph with Git-backed workflows; current docs discuss JSONL interchange/export and Dolt-backed sync modes. Strong prior art for IDs, dependency-aware ready work, CLI and durable agent task graphs. | Closest reference. Differentiate through plain per-entity repository files, first-class planning documents, TypeScript embedding, and explicit unlimited-depth guarantees. Its backend/sync evolution demonstrates why canonical source-of-truth rules must be explicit. |
| [GitHub Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) | Hosted repository issues with API/UI and blocking relationships; familiar permissions, comments, notifications and code-host integration. | Network, provider API and account context are required for normal use. Issues are not complete repo-local plan data in a detached/offline clone. |
| [Plane](https://docs.plane.so/) | Workspace/project product with work items, pages, cycles, modules, customizable states, REST API, integrations, cloud and self-hosted options. | Instance access/operations add cost; self-hosting is not a zero-service local clone. Broader product surface than a small agent-neutral core; commercial feature boundaries matter in parity comparisons. |
| [Taskwarrior](https://taskwarrior.org/docs/) | Local-first CLI task manager with structured attributes, tags, reports, IDs and configurable behavior. Useful CLI filter/report patterns. | General task manager rather than repository planning graph; reviewed docs do not establish first-class goals/specs or arbitrary-depth ticket trees. |
| Markdown plans/checklists | Ordinary Git files, human-owned, reviewable, editor-independent and no runtime. | Weak query/validation semantics, unstable references, ad hoc dependencies, and collisions in large shared documents. pman should retain Markdown prose and add a small validated graph. |

## Findings

### Beads: closest reference, not a template

Beads demonstrates agent value in persistent IDs, dependency graphs, ready-work queries, JSON output and session-surviving CLI guidance. Current documentation discusses Git-backed issue workflows alongside generated/exported JSONL and Dolt-based sync. pman should explicitly distinguish canonical data from cache/interchange.

Adopt the problem framing and graph-oriented workflows. Do not copy its IDs, command names, schema, extension policy or backend assumptions. pman's defensible distinction: canonical records are readable per-entity repo files; goals/specs/decisions are part of the same planning model; CLI and TypeScript API are local interfaces; child depth has no schema cap and appears in acceptance criteria.

Sources: [Beads repository](https://github.com/gastownhall/beads), [CLI reference](https://github.com/gastownhall/beads/blob/main/docs/CLI_REFERENCE.md), [core-concepts docs](https://github.com/gastownhall/beads/tree/main/docs/core-concepts).

### GitHub Issues: useful integration boundary

GitHub supports explicit blocking relationships between issues and exposes them in UI and CLI. This makes it useful for optional cross-references to external issues or PRs. It is not suitable as core storage because the goal requires a fresh clone to read and edit plans without an account or hosted service.

Recommendation: later provide import/export and external URL references. Keep pman IDs valid offline; never require GitHub numbers as internal primary keys.

Source: [GitHub issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies).

### Plane: planning breadth and hosting tradeoff

Plane groups work items with pages, cycles and modules, exposes APIs/integrations, and offers cloud and self-hosted editions. It suggests value in distinguishing prose docs, deliverables and time windows, while showing how collaboration, UI and administration broaden scope.

Recommendation: introduce cycle/module concepts only if user workflows demand them. Keep initial goals, milestones, decisions and specs as portable entities. Do not make pman a self-hosted server product.

Sources: [Plane docs](https://docs.plane.so/), [modules](https://docs.plane.so/core-concepts/modules), [project settings](https://docs.plane.so/projects/project-settings), [developer docs](https://developers.plane.so/).

### Taskwarrior: CLI ergonomics

Taskwarrior uses composable filters, commands, modifications and reports; attributes, projects, tags and UUIDs are useful precedents. pman should use consistent filters and JSON output without requiring users or agents to learn an opaque query language.

Recommendation: favor commands like **pman ticket list --status ready --label api --format json**, clear fields, noninteractive options, documented exit codes, and shell completions.

Sources: [CLI syntax](https://taskwarrior.org/docs/syntax/), [add and attributes](https://taskwarrior.org/docs/commands/add/), [tags](https://taskwarrior.org/docs/tags/).

## Product position

Position pman as **repository-local planning infrastructure for human-agent software work**, not another general team-management UI. Interoperate with hosted trackers rather than compete on permissions, notifications, dashboards, cycles, or enterprise administration. Prove its fit with offline checkouts, deep trees, small reviewable diffs, and a stable TypeScript API.

## Related sources

- [FP feature matrix](fp-feature-matrix.md)
- [npm package.json: bin, exports, engines, os, cpu](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)
- [Git worktrees](https://git-scm.com/docs/git-worktree)