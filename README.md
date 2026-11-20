# Plan (`plantool`)

Plan is a Git-native planning and ticket graph for people and coding agents. Canonical project data lives in the repository under `.plan/`, works offline, and is ordinary reviewable JSON and Markdown. Tickets can be nested to arbitrary depth using explicit `parentId` links.

## Install locally

The project uses pnpm. For local development, `pnpm link --global` in this repository makes `plantool` available everywhere.

To install the same package the way users will get it from npm, without publishing:

```bash
npm pack --pack-destination "$HOME/plantool-pkg"
npm install -g "$HOME/plantool-pkg/mmilad-plantool-0.1.0.tgz"
plantool --version
```

Keeping the tarball outside the repository avoids an untracked file in Git.


After a release is published, install the package as a project-local development dependency:

```sh
pnpm add -D @mmilad/plantool
pnpm exec plantool init
pnpm exec plantool --help
```

Node.js 22 or newer is required. No native binary, database, hosted service or FP installation is used. A small machine-local project list (`~/.plan/projects.json`) lets `plantool serve` show all your projects; canonical data always stays in each repository. `plantool init` creates tracked `.plan/` data and does not modify `.gitignore`.

The npm package will be `@mmilad/plantool`, with `plantool` as its command. No version has been published.

## Workspace: all projects in one UI

Run `plantool serve` from any directory. It opens a Jira-like workspace with every registered project. Each project has a Summary (status, priority and type breakdown plus the "ready to start" order agents get from `plantool next`), a Board with status columns (drag cards or use Alt+←/→ to change status), a List with the ticket tree and issue details, Documents and Design.

Projects are registered automatically in a machine-local list (`~/.plan/projects.json`, override with `PLANTOOL_HOME`) whenever you run `plantool init` or any `plantool` command inside a project; `plantool projects`, `plantool projects add PATH`, `plantool projects remove KEY|PATH` and `plantool projects prune` manage the list, and the UI can add or remove projects too. Removing a project from the list never touches its files. Set `PLANTOOL_NO_REGISTER=1` to skip automatic registration.

Tickets have Jira-style keys such as `SHOP-42` (project key plus a sequential number). Every command that takes a ticket ID also accepts the key, e.g. `plantool ticket show SHOP-42` or `plantool claim SHOP-42 --agent bob`. Existing projects get keys with `plantool keys init [--key SHOP]`; after merging branches that created tickets in parallel, `plantool keys renumber` fixes duplicate numbers (`plantool validate` warns about them).

## Quick start

```sh
pnpm exec plantool init --name "My project"
pnpm exec plantool goal create --title "First release" --body "Ship a usable feature set."
pnpm exec plantool ticket create --title "Build the core"
pnpm exec plantool ticket list
pnpm exec plantool tree
pnpm exec plantool validate
pnpm exec plantool serve
```

Link tickets when you create or update them: `plantool ticket create --title "Write the tests" --blocked-by SHOP-1 --relates SHOP-2`, or `plantool ticket update SHOP-3 --blocks SHOP-4`. `--blocked-by` names the tickets that must finish first, `--blocks` the tickets that wait for this one, `--relates` related work that does not change the order.

Create children at any level by passing `--parent <ticket-id>`. The server uses `http://127.0.0.1:4000` by default and stays in the foreground; stop it with Ctrl-C. If the port is occupied, it reports the conflict and starts no additional server. Choose another port explicitly with `plantool serve --port N`. It serves every registered project (see above), from any directory. `--open` asks the operating system to open the URL only after the server starts successfully.

## CLI

Run `plantool --help` for the current command reference. The CLI supports project initialization and registry management; ticket create/list/show/update/move; trees and roadmaps; goals, plans and decisions; comments; typed relationships; blueprints and checklists; code plans and contracts; keyword and optional semantic search; bounded context; validation; the local multi-project web UI; and an MCP stdio server for agent workflows. Output is JSON by default where useful; pass `--format json` where supported for an explicit machine-readable contract.

