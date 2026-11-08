# Planus Manus (`pman`)

Planus Manus is a Git-native planning and ticket graph for people and coding agents. Canonical project data lives in the repository under `.pman/`, works offline, and is ordinary reviewable JSON and Markdown. Tickets can be nested to arbitrary depth using explicit `parentId` links.

## Install locally

The project uses pnpm. For local development, `pnpm link --global` in this repository makes `pman` available everywhere.


After a release is published, install the package as a project-local development dependency:

```sh
pnpm add -D @mmilad/pm
pnpm exec pman init
pnpm exec pman --help
```

Node.js 22 or newer is required. No native binary, database, hosted service or FP installation is used. A small machine-local project list (`~/.pman/projects.json`) lets `pman serve` show all your projects; canonical data always stays in each repository. `pman init` creates tracked `.pman/` data and does not modify `.gitignore`.

The npm package is `@mmilad/pm`; the executable remains `pman`. The merged planning documents used the provisional unscoped name `planus-manus`; the owner selected the personal scope after checking the existing `pman` name. The package is not published.

## Workspace: all projects in one UI

Run `pman serve` from any directory. It opens a Jira-like workspace with every project pman knows: a project directory, and per project a Summary (status, priority and type breakdown plus the "ready to start" order agents get from `pman next`), a Board with status columns (drag cards or use Alt+←/→ to change status), a List with the ticket tree and issue details, Documents and Design.

Projects are registered automatically in a machine-local list (`~/.pman/projects.json`, override with `PMAN_HOME`) whenever you run `pman init` or any pman command inside them; `pman projects`, `pman projects add PATH`, `pman projects remove KEY|PATH` and `pman projects prune` manage the list, and the UI can add or remove projects too. Removing a project from the list never touches its files. Set `PMAN_NO_REGISTER=1` to skip automatic registration.

Tickets have Jira-style keys such as `SHOP-42` (project key plus a sequential number). Every command that takes a ticket ID also accepts the key, e.g. `pman ticket show SHOP-42` or `pman claim SHOP-42 --agent bob`. Existing projects get keys with `pman keys init [--key SHOP]`; after merging branches that created tickets in parallel, `pman keys renumber` fixes duplicate numbers (`pman validate` warns about them).

## Quick start

```sh
pnpm exec pman init --name "My project"
pnpm exec pman goal create --title "First release" --body "Ship a usable feature set."
pnpm exec pman ticket create --title "Build the core"
pnpm exec pman ticket list
pnpm exec pman tree
pnpm exec pman validate
pnpm exec pman serve
```

Create children at any level by passing `--parent <ticket-id>`. The server uses `http://127.0.0.1:4000` by default and stays in the foreground; stop it with Ctrl-C. If the port is occupied, it reports the conflict and starts no additional server. Choose another port explicitly with `pman serve --port N`. It serves only the project found from the current directory or its ancestors. `--open` asks the operating system to open the URL only after the server starts successfully.

## CLI

Run `pman --help` for the current command reference. The first release supports project initialization; ticket create/list/show/update/move; trees; goal, plan and decision creation; comments; typed relationships; offline search; bounded context; validation; and the project-local web UI. Output is JSON by default where useful; pass `--format json` where supported for an explicit machine-readable contract.

## Search

`pman search QUERY` is an offline keyword search over tickets, comments, goals, plans and decisions. Results are ranked (exact title, title prefix, title contains, body) with stable tie-breaks and paged: `--limit` (max 100), `--offset`, `--type ticket,comment,goal,plan,decision`. JSON output includes `total`, `nextOffset` and a `snapshot`; passing a stale snapshot to a follow-up page fails with `STALE_SEARCH` instead of mixing old and new results. Comment hits carry their `ticketId`. Keyword search reads the canonical files on every query and always works.

### Semantic search (optional)

Semantic search finds tickets by meaning, e.g. "navigation" also finds "menu". It is opt-in per checkout and runs fully locally:

```sh
pnpm exec pman index update                  # build or refresh the index (first run downloads the model, ~120 MB)
pnpm exec pman search "burger menu" --mode hybrid
pnpm exec pman similar PM-12                 # tickets that look like PM-12, with "likely overlap" flags
pnpm exec pman index status
```

Embeddings use the optional dependency `@huggingface/transformers` (ONNX) with `Xenova/multilingual-e5-small`. Plans are expected to be written in English. The index lives outside the repo in `~/.pman/cache/<projectId>/db.sqlite` (SQLite in WAL mode) and is derived data: delete it any time, `pman index rebuild` recreates it. `hybrid` combines semantic and keyword results; when no index exists or the model cannot load, it falls back to keyword search and says why.

In the web UI the search box shows which mode is active and offers **Enable semantic search**. Once enabled, `pman serve` keeps the index up to date in the background, and each ticket shows **Similar tickets** with buttons to mark a duplicate or link related work.

## Agent workflow

pman is built so coding agents can pick work in a sensible order without a human triaging every step:

```sh
pnpm exec pman next                          # ready tickets, ranked, with reasons
pnpm exec pman claim <id> --agent my-agent   # in_progress + assignee with a 60-minute lease
pnpm exec pman context <id> --format json    # bounded context packet incl. readiness
pnpm exec pman done <id> --note "tested"     # done + comment, prints newly ready tickets
pnpm exec pman agent onboard                    # briefing for agents (prints only)
```

