<!-- pman:start -->
## Planning with pman

This project plans its work in `.pman/` (Git-tracked). Use the project-local CLI (`npx pman`) and do not edit `.pman/` files by hand.

1. `npx pman next --format json` lists tickets that are ready now, ranked with reasons. Take the first one unless you have a reason not to.
2. `npx pman claim <id> --agent <your-name>` before you start. If the claim fails, pick another ticket.
3. `npx pman context <id> --format json` gives the ticket, its ancestors, children, relationships, comments and linked documents.
4. Work only on the claimed ticket. Create follow-up work with `npx pman ticket create --parent <id> --title ...` and dependencies with `npx pman relation add <blocker> <blocked> blocks`.
5. `npx pman done <id> --agent <your-name> --note "<what changed, how it was verified>"` when finished, or `npx pman release <id>` if you stop.
6. Run `npx pman validate` before committing; commit `.pman/` changes together with the code they describe.

Before implementing code that other parts call or depend on, plan it centrally: `npx pman component add`, `npx pman type set`, `npx pman contract set`, then attach it to the ticket with `npx pman codeplan add <id> implements|consumes|changes <Component>` (use `--requires` for the fields you need). Run `npx pman check` and resolve errors before writing code; change a contract centrally instead of working around it.

A parent ticket can only be marked done after its children and blockers are finished.
<!-- pman:end -->
