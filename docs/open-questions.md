# Open questions

These are the remaining product decisions and recorded owner choices. Defaults are recommended so implementation can proceed. Decisions affecting stored data should be settled before schema v1.

| Question | Recommended default | Rationale / revisit |
|---|---|---|
| Product/CLI name | Owner selected npm package @mmilad/pm and CLI pman on 2026-10-29. | This supersedes the provisional planus-manus package name. The unscoped pman name is already registered; @mmilad/pm currently returns 404 and remains unpublished. Confirm scope ownership before a future publication. |
| Minimum Node? | Settled: Node.js 22 or newer (`package.json` engines and README); CI matrix targets 22, 24 and 26 per `implementation-decisions.md`. Revisit only when changing the supported-runtime policy. | Keeps published runtime requirements, CI and later local ONNX integration on the same baseline; release support can be reviewed when the matrix changes. |
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
| Context source selection? | MVP: explicit refs plus deterministic lexical search; show provenance and cap output. Later optional local semantic search is planned for Node.js with ONNX `all-MiniLM-L6-v2` and a rebuildable SQLite vector index; keep it out of MVP and retain keyword fallback. | Avoid opaque ranking in the initial release while preserving the planned local semantic-search path. `.pman` files remain canonical; embeddings/index are derived local data with no external content transfer. |
| Asset storage? | No binary ingestion MVP; repo-relative links and user-controlled Git LFS only. | Avoid bloated clones and hidden uploads. |
| Local browser UI? | `pman serve` for one project resolved from cwd/nearest ancestor; loopback-only, no auth, foreground process; fixed default port 4000, no random fallback, clear failure if occupied. | Owner wants the URL to be predictable and a second default start not to leave another instance running silently. Keep 127.0.0.1, Host/Origin/CSRF protections, no CORS, and local assets. A consciously supplied `--port` override may remain explicit and must print its URL. |
| Retry after an uncertain create POST? | Before enabling a retry, add an idempotency/correlation contract per user submission so the same submission returns the same created ticket/result; the UI reuses that key and never creates a second ticket. If the API cannot provide this, keep an unknown outcome explicit and block blind resubmission. This remains an implementation gate, recorded against the existing creation/feedback UI tasks `01a189b1-f688-7fd0-9d9d-33b3016a1acc` and `01a189b2-43b1-775a-89f1-388cdd0af53c`; do not imply exactly-once behavior until the API contract supports it. | `POST /api/tickets` generates UUIDv7 inside the server-side create call and has no idempotency key. If the write succeeds but the response is lost, the client cannot tell whether retrying will duplicate the ticket. This was found during UI planning; settle API persistence and replay semantics before implementation. |
| MCP? | No MVP requirement; adapter after API stabilizes. | Agent-neutrality is already provided by files, CLI and API. |
| Project license? | Recommend MIT for the intended broad reuse; add the license text before public release/contributions. | Owner delegated this choice and said they do not mind others using the project. MIT is a simple permissive license with attribution and warranty/liability terms; this records a recommendation, not a legal review. |

## Decisions required before implementation

Before implementation, verify package/bin registry availability and collision behavior, finalize the schema, relationship types, document front matter and migration rules, decide safe idempotent behavior for retried create POSTs after a lost response, and add the MIT license text before a public release. Node.js 22+ and the default status/rollup behavior are settled product choices.