A ticket is ready when it is `todo`, has no open children, and neither it nor any ancestor has an open `blocks` dependency. `next` ranks by priority (an explicit priority wins; `normal` inherits from the nearest ancestor with an explicit one), then by how many tickets finishing it transitively unblocks, then by proximity to work already in progress, then by age. A parent cannot be set to `done` while descendants or blockers are open unless `--force` is passed. Expired leases are offered again by `next`. Claims are also shared between Git worktrees of the same repository (in `.git/pman/claims.json`, never committed), so two agents in different worktrees cannot claim the same ticket; set `PMAN_SHARED_CLAIMS=0` to turn this off. `PMAN_AGENT` sets the default agent name.

Tickets have a `kind` of `task`, `feature` or `bug`.

## Blueprints: plan the whole heist

A "header" is never just a header: it needs a logo, navigation, a burger menu on mobile, a skip link, states, tests. Blueprints are checklists that expand a ticket into everything it really needs.

```sh
pnpm exec pman blueprint list                     # built-in: ui-component, header, footer, form, page, service, api-endpoint, login
pnpm exec pman blueprint suggest PM-12            # which blueprint fits this ticket
pnpm exec pman blueprint apply PM-12 header --dry-run
pnpm exec pman blueprint apply PM-12 header       # child tickets for all required items
pnpm exec pman blueprint apply PM-12 header --only cart   # add an optional item later
pnpm exec pman blueprint skip PM-12 sticky --reason "static header is enough"
pnpm exec pman blueprint status PM-12             # planned / done / not needed / missing
pnpm exec pman blueprint init header              # copy into .pman/blueprints/header.json and adapt it
```

Optional items are decisions, not defaults: they stay "undecided" until you create a ticket for them or skip them with a reason. `pman check` warns about missing and undecided items, `pman context` includes the checklist for agents, and the ticket view in `pman serve` has a **Checklist** section to preview, apply and decide items. Project blueprints in `.pman/blueprints/` override built-ins of the same name and can `extend` another blueprint.

## Code plans and contracts

Agents can plan code before writing it and check the plan for consistency. Components (`module`, `service`, `class`, `method`, `function`, `ui-component`), shared types and contracts live centrally in `.pman/components/`, `.pman/types/` and `.pman/contracts/`; tickets only reference them in an optional code plan, so a contract is never copied or edited per ticket. Plain tasks such as a colour change need no code plan.

```sh
pnpm exec pman type set User --schema '{"email":"string","firstName":"string","lastName":"string"}'
pnpm exec pman component add --kind service --name UserService
pnpm exec pman component add --kind method --name getUser --parent UserService
pnpm exec pman contract set UserService.getUser --input '{"userId":"string"}' --output User
pnpm exec pman codeplan add <user-ticket> implements UserService
pnpm exec pman codeplan add <cart-ticket> consumes UserService.getUser --requires userId,email:string --provides userId
pnpm exec pman check
# ✗ REQUIRED_FIELD_MISSING  Ticket … needs UserService.getUser → output.userId, but the contract returns: email, firstName, lastName
```

Schemas use a JSON Schema subset (`string`, `number`, `integer`, `boolean`, `null`, `any`, `array`, `object`, `required`, `enum`, `$ref`) or a shorthand: `"string"`, `"string?"` for optional properties, `"string[]"`, a type name such as `"User"`, `[{"sku":"string"}]`. `requires` entries are output paths, optionally typed (`address.city:string`); `provides` lists the input fields the consumer supplies. `pman check` reports missing or mistyped fields, missing input, unknown types, components without contracts, methods without an owning class or service, consumed components no ticket implements, consumers affected by `changes`, and dependency cycles. A ticket that consumes a component waits for the tickets implementing it (or an ancestor component), and `pman next` orders work accordingly. `pman context` includes the resolved code plan with contracts and referenced types. Contract and type versions increase when they change, and earlier versions are kept in `history` (`pman contract history`). Every `contract set` and `type set` classifies the change as breaking or compatible and lists the open consumer tickets it may break; add `--dry-run` to preview without writing:

```sh
pnpm exec pman type set User --schema '{"userId":"string","mail":"string"}' --dry-run
# [dry run] type User v2
#   ✗ breaking  UserService.getUser output.email removed
#   · compatible  UserService.getUser output.mail added
#   Affected open consumer tickets: … (requires email)
```

For outputs, removing a field, making it optional, adding enum values or changing its type incompatibly is breaking; for inputs, a new required field, narrowing a type or removing enum values is breaking.

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

Agent launching, hosted accounts/sharing, remote sync, MCP, arbitrary extensions/hooks, binary asset ingestion, global install, and npm publication are outside this first release. The merged contract and research are in [`docs/product-vision.md`](docs/product-vision.md), [`docs/architecture-proposal.md`](docs/architecture-proposal.md), [`docs/roadmap.md`](docs/roadmap.md), and [`docs/research/fp-feature-matrix.md`](docs/research/fp-feature-matrix.md). Implementation choices are in [`docs/implementation-decisions.md`](docs/implementation-decisions.md).

## Development

```sh
pnpm run check
```

The test suite uses only Node's built-in test runner and temporary project directories.
