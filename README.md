# Planus Manus (`pman`)

Planus Manus is a Git-native planning and ticket graph for people and coding agents. Canonical project data lives in the repository under `.pman/`, works offline, and is ordinary reviewable JSON and Markdown. Tickets can be nested to arbitrary depth using explicit `parentId` links.

## Install locally

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

Create children at any level by passing `--parent <ticket-id>`. The server prints a loopback URL and stays in the foreground; stop it with Ctrl-C. It serves only the project found from the current directory or its ancestors. `--open` asks the operating system to open the URL in the default browser.

## CLI

Run `pman --help` for the current command reference. The first release supports project initialization; ticket create/list/show/update/move; trees; goal, plan and decision creation; comments; typed relationships; offline search; bounded context; validation; and the project-local web UI. Output is JSON by default where useful; pass `--format json` where supported for an explicit machine-readable contract.

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
