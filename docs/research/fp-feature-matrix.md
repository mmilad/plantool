# FP feature matrix

## Scope and evidence

Documentation-based review of FP (fp.dev) as of 29 October 2026. “Verified” means described by the official pages below; no CLI install or live invocation was performed. Issue #1's command list was treated as a lead, not verified product behavior.

FP describes itself as an agent-native issue tracker for Claude Code, Codex, Pi, and others. Its quickstart shows terminal-based planning and nested issue output. Current docs clarify that default local issue data is outside the checkout in a per-machine SQLite directory; remote/cloud use connects to a shared HTTPS project and needs identity/token configuration. This differs from heist's desired source of truth: durable goals, tickets, decisions, relationships, comments, and config live inside the project and are Git-tracked by default. A clean clone must contain the plan and allow local edits without remote registration or hosted access; only generated caches and ephemeral execution state are excluded. Sources: [FP docs](https://fp.dev/docs/), [installation](https://fp.dev/docs/getting-started/installation/), [CLI overview](https://fp.dev/docs/cli/overview/), [issue tracking and storage](https://fp.dev/docs/cli/issue-tracking/), [configuration](https://fp.dev/docs/cli/configuration/), [cloud agents](https://fp.dev/docs/guides/cloud-agents/), and [extension docs](https://fp.dev/docs/extensions/overview/).

## Capability comparison (proposal at review time)

| FP surface from issue | Evidence in reviewed official docs | heist proposal | Priority / caveat |
|---|---|---|---|
| init | Verified: registers project, scaffolds extension directory, ignore rules, optional agent files. | Initialize only repo-local config/files; never overwrite user text. | P0; avoid machine registry. |
| issue create/list/update | Verified create/list/show/update; create child with parent ID; custom properties. | Ticket CRUD, stable IDs, explicit links, JSON, optimistic revision. | P0. |
| comment add | Verified add/list/edit/soft-delete, file input, image attachment, JSON listing. | Separate durable comment records/notes. | P1; avoid rewriting large ticket files. |
| tree | Verified full hierarchy rendering with status. | Iterative traversal, stable sorting, optional output/page bounds. | P0; any depth limit is presentation-only. |
| log / logs | activity.jsonl is documented; exact log/logs CLI commands not confirmed in inspected reference. | Git history baseline, optional per-entity events later. | P2; avoid append hotspot. |
| search | Verified in cloud-agent guide; issue docs describe full-text index behavior. | Offline deterministic text search over canonical data. | P1; no required index. |
| context | Verified context ID emits issue, comments, related context optimized for agents. | Bounded packet with provenance, source paths, deterministic order and omitted counts. | P0. |
| run | Not confirmed in reviewed CLI reference. | Exclude from core; heist does not launch agents. | Out of scope. |
| session | Not confirmed in reviewed docs. | Execution/session state is ephemeral, outside canonical plan. | Optional future adapter. |
| agent | Verified agent setup manages agent instruction files; cloud guide has agent tokens. | Opt-in, additive, previewed, neutral setup helper after core. | P1/P2. |
| guide | Verified guide prints planning, implementation, brainstorm, extension primers. | Neutral docs/schema/API guide; keep workflow accessible in repo. | P1. |
| brainstorm | Verified Markdown docs with directives, comments, versions and desktop rendering. | Ordinary Markdown docs for brainstorm/spec/decision. | P1; avoid proprietary directives. |
| extension | Verified TS extensions register properties and lifecycle hooks; load project/global. | No executable extensions in MVP; declarative config first. | P3; supply-chain boundary. |
| secrets | Extension context exposes OS-keychain secret API. | No secrets in core; external providers only for later integrations. | Exclude core. |
| attach | Image attachment to comments ingested into FP asset store is documented. | Plain repo-relative references first; binary files user-managed. | P2; define path/size behavior first. |
| config | Project structure and issue-prefix configuration documented; exact fp config surface not confirmed. | Versioned repo-local config with validation. | P0. |
| completion | Not confirmed in inspected reference. | Completions generated from CLI command definitions. | P2. |
| update | Verified stable self-update and prerelease opt-in. | Package manager updates; no auto-update. | Not core. |
| workspace / invite / auth | Cloud docs verify login, workspace agent creation, workspace token configuration. Invite CLI not confirmed. | No account/workspace/auth required for local plan. | Exclude MVP. |
| project / remote | Verified remote project link file contains identity but no credentials; issue data is stored elsewhere. Remote mode uses HTTPS and token env vars. | Repo itself defines project; no remote link required. | Hosting optional only. |
| custom statuses/properties | Verified through TS extensions; default statuses todo/in-progress/done. | Ordered per-project catalog and custom properties, with unknown field preservation. | P1. |
| dependencies/relations | issue show includes Dependencies; mutation syntax not documented on reviewed page. | Explicit typed edges independent from parentId; validate blocking cycles. | Model P0, readiness P1. |
| hierarchy | Child creation and fp tree verified; no maximum depth stated on reviewed pages. | Contractual arbitrary depth with extreme-depth tests. | P0. |
| history/activity | activity.jsonl listed; comments timestamped/attributed; brainstorms versioned. | Git history is initial audit trail; no global mutable event log. | P1/P2. |
| hot-file/context | Context verified; reviewed docs did not verify hot-file ranking. | Explicit file refs and deterministic local search with provenance. | P1. |
| extensions/hooks | Pre-hooks can reject transitions; post-hooks trigger side effects; extensions execute in CLI and desktop. | Defer arbitrary code and make future execution explicit opt-in. | P3. |
| MCP | Pages cover other agents; MCP server not established by inspected sources. | Proposal at review time: optional adapter after stable API/CLI. Heist later implemented a curated stdio adapter; see `docs/implementation-decisions.md`. | Historical P2. |
| desktop / project UI | FP docs list a Mac companion; reviewed installer requirements say macOS/Linux x86_64, not Windows. The reviewed pages do not establish every multi-project UI detail from the user report. | Proposal at review time: a browser UI for one project. Heist later changed this to a local multi-project registry and workspace; loopback-only with Host/Origin/CSRF protections. | Historical P1; current behavior is documented in `docs/implementation-decisions.md`. |

