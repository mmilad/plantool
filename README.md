# Planus Manus (`pman`)

Planus Manus is a Git-native planning and ticket graph for people and coding agents. Canonical project data lives in the repository under `.pman/`, works offline, and is ordinary reviewable JSON and Markdown. Tickets can be nested to arbitrary depth using explicit `parentId` links.

## Install locally

After a release is published, install the package as a project-local development dependency:

```sh
npm install --save-dev @mmilad/pm
npx pman init
npx pman --help
```

Node.js 22 or newer is required. No global installation, native binary, database, hosted service, FP installation, or OS-specific project registry is used. `pman init` creates tracked `.pman/` data and does not modify `.gitignore`.

The npm package is `@mmilad/pm`; the executable remains `pman`. The merged planning documents used the provisional unscoped name `planus-manus`; the owner selected the personal scope after checking the existing `pman` name. The package is not published.

## Quick start

```sh
npx pman init --name "My project"
npx pman goal create --title "First release" --body "Ship a usable feature set."
npx pman ticket create --title "Build the core"
npx pman ticket list
npx pman tree
npx pman validate
npx pman serve
```

Create children at any level by passing `--parent <ticket-id>`. The server uses `http://127.0.0.1:4000` by default and stays in the foreground; stop it with Ctrl-C. If the port is occupied, it reports the conflict and starts no additional server. Choose another port explicitly with `pman serve --port N`. It serves only the project found from the current directory or its ancestors. `--open` asks the operating system to open the URL only after the server starts successfully.

## CLI

Run `pman --help` for the current command reference. The first release supports project initialization; ticket create/list/show/update/move; trees; goal, plan and decision creation; comments; typed relationships; offline search; bounded context; validation; and the project-local web UI. Output is JSON by default where useful; pass `--format json` where supported for an explicit machine-readable contract.

## Agent workflow

pman is built so coding agents can pick work in a sensible order without a human triaging every step:

```sh
npx pman next                          # ready tickets, ranked, with reasons
npx pman claim <id> --agent my-agent   # in_progress + assignee with a 60-minute lease
npx pman context <id> --format json    # bounded context packet incl. readiness
npx pman done <id> --note "tested"     # done + comment, prints newly ready tickets
npx pman agent init --write            # add the workflow to AGENTS.md between markers
```

A ticket is ready when it is `todo`, has no open children, and neither it nor any ancestor has an open `blocks` dependency. `next` ranks by priority (an explicit priority wins; `normal` inherits from the nearest ancestor with an explicit one), then by how many tickets finishing it transitively unblocks, then by proximity to work already in progress, then by age. A parent cannot be set to `done` while descendants or blockers are open unless `--force` is passed. Expired leases are offered again by `next`. `PMAN_AGENT` sets the default agent name.

Tickets have a `kind` of `task`, `feature` or `bug`. Planned next: ticket code plans that reference centrally maintained components, contracts and types, with `pman check` validating consumer requirements against provider contracts before implementation (see `docs/implementation-decisions.md`).

## TypeScript API

```ts
import { openProject } from '@mmilad/pm';

const project = await openProject({ cwd: process.cwd() });
const parent = await project.tickets.create({ title: 'Feature' });
const child = await project.tickets.create({ title: 'Subtask', parentId: parent.id });
console.log(await project.tree());
```

See [`src/index.d.ts`](src/index.d.ts) for the exported API and [`schema/pman.schema.json`](schema/pman.schema.json) for the project-config schema. Structured ticket records use schema version 1; long-form planning docs use Markdown with a small metadata header. UUIDv7 IDs and record paths are independent of title and parent.

## Product boundaries

Parent rollups are derived views and never cascade status edits to children. Git remains the collaboration and history layer; simultaneous edits to the same record are not distributed transactions. The local server has no login and binds only to loopback; it checks Host and Origin and requires a per-server CSRF token for writes. It does not load extensions or remote assets.

Agent launching, hosted accounts/sharing, remote sync, MCP, arbitrary extensions/hooks, semantic search, binary asset ingestion, global install, and npm publication are outside this first release. The merged contract and research are in [`docs/product-vision.md`](docs/product-vision.md), [`docs/architecture-proposal.md`](docs/architecture-proposal.md), [`docs/roadmap.md`](docs/roadmap.md), and [`docs/research/fp-feature-matrix.md`](docs/research/fp-feature-matrix.md). Implementation choices are in [`docs/implementation-decisions.md`](docs/implementation-decisions.md).

## Development

```sh
npm run check
```

The test suite uses only Node's built-in test runner and temporary project directories.
