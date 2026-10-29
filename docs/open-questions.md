# Open questions

These choices remain unresolved. Defaults are recommended so implementation can proceed after review. Decisions affecting stored data should be settled before schema v1.

| Question | Recommended default | Rationale / revisit |
|---|---|---|
| Is npm package planus-manus available? Is pman executable free? | Treat both as provisional; check registry/collisions before package manifest or release. | Availability and trademark/name collisions were not verified. If unavailable, owner chooses scoped/alternate name. |
| Minimum Node? | Oldest active/maintenance LTS supported at implementation start; choose after CI matrix passes. | Release schedule changes; avoid stale runtime promise. |
| JSON, YAML or Markdown ticket fields? | Canonical JSON for structured records; Markdown for long-form docs; publish JSON Schema. | Avoid permissive YAML ambiguities while keeping prose human-editable. |
| ID scheme? | UUIDv7 or UUIDv4 from Node crypto, decided before schema; ID independent from title/path/parent. | v7 is approximately time sortable but can reveal time; v4 is unordered. Sort should not rely on privacy-sensitive ID parts. |
| Statuses global or project-level? | Ordered project catalog; defaults todo, in_progress, done, cancelled; preserve unknown status on read. | Allows workflow differences without breaking older clients. |
| Parent completion constrained by children? | Manual parent state plus separately derived rollup; warn if done has open descendants. | Avoid surprise writes. |
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
| MCP? | No MVP requirement; adapter after API stabilizes. | Agent-neutrality is already provided by files, CLI and API. |
| Project license? | Owner decides before public contribution/release. | Private empty repo; licensing is owner decision. |

## Decisions required before implementation

Set package/bin naming, supported Node LTS floor, schema and ID format, status/rollup contract, relationship types, document front matter and migration rules. Other choices can follow defaults without blocking core implementation.