## Security and product fit

Useful patterns: issue context packets, neutral workflow primers, custom statuses/properties, versioned planning documents, optional remote connectivity for cloud agents, careful additive agent-file integration.

Poor fit for minimal heist: workspace/auth/invites, hosted shared database, desktop-only work, extension ecosystem, keychain secret API, self-updater, and asset upload. These introduce operational or trust boundaries not needed for checkout-only planning.

Preserve these concerns: repo extensions execute code; hooks may block transitions; tokens must not be committed; auto-editing instructions can change agent behavior. Core heist must parse data without executing it, treat ticket text as untrusted, and keep integrations/plugins opt-in.

## Sources

- [FP docs home](https://fp.dev/docs/)
- [Installation and requirements](https://fp.dev/docs/getting-started/installation/)
- [CLI overview](https://fp.dev/docs/cli/overview/)
- [Issue tracking, comments, tree, context, storage](https://fp.dev/docs/cli/issue-tracking/)
- [Project configuration and AGENTS.md integration](https://fp.dev/docs/cli/configuration/)
- [Cloud agent remote setup](https://fp.dev/docs/guides/cloud-agents/)
- [Other coding agents](https://fp.dev/docs/guides/other-coding-agents/)
- [Brainstorms](https://fp.dev/docs/cli/brainstorms/)
- [Extensions and secret API surface](https://fp.dev/docs/extensions/overview/)
- [Lifecycle hooks](https://fp.dev/docs/extensions/hooks/)
- [Custom statuses](https://fp.dev/docs/extensions/status/)
