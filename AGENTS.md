<!-- pman:start -->
## Planning with pman

This project plans its work in `.pman/` (Git-tracked). Use the `pman` CLI (if it is only a project dependency, prefix commands with your package runner, e.g. `pnpm exec pman`) and do not edit `.pman/` files by hand. Tickets can be referenced by key, e.g. `PM-12`.

1. `pman next --format json` lists tickets that are ready now, ranked with reasons. Take the first one unless you have a reason not to.
2. `pman claim <id> --agent <your-name>` before you start. If the claim fails, pick another ticket.
3. `pman context <id> --format json` gives the ticket, its ancestors, children, relationships, comments and linked documents.
4. Work only on the claimed ticket. Create follow-up work with `pman ticket create --parent <id> --title ...` and dependencies with `pman relation add <blocker> <blocked> blocks`.
5. `pman done <id> --agent <your-name> --note "<what changed, how it was verified>"` when finished, or `pman release <id>` if you stop.
6. Run `pman validate` before committing; commit `.pman/` changes together with the code they describe.

Before implementing code that other parts call or depend on, plan it centrally: `pman component add`, `pman type set`, `pman contract set`, then attach it to the ticket with `pman codeplan add <id> implements|consumes|changes <Component>` (use `--requires` for the fields you need). Run `pman check` and resolve errors before writing code; change a contract centrally instead of working around it.

When you plan a new feature, check what it really needs: `pman blueprint suggest <id>` and `pman blueprint apply <id> <name> --dry-run` show the checklist (a header also needs a logo, a mobile menu, a skip link ...). Apply it to create child tickets, and decide optional items with `--only` or `pman blueprint skip <id> <item> --reason ...`. `pman check` warns about missing or undecided items.

A parent ticket can only be marked done after its children and blockers are finished.
<!-- pman:end -->
