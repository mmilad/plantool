# Open questions

Product decisions and release checks. The original design questions are retained with their recorded outcomes; unresolved first-release questions are identified explicitly.

| Question | Recommended default | Rationale / revisit |
|---|---|---|
| Product/CLI name | Settled 2026-11-20: product/project `Plan`, package `@mmilad/plantool`, command `plantool`. Owner confirmed control of the `@mmilad` scope. | Before publishing, check the current published versions and choose a version that has not been used. The historic registry lookup is not current package-version evidence. |
| Minimum Node? | Settled: Node.js 22 or newer (`package.json` engines and README); CI matrix targets 22, 24 and 26 per `implementation-decisions.md`. Revisit only when changing the supported-runtime policy. | Keeps published runtime requirements, CI and the optional local ONNX feature aligned; release support can be reviewed when the matrix changes. |
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
| Context source selection? | MVP: explicit refs plus deterministic lexical search; show provenance and cap output. Optional local semantic search has since been implemented with `multilingual-e5-small` and a rebuildable SQLite index outside the repository; keyword search stays the fallback (see `implementation-decisions.md`). | Avoid opaque ranking in the initial release while preserving the planned local semantic-search path. `.plan` files remain canonical; embeddings/index are derived local data with no external content transfer. |
| Asset storage? | No binary ingestion MVP; repo-relative links and user-controlled Git LFS only. | Avoid bloated clones and hidden uploads. |
| Local browser UI? | Settled 2026-11-08: `plantool serve` shows every project in the machine-local registry, from any directory (first planned for one project resolved from cwd); loopback-only, no auth, foreground process; fixed default port 4000, no random fallback, clear failure if occupied. | Owner wants the URL to be predictable and a second default start not to leave another instance running silently. Keep 127.0.0.1, Host/Origin/CSRF protections, no CORS, and local assets. A consciously supplied `--port` override may remain explicit and must print its URL. |
| Retry after an uncertain create POST? | Settled 2026-11-20: required for the first npm release and implemented with optional request keys. | The ticket record stores a request key and canonical payload hash. An identical retry returns the original ticket after restart; a changed payload under the same key conflicts. The browser preserves an attempted draft and key in session storage. This protects retries that reuse the key; callers must retain that key for the retry. |
| MCP? | Settled: `plantool mcp --agent NAME` serves a curated MCP stdio adapter for one project. | Implemented in PLAN-9; see `implementation-decisions.md`. The server identity is fixed at startup and it refuses person-owned decisions. |
| Project license? | Recommend MIT for the intended broad reuse; add the license text before public release/contributions. | Owner delegated this choice and said they do not mind others using the project. MIT is a simple permissive license with attribution and warranty/liability terms; this records a recommendation, not a legal review. |

## Historical implementation gate

The original implementation prerequisites (package/bin checks, schema, relationships, document format and MIT license) are settled in the repository. Current publication checks and the staged repository rename are listed in `docs/implementation-decisions.md`.
