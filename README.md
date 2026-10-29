# Planus Manus (pman)

**Proposal status:** research and roadmap only; no product code or npm package has been created.

Planus Manus is proposed as a local-first planning and issue-tracking toolkit for people and AI coding agents. A repository clone contains the complete usable plan: a fresh checkout can read and edit tickets without an account, network connection, hosted service, or database server. The plan is versioned with the code it describes.

The recommendation is a TypeScript domain library and **pman** CLI, distributed provisionally as npm package **planus-manus**. Store each durable entity in a separate canonical file under **.pman/**. Model nesting with explicit parentId links so depth is unlimited by schema and reparenting changes one ticket record. Compute trees, dependency readiness, and status rollups from the graph; treat indexes as rebuildable.

Package and executable name availability still need verification before package metadata or publishing.

## Planning documents

- [Product vision](docs/product-vision.md): audience, differentiation, principles, non-goals, workflows.
- [FP feature matrix](docs/research/fp-feature-matrix.md): verified findings, proposed pman priorities, and gaps.
- [Alternatives](docs/research/alternatives.md): Beads, GitHub Issues, Plane, and Taskwarrior.
- [Architecture proposal](docs/architecture-proposal.md): storage options, schema, unlimited-depth trees, API/CLI, concurrency and risks.
- [Roadmap](docs/roadmap.md): milestones, dependencies, MVP boundary and acceptance criteria.
- [Open questions](docs/open-questions.md): unresolved choices with recommended defaults.

## Product boundary

Core is a repo-local planning graph, its TypeScript API, and a scriptable CLI. A required hosted service, account system, native executable dependency, always-on daemon, or agent-vendor-specific integration is out of scope for the first usable release. Optional MCP, editors, and hosted coordination can follow without becoming prerequisites.

See [Issue #1](https://github.com/mmilad/planus-manus/issues/1).