## Search

`plantool search QUERY` is an offline keyword search over tickets, comments, goals, plans and decisions. Results are ranked (exact title, title prefix, title contains, body) with stable tie-breaks and paged: `--limit` (max 100), `--offset`, `--type ticket,comment,goal,plan,decision`. JSON output includes `total`, `nextOffset` and a `snapshot`; passing a stale snapshot to a follow-up page fails with `STALE_SEARCH` instead of mixing old and new results. Comment hits carry their `ticketId`. Keyword search reads the canonical files on every query and always works.

### Semantic search (optional)

Semantic search finds tickets by meaning, e.g. "navigation" also finds "menu". It is opt-in per checkout and runs fully locally:

```sh
pnpm exec plantool index update                  # build or refresh the index (first run downloads the model, ~120 MB)
pnpm exec plantool search "burger menu" --mode hybrid
pnpm exec plantool similar PM-12                 # tickets that look like PM-12, with "likely overlap" flags
pnpm exec plantool index status
```

Embeddings use the optional dependency `@huggingface/transformers` (ONNX) with `Xenova/multilingual-e5-small`. Plans, code and code comments are written in English; the person can talk to agents in any language. The embedding model was chosen for English queries, not for multilingual text. The index lives outside the repo in `~/.plan/cache/<projectId>/db.sqlite` (SQLite in WAL mode) and is derived data: delete it any time, `plantool index rebuild` recreates it. `hybrid` combines semantic and keyword results; when no index exists or the model cannot load, it falls back to keyword search and says why.

In the web UI the search box shows which mode is active and offers **Enable semantic search**. Once enabled, `plantool serve` keeps the index up to date in the background, and each ticket shows **Similar tickets** with buttons to mark a duplicate or link related work.

## Agent workflow

Plan helps coding agents pick work in a sensible order without a human triaging every step:

```sh
pnpm exec plantool next                          # ready tickets, ranked, with reasons
pnpm exec plantool claim <id> --agent my-agent   # in_progress + assignee with a 60-minute lease
pnpm exec plantool context <id> --format json    # bounded context packet incl. readiness
pnpm exec plantool done <id> --note "tested"     # done + comment, prints newly ready tickets
pnpm exec plantool agent onboard                    # briefing for agents (prints only)
```

A ticket is ready when it is `todo`, has no open children, and neither it nor any ancestor has an open `blocks` dependency. `next` ranks by priority (an explicit priority wins; `normal` inherits from the nearest ancestor with an explicit one), then by how many tickets finishing it transitively unblocks, then by proximity to work already in progress, then by age. A parent cannot be set to `done` while descendants or blockers are open unless `--force` is passed. Expired leases are offered again by `next`. Claims are also shared between Git worktrees of the same repository (in `.git/plantool/claims.json`, never committed), so two agents in different worktrees cannot claim the same ticket; set `PLANTOOL_SHARED_CLAIMS=0` to turn this off. `PLANTOOL_AGENT` sets the default agent name.

Tickets have a `kind` of `task`, `feature`, `bug`, `decision` or `option`. A decision asks a question; its options are children with pros, cons and weighted scores. Agents own decisions by default and may decide them. A person can take one with `--owner human`; then only `--by human` decides or reopens it. A person can always change an agent's decision with `--by human`. `plantool decisions` lists what needs a person, `plantool decide DECISION` shows the comparison and the suggestion.

## Blueprints: what a ticket should say

A blueprint says what is expected of a ticket of a kind, like an issue or pull request template, so that a ticket can be understood by someone who was not there. A task has a description, a reason, acceptance criteria and, when the way is known, to-dos; a bug has steps to reproduce; a feature describes what the user does. `plantool ticket show` and the ticket page in the web view present a ticket in that order, name what is missing, and let you tick to-dos and criteria.

