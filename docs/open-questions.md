# Open questions

These are the remaining product decisions and recorded owner choices. Defaults are recommended so implementation can proceed. Decisions affecting stored data should be settled before schema v1.

| Question | Recommended default | Rationale / revisit |
|---|---|---|
| Product/CLI name | Owner selected npm package @mmilad/pm and CLI pman on 2026-10-29. | This supersedes the provisional planus-manus package name. The unscoped pman name is already registered; @mmilad/pm currently returns 404 and remains unpublished. Confirm scope ownership before a future publication. |
| Minimum Node? | Oldest active/maintenance LTS supported at implementation start; choose after CI matrix passes. | Release schedule changes; avoid stale runtime promise. |
| JSON, YAML or Markdown ticket fields? | Canonical JSON for structured records; Markdown for long-form docs; publish JSON Schema. | Avoid permissive YAML ambiguities while keeping prose human-editable. |
| ID scheme | UUIDv7 from Node crypto; IDs remain independent from title/path/parent. | Owner approved UUIDv7. Keep sibling sorting explicit rather than relying on the ID's timestamp portion. |
| Statuses global or project-level? | Ordered project-level catalog; defaults todo, in_progress, done, cancelled; preserve unknown status on read. | Owner approved these defaults. Project-level configuration permits local variation without breaking older clients. |
| Parent completion constrained by children? | Manual parent state plus separately derived rollup; warn if done has open descendants. | Owner approved computed rollups that do not cascade status changes to children. |
| MVP relationship types? | blocks, relates_to, duplicates, implements, validates, supersedes. | Useful small set separate from containment; add from evidence. |
| Dependency cycles? | Reject cycles only in blocking edges. | Readiness needs a DAG; informational links are not causal. |
| Comments embedded or separate? | Separate files; define edit history before implementation. | Smaller diffs, lower contention. |
| Activity history? | Git log is MVP audit trail; no shared mutable JSONL. | Avoid write hotspot and unsupported actor identity claims. |
| Delete semantics? | Close/archive by default; hard delete explicit; never recursively delete descendants by default. | Protect planning history. |
| Cross-branch coordination? | No distributed lock or auto-merge in MVP; separate records, stale-write detection, validators, human-visible Git conflict. | File locks do not coordinate remote agents. |
| Index strategy? | In-memory per-command ID/parent index first. | No stale hidden state; benchmark before cache. |
| AGENTS.md behavior? | No automatic edit by default. Explicit opt-in helper previews additive include and preserves existing bytes; skip unsupported syntax with explanation. | User content remains authoritative. |
| Document format? | Markdown with minimal optional YAML front matter; structured links validated. | Familiar diffs without a custom rich text syntax. |
| Context source selection? | Explicit refs plus deterministic lexical search; show provenance and cap output. | Avoid surprising opaque relevance ranking. |
| Asset storage? | No binary ingestion MVP; repo-relative links and user-controlled Git LFS only. | Avoid bloated clones and hidden uploads. |
| Local browser UI? | `pman serve` for one project resolved from cwd/nearest ancestor; loopback-only, no auth, foreground process; no multi-project discovery. | Owner requested a project-local UI similar in spirit to FP’s companion app, with no auth because it remains local. Use 127.0.0.1, Host/Origin/CSRF protections, no CORS, and local assets. |
| MCP? | No MVP requirement; adapter after API stabilizes. | Agent-neutrality is already provided by files, CLI and API. |
| Project license? | Recommend MIT for the intended broad reuse; add the license text before public release/contributions. | Owner delegated this choice and said they do not mind others using the project. MIT is a simple permissive license with attribution and warranty/liability terms; this records a recommendation, not a legal review. |

## Decisions required before implementation

Before implementation, verify package/bin registry availability and collision behavior, select the supported Node LTS floor, finalize the schema, relationship types, document front matter and migration rules, and add the MIT license text before a public release. UUIDv7 and the default status/rollup behavior are settled product choices.