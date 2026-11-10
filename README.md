# Heistman (`heist`)

Heistman is a Git-native planning and ticket graph for people and coding agents. Canonical project data lives in the repository under `.heist/`, works offline, and is ordinary reviewable JSON and Markdown. Tickets can be nested to arbitrary depth using explicit `parentId` links.

## Install locally

The project uses pnpm. For local development, `pnpm link --global` in this repository makes `heist` available everywhere.


After a release is published, install the package as a project-local development dependency:

```sh
pnpm add -D @mmilad/heist
pnpm exec heist init
pnpm exec heist --help
```

Node.js 22 or newer is required. No native binary, database, hosted service or FP installation is used. A small machine-local project list (`~/.heist/projects.json`) lets `heist serve` show all your projects; canonical data always stays in each repository. `heist init` creates tracked `.heist/` data and does not modify `.gitignore`.

The npm package is `@mmilad/heist`; the executable remains `heist`. The merged planning documents used the provisional unscoped name `heistman`; the owner selected the personal scope after checking the existing `heist` name. The package is not published.

## Workspace: all projects in one UI

Run `heist serve` from any directory. It opens a Jira-like workspace with every project heist knows: a project directory, and per project a Summary (status, priority and type breakdown plus the "ready to start" order agents get from `heist next`), a Board with status columns (drag cards or use Alt+←/→ to change status), a List with the ticket tree and issue details, Documents and Design.

Projects are registered automatically in a machine-local list (`~/.heist/projects.json`, override with `HEIST_HOME`) whenever you run `heist init` or any heist command inside them; `heist projects`, `heist projects add PATH`, `heist projects remove KEY|PATH` and `heist projects prune` manage the list, and the UI can add or remove projects too. Removing a project from the list never touches its files. Set `HEIST_NO_REGISTER=1` to skip automatic registration.

Tickets have Jira-style keys such as `SHOP-42` (project key plus a sequential number). Every command that takes a ticket ID also accepts the key, e.g. `heist ticket show SHOP-42` or `heist claim SHOP-42 --agent bob`. Existing projects get keys with `heist keys init [--key SHOP]`; after merging branches that created tickets in parallel, `heist keys renumber` fixes duplicate numbers (`heist validate` warns about them).

## Quick start

```sh
pnpm exec heist init --name "My project"
pnpm exec heist goal create --title "First release" --body "Ship a usable feature set."
pnpm exec heist ticket create --title "Build the core"
pnpm exec heist ticket list
pnpm exec heist tree
pnpm exec heist validate
pnpm exec heist serve
```

Create children at any level by passing `--parent <ticket-id>`. The server uses `http://127.0.0.1:4000` by default and stays in the foreground; stop it with Ctrl-C. If the port is occupied, it reports the conflict and starts no additional server. Choose another port explicitly with `heist serve --port N`. It serves only the project found from the current directory or its ancestors. `--open` asks the operating system to open the URL only after the server starts successfully.

## CLI

Run `heist --help` for the current command reference. The first release supports project initialization; ticket create/list/show/update/move; trees; goal, plan and decision creation; comments; typed relationships; offline search; bounded context; validation; and the project-local web UI. Output is JSON by default where useful; pass `--format json` where supported for an explicit machine-readable contract.

## Search

`heist search QUERY` is an offline keyword search over tickets, comments, goals, plans and decisions. Results are ranked (exact title, title prefix, title contains, body) with stable tie-breaks and paged: `--limit` (max 100), `--offset`, `--type ticket,comment,goal,plan,decision`. JSON output includes `total`, `nextOffset` and a `snapshot`; passing a stale snapshot to a follow-up page fails with `STALE_SEARCH` instead of mixing old and new results. Comment hits carry their `ticketId`. Keyword search reads the canonical files on every query and always works.

### Semantic search (optional)

Semantic search finds tickets by meaning, e.g. "navigation" also finds "menu". It is opt-in per checkout and runs fully locally:

```sh
pnpm exec heist index update                  # build or refresh the index (first run downloads the model, ~120 MB)
pnpm exec heist search "burger menu" --mode hybrid
pnpm exec heist similar PM-12                 # tickets that look like PM-12, with "likely overlap" flags
pnpm exec heist index status
```