```sh
pnpm exec plantool blueprint list                     # what each kind expects
pnpm exec plantool blueprint status SHOP-12           # which expected fields of this ticket are still empty
pnpm exec plantool blueprint check                    # open tickets that lack something
pnpm exec plantool blueprint expect bug severity --type enum --values low,high --hint "How bad is it"
                                                   # a new section; the project field is created with it
pnpm exec plantool blueprint drop bug files           # stop expecting a section
pnpm exec plantool blueprint template bug --file bug-template.md   # the description new bugs start with
pnpm exec plantool blueprint reset bug                # back to the built-in blueprint
```

`plantool ticket create` names what is still empty, and `plantool check` counts the tickets that lack something. Nothing is blocked. A project blueprint can change the expected fields (including the project's own fields) and can carry a `template`: a ticket created without a description starts with that text.

In the web view, the Blueprints page changes the same things, the ticket page edits every section of a ticket and takes comments, and the create dialog starts from the template of the chosen kind.

Blueprints and checklists complement each other: the blueprint describes the ticket itself, the checklist the parts it breaks into.

## Checklists: plan the whole project

A "header" is never just a header: it needs a logo, navigation, a burger menu on mobile, a skip link, states, tests. Checklists name the parts a kind of thing really needs and expand a ticket into them.

```sh
pnpm exec plantool checklist list                     # built-in: ui-component, header, footer, form, page, service, api-endpoint, login
pnpm exec plantool checklist suggest PM-12            # which checklist fits this ticket
pnpm exec plantool checklist apply PM-12 header --dry-run
pnpm exec plantool checklist apply PM-12 header       # child tickets for all required items
pnpm exec plantool checklist apply PM-12 header --only cart   # add an optional item later
pnpm exec plantool checklist skip PM-12 sticky --reason "static header is enough"
pnpm exec plantool checklist status PM-12             # planned / done / not needed / missing
pnpm exec plantool checklist init header              # copy into .plan/checklists/header.json and adapt it
```

Optional items are decisions, not defaults: they stay "undecided" until you create a ticket for them or skip them with a reason. `plantool check` warns about missing and undecided items, `plantool context` includes the checklist for agents, and the ticket view in `plantool serve` has a **Checklist** section to preview, apply and decide items. Project checklists in `.plan/checklists/` override built-ins of the same name and can `extend` another checklist.

## Decisions

```sh
plantool ask "Which framework?" --options "React Native;Flutter" --criteria "Team knowledge:3, Speed:2" --blocks SHOP-7
plantool option score SHOP-21 "Team knowledge=4" "Speed=5"
plantool recommend SHOP-8 SHOP-21 --why "the team already knows React"
plantool decide SHOP-8 SHOP-21 --by human --why "the person chose it"
```

Choosing an option cancels the other options and their plans, and releases the work that waits for the decision. `--reopen` restores it.

## Code plans and contracts

Agents can plan code before writing it and check the plan for consistency. Components (`module`, `service`, `class`, `method`, `function`, `ui-component`), shared types and contracts live centrally in `.plan/components/`, `.plan/types/` and `.plan/contracts/`; tickets only reference them in an optional code plan, so a contract is never copied or edited per ticket. Plain tasks such as a colour change need no code plan.

```sh
pnpm exec plantool type set User --schema '{"email":"string","firstName":"string","lastName":"string"}'
pnpm exec plantool component add --kind service --name UserService
pnpm exec plantool component add --kind method --name getUser --parent UserService
pnpm exec plantool contract set UserService.getUser --input '{"userId":"string"}' --output User
pnpm exec plantool codeplan add <user-ticket> implements UserService
pnpm exec plantool codeplan add <cart-ticket> consumes UserService.getUser --requires userId,email:string --provides userId
# A stand-in (mock) is an implements entry with --stage mock. A consumer that can work against it says --needs mock;
# without these flags a consumer waits for the full implementation.
pnpm exec plantool codeplan add <mock-ticket> implements UserService --stage mock
pnpm exec plantool codeplan add <trade-ticket> consumes UserService.getUser --needs mock
pnpm exec plantool check
# ✗ REQUIRED_FIELD_MISSING  Ticket … needs UserService.getUser → output.userId, but the contract returns: email, firstName, lastName
```

Schemas use a JSON Schema subset (`string`, `number`, `integer`, `boolean`, `null`, `any`, `array`, `object`, `required`, `enum`, `$ref`) or a shorthand: `"string"`, `"string?"` for optional properties, `"string[]"`, a type name such as `"User"`, `[{"sku":"string"}]`. `requires` entries are output paths, optionally typed (`address.city:string`); `provides` lists the input fields the consumer supplies. `plantool check` reports missing or mistyped fields, missing input, unknown types, components without contracts, methods without an owning class or service, consumed components no ticket implements, consumers affected by `changes`, and dependency cycles. A ticket that consumes a component waits for the tickets implementing it (or an ancestor component), and `plantool next` orders work accordingly. `plantool context` includes the resolved code plan with contracts and referenced types. Contract and type versions increase when they change, and earlier versions are kept in `history` (`plantool contract history`). Every `contract set` and `type set` classifies the change as breaking or compatible and lists the open consumer tickets it may break; add `--dry-run` to preview without writing:

```sh
pnpm exec plantool type set User --schema '{"userId":"string","mail":"string"}' --dry-run
# [dry run] type User v2
#   ✗ breaking  UserService.getUser output.email removed
#   · compatible  UserService.getUser output.mail added
#   Affected open consumer tickets: … (requires email)
```

For outputs, removing a field, making it optional, adding enum values or changing its type incompatibly is breaking; for inputs, a new required field, narrowing a type or removing enum values is breaking.

## Roadmap

The local web UI offers **Roadmap → Structure / Timeline / Dependencies / Graph**. Structure includes open, done and cancelled work; filtered ancestors stay visible as context. Timeline shows completed work grouped by month, with bounded paging and date ranges. Dependencies shows a bounded, responsive table of blocked tickets and their blockers. Ticket links open the shared detail view.

The **Graph** tab draws the tickets that have relations as boxes in columns, coloured by status. A `blocks` relation is a solid line with an arrow from the blocker to the blocked ticket. Every other relation type is a dashed line. A click on a box opens the ticket. Tickets without any relation are counted in the status line but not drawn. `plantool graph` returns the same data: `nodes` (with `layer` and `row`), `edges`, `layers`, `hidden`, `totalNodes` and `truncated`. At most 200 tickets are returned; use `--root` to narrow the result. The HTTP route is `GET /api/roadmap/graph`, and the URL mode is `?view=roadmap&mode=graph`.

```sh
plantool tree --fields plan --blocked --format json
plantool tree --fields plan --status todo,in_progress --kind task,feature
plantool timeline --since 2026-01-01 --order desc --limit 50 --format json
plantool roadmap backfill-completion --dry-run
plantool roadmap backfill-completion
plantool deps --root APP-12 --format json
plantool graph --root APP-12 --format json
plantool deps --include-finished
```

`completedAt` is set on completion, survives edits, and is cleared on reopening. Legacy done tickets use an explicitly labelled `updatedAt` estimate; backfill or an ordinary edit pins that estimate and keeps its provenance. Backfill is optional and idempotent, preserves `updatedAt`, and does not recover exact historical dates. Invalid legacy dates are reported as skipped. `validate` warns about missing completion dates. Cancelled tickets are excluded from Timeline.

Use `project.timeline(options)` and `project.roadmap.structure(root, options)` for the same `{items,total,offset,limit,nextOffset,snapshot}` pages. HTTP routes are `GET /api/roadmap/timeline` and `GET /api/roadmap/structure`, also under `/api/projects/:id/roadmap/...`. Timeline accepts `since`, `until` (inclusive ISO dates/timestamps), `kind`, `order`, `limit` (1–200), `offset`, and `snapshot`. Structure accepts `root`, `status`, `hide`, `kind`, `q`, `ready`, `blocked`, `maxDepth` and the paging parameters. CLI uses `--query` and `--max-depth`. Pass the returned snapshot when fetching another page; on `STALE_ROADMAP` (HTTP 409), restart at offset zero. Default `plantool tree` output remains unchanged.

Dependencies is available through `project.deps(options)` (also `project.roadmap.deps`), exported `dependencies(project, options)`, and `GET /api/roadmap/deps` (also project-scoped). Options are `root` (ticket key/UUID), `includeFinished` (default false), `limit` (1–200, default 200), and optional `snapshot`. It returns `{nodes,edges,totalNodes,totalEdges,limit,edgeLimit,truncated,omittedNodes,omittedEdges,rootId,snapshot}`. Edges point from `sourceId` (blocker) to `targetId` (blocked), with `via: blocks|provider`. Provider edges include their components and mock/full stages; multiple components between the same tickets share one provider edge. Explicit and provider edges stay separate.

By default both endpoints must be unfinished. A root selects its subtree, incoming and outgoing cross-branch dependencies, and blockers of its ancestors. External nodes are marked `contextOnly`; ancestor edges keep their actual endpoints and are marked `inherited`. The selected root is retained even if isolated. Results contain at most 200 nodes and 500 edges, and every returned edge has both endpoints. Counts disclose all omissions; narrow with `--root` when truncated. Nodes prioritize the selected root, then scoped endpoints, then external context. A snapshot covers the full scoped projection and options; on `STALE_ROADMAP`, refresh without the old token. These are dependency relationships, not a complete readiness explanation: open children, decisions and claims remain available in Structure and `next`.

## TypeScript API

```ts
import { openProject } from '@mmilad/plantool';

const project = await openProject({ cwd: process.cwd() });
const parent = await project.tickets.create({ title: 'Feature' });
const child = await project.tickets.create({ title: 'Subtask', parentId: parent.id });
console.log(await project.tree());
```

See [`src/index.d.ts`](src/index.d.ts) for the exported API and [`schema/plantool.schema.json`](schema/plantool.schema.json) for the project-config schema. Structured ticket records use schema version 1; long-form planning docs use Markdown with a small metadata header. UUIDv7 IDs and record paths are independent of title and parent.

Ticket creation accepts an optional `requestKey` (16–128 characters from letters, numbers, `.`, `_`, `:`, and `-`). Reusing the same key with the same payload returns the original ticket, including after a process restart; reusing it with a different payload returns a conflict. The browser create form keeps the submitted draft and key in the current tab session so a retry after a lost response does not create a duplicate. Keep a key stable only while retrying the same create request.

## Product boundaries

Parent rollups are derived views and never cascade status edits to children. Git remains the collaboration and history layer; simultaneous edits to the same record are not distributed transactions. The local server has no login and binds only to loopback; it checks Host and Origin and requires a per-server CSRF token for writes. It does not load extensions or remote assets.

Agent launching, hosted accounts/sharing, remote sync, arbitrary extensions/hooks, binary asset ingestion, and automatic npm publication are outside the current release scope. MCP is available through `plantool mcp --agent NAME`. The product contract and historical research are in [`docs/product-vision.md`](docs/product-vision.md), [`docs/architecture-proposal.md`](docs/architecture-proposal.md), [`docs/roadmap.md`](docs/roadmap.md), and [`docs/research/fp-feature-matrix.md`](docs/research/fp-feature-matrix.md). Implementation choices and release checks are in [`docs/implementation-decisions.md`](docs/implementation-decisions.md).

## Development

```sh
pnpm run check
```

The test suite uses only Node's built-in test runner and temporary project directories.
