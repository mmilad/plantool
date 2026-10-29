# Product vision

## One sentence

Planus Manus (provisional CLI name **pman**) is a Git-native planning and issue-tracking toolkit that keeps goals, plans, decisions, and arbitrarily nested tickets in the repository, available offline to people and any coding agent.

## Audience and problem

Primary users are software developers, maintainers, and technical leads who plan work with AI coding agents across sessions, branches, worktrees, CI jobs, and cloud checkouts. Agents need durable, structured context and a safe, repeatable way to inspect and update work. Humans need to review that plan as ordinary repository content and retain ownership of decisions.

Session-local checklists disappear when a session ends; free-form Markdown plans are difficult to query and keep current; hosted issue trackers may be unavailable or require credentials in ephemeral environments. pman should make the repository itself sufficient for the core planning workflow.

## Differentiation

- **Checkout is the product boundary:** no account or server is needed to read, create, update, or validate a plan.
- **Plans travel with code:** Git history and branch review describe both implementation and planning changes.
- **Open-ended hierarchy:** any ticket may have children recursively, with no epic/feature/task depth convention.
- **Planning, not only CRUD:** goals, specifications, roadmaps, decisions, brainstorm notes, contextual packets, relationships, status/properties, and agent handoffs are first-class or explicitly linked.
- **Agent-neutral core:** files, CLI, and TypeScript API are the interface. MCP and editor adapters are optional clients.
- **Reviewable and inspectable:** canonical files are ordinary UTF-8 documents, schema-versioned and validated; derived indexes can be discarded and rebuilt.

This is intended product fit, not a claim that no other tool combines these traits. Beads is a particularly close agent-oriented, Git-backed reference. pman should distinguish itself through plain repository files, a first-class planning-document model, direct TypeScript embedding, and an explicit arbitrary-depth contract.

## Principles

1. Repository-first durability: canonical plans live inside the project and are Git-tracked by default. A clone plus compatible Node runtime is enough to inspect and edit the same durable plan offline; no remote registration or service is needed. Users may opt out of tracking locally, but doing so opts out of sharing the plan with cloned checkouts.
2. Explicit relationships: parentage is one graph edge, not inferred from folders or dotted IDs. Dependencies are independent from containment.
3. Unbounded depth, bounded work: no schema depth ceiling; use iterative traversal, cycle detection, pagination/output limits, and resource budgets.
4. Deterministic outcomes: stable sorting, canonical serialization, reproducible queries, predictable exit codes, no network-dependent results in local mode.
5. Safe by default: loading a plan does not execute scripts. Extensions, remote sync, credentials, and agent instructions are opt-in.
6. One contract for people and agents: human-readable Markdown plus validated structured metadata, machine-readable JSON CLI output, and typed public API.
7. Git is the collaboration layer: favor small files and diffs; do not portray Git as a real-time database or file locks as cross-machine coordination.
8. Progressive scope: ship a small planning graph first; add integrations only when their value and trust boundary are clear.

## Representative workflows

### Plan locally, then ask any agent to implement

A human initializes pman, creates a goal and short spec, and breaks work into tickets to any depth. An agent reads repository instructions if the user has enabled them, inspects a ticket context packet, and updates status or adds a note through the CLI or API. The human reviews code and planning changes together in Git.

### Resume from a cloud checkout

A CI job or cloud agent clones the repo, installs existing development dependencies, and runs pman commands against committed .pman files. The plan is usable without a central workspace or per-user registry.

### Coordinate agents in parallel worktrees

Each agent works on a branch/worktree and owns a ticket or file set. Creating sibling work adds a new ticket file without editing its parent. Git merges disjoint records cleanly. If two branches edit one ticket, pman detects incompatible revisions or Git exposes a conflict; validation checks the merged graph. Ephemeral locks and running-session state remain outside canonical data.

### Review a decision and its consequences

A decision record links to the goal, spec, and affected tickets. Its rationale and status change are visible in diffs. Search/context returns a deterministic bounded packet with source paths so an agent can verify claims against the repository.

## Non-goals for initial release

- Recreating FP, Plane, Jira, Linear, or GitHub hosted surfaces feature-for-feature.
- Mandatory hosted app, user directory, auth, invites, remote sync service, or online database.
- Always-running daemon, native addon, global install, WSL requirement, or shell script as the only install path.
- Running agents, assigning remote work, launching sandboxes, or committing on behalf of a user.
- Executing extensions or hooks just because a repository was cloned.
- Semantic/vector search, project-management suite, time tracking, billing, or analytics.
- Guaranteeing conflict-free edits to the same record from separate branches.
- Automatically writing user-authored AGENTS.md content. Any future setup must be additive and respect existing content.