Embeddings use the optional dependency `@huggingface/transformers` (ONNX) with `Xenova/multilingual-e5-small`. Plans, code and code comments are written in English; the person can talk to agents in any language. The embedding model was chosen for English queries, not for multilingual text. The index lives outside the repo in `~/.heist/cache/<projectId>/db.sqlite` (SQLite in WAL mode) and is derived data: delete it any time, `heist index rebuild` recreates it. `hybrid` combines semantic and keyword results; when no index exists or the model cannot load, it falls back to keyword search and says why.

In the web UI the search box shows which mode is active and offers **Enable semantic search**. Once enabled, `heist serve` keeps the index up to date in the background, and each ticket shows **Similar tickets** with buttons to mark a duplicate or link related work.

## Agent workflow

heist is built so coding agents can pick work in a sensible order without a human triaging every step:

```sh
pnpm exec heist next                          # ready tickets, ranked, with reasons
pnpm exec heist claim <id> --agent my-agent   # in_progress + assignee with a 60-minute lease
pnpm exec heist context <id> --format json    # bounded context packet incl. readiness
pnpm exec heist done <id> --note "tested"     # done + comment, prints newly ready tickets
pnpm exec heist agent onboard                    # briefing for agents (prints only)
```

A ticket is ready when it is `todo`, has no open children, and neither it nor any ancestor has an open `blocks` dependency. `next` ranks by priority (an explicit priority wins; `normal` inherits from the nearest ancestor with an explicit one), then by how many tickets finishing it transitively unblocks, then by proximity to work already in progress, then by age. A parent cannot be set to `done` while descendants or blockers are open unless `--force` is passed. Expired leases are offered again by `next`. Claims are also shared between Git worktrees of the same repository (in `.git/heist/claims.json`, never committed), so two agents in different worktrees cannot claim the same ticket; set `HEIST_SHARED_CLAIMS=0` to turn this off. `HEIST_AGENT` sets the default agent name.

Tickets have a `kind` of `task`, `feature`, `bug`, `decision` or `option`. A decision asks a question; its options are children with pros, cons and weighted scores. Agents own decisions by default and may decide them. A person can take one with `--owner human`; then only `--by human` decides or reopens it. A person can always change an agent's decision with `--by human`. `heist decisions` lists what needs a person, `heist decide DECISION` shows the comparison and the suggestion.

## Blueprints: plan the whole heist

A "header" is never just a header: it needs a logo, navigation, a burger menu on mobile, a skip link, states, tests. Blueprints are checklists that expand a ticket into everything it really needs.

```sh
pnpm exec heist blueprint list                     # built-in: ui-component, header, footer, form, page, service, api-endpoint, login
pnpm exec heist blueprint suggest PM-12            # which blueprint fits this ticket
pnpm exec heist blueprint apply PM-12 header --dry-run
pnpm exec heist blueprint apply PM-12 header       # child tickets for all required items
pnpm exec heist blueprint apply PM-12 header --only cart   # add an optional item later
pnpm exec heist blueprint skip PM-12 sticky --reason "static header is enough"
pnpm exec heist blueprint status PM-12             # planned / done / not needed / missing
pnpm exec heist blueprint init header              # copy into .heist/blueprints/header.json and adapt it
```

Optional items are decisions, not defaults: they stay "undecided" until you create a ticket for them or skip them with a reason. `heist check` warns about missing and undecided items, `heist context` includes the checklist for agents, and the ticket view in `heist serve` has a **Checklist** section to preview, apply and decide items. Project blueprints in `.heist/blueprints/` override built-ins of the same name and can `extend` another blueprint.

## Decisions

```sh
heist ask "Which framework?" --options "React Native;Flutter" --criteria "Team knowledge:3, Speed:2" --blocks SHOP-7
heist option score SHOP-21 "Team knowledge=4" "Speed=5"
heist recommend SHOP-8 SHOP-21 --why "the team already knows React"
heist decide SHOP-8 SHOP-21 --by human --why "the person chose it"
```

Choosing an option cancels the other options and their plans, and releases the work that waits for the decision. `--reopen` restores it.

## Code plans and contracts

Agents can plan code before writing it and check the plan for consistency. Components (`module`, `service`, `class`, `method`, `function`, `ui-component`), shared types and contracts live centrally in `.heist/components/`, `.heist/types/` and `.heist/contracts/`; tickets only reference them in an optional code plan, so a contract is never copied or edited per ticket. Plain tasks such as a colour change need no code plan.

```sh
pnpm exec heist type set User --schema '{"email":"string","firstName":"string","lastName":"string"}'
pnpm exec heist component add --kind service --name UserService
pnpm exec heist component add --kind method --name getUser --parent UserService
pnpm exec heist contract set UserService.getUser --input '{"userId":"string"}' --output User
pnpm exec heist codeplan add <user-ticket> implements UserService
pnpm exec heist codeplan add <cart-ticket> consumes UserService.getUser --requires userId,email:string --provides userId
# A stand-in (mock) is an implements entry with --stage mock. A consumer that can work against it says --needs mock;
# without these flags a consumer waits for the full implementation.
pnpm exec heist codeplan add <mock-ticket> implements UserService --stage mock
pnpm exec heist codeplan add <trade-ticket> consumes UserService.getUser --needs mock
pnpm exec heist check
# ✗ REQUIRED_FIELD_MISSING  Ticket … needs UserService.getUser → output.userId, but the contract returns: email, firstName, lastName
```

Schemas use a JSON Schema subset (`string`, `number`, `integer`, `boolean`, `null`, `any`, `array`, `object`, `required`, `enum`, `$ref`) or a shorthand: `"string"`, `"string?"` for optional properties, `"string[]"`, a type name such as `"User"`, `[{"sku":"string"}]`. `requires` entries are output paths, optionally typed (`address.city:string`); `provides` lists the input fields the consumer supplies. `heist check` reports missing or mistyped fields, missing input, unknown types, components without contracts, methods without an owning class or service, consumed components no ticket implements, consumers affected by `changes`, and dependency cycles. A ticket that consumes a component waits for the tickets implementing it (or an ancestor component), and `heist next` orders work accordingly. `heist context` includes the resolved code plan with contracts and referenced types. Contract and type versions increase when they change, and earlier versions are kept in `history` (`heist contract history`). Every `contract set` and `type set` classifies the change as breaking or compatible and lists the open consumer tickets it may break; add `--dry-run` to preview without writing:

```sh
pnpm exec heist type set User --schema '{"userId":"string","mail":"string"}' --dry-run
# [dry run] type User v2
#   ✗ breaking  UserService.getUser output.email removed
#   · compatible  UserService.getUser output.mail added
#   Affected open consumer tickets: … (requires email)
```

For outputs, removing a field, making it optional, adding enum values or changing its type incompatibly is breaking; for inputs, a new required field, narrowing a type or removing enum values is breaking.

## TypeScript API

```ts
import { openProject } from '@mmilad/heist';

const project = await openProject({ cwd: process.cwd() });
const parent = await project.tickets.create({ title: 'Feature' });
const child = await project.tickets.create({ title: 'Subtask', parentId: parent.id });
console.log(await project.tree());
```

See [`src/index.d.ts`](src/index.d.ts) for the exported API and [`schema/heist.schema.json`](schema/heist.schema.json) for the project-config schema. Structured ticket records use schema version 1; long-form planning docs use Markdown with a small metadata header. UUIDv7 IDs and record paths are independent of title and parent.

## Product boundaries

Parent rollups are derived views and never cascade status edits to children. Git remains the collaboration and history layer; simultaneous edits to the same record are not distributed transactions. The local server has no login and binds only to loopback; it checks Host and Origin and requires a per-server CSRF token for writes. It does not load extensions or remote assets.

Agent launching, hosted accounts/sharing, remote sync, MCP, arbitrary extensions/hooks, binary asset ingestion, global install, and npm publication are outside this first release. The merged contract and research are in [`docs/product-vision.md`](docs/product-vision.md), [`docs/architecture-proposal.md`](docs/architecture-proposal.md), [`docs/roadmap.md`](docs/roadmap.md), and [`docs/research/fp-feature-matrix.md`](docs/research/fp-feature-matrix.md). Implementation choices are in [`docs/implementation-decisions.md`](docs/implementation-decisions.md).

## Development

```sh
pnpm run check
```

The test suite uses only Node's built-in test runner and temporary project directories.
