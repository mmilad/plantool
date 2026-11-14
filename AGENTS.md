# Agent notes

Run `heist agent onboard` to learn how this project plans its work. The plan lives in `.heist/`; `heist next` lists what is ready, `heist ticket show KEY` shows a ticket as a document.

## Working in this repository

- **One branch per feature.** Start from an up-to-date `main`: `git switch -c feature/<short-name>`. Commit there. Do not leave work uncommitted on `main` and do not commit unfinished work to `main`.
- **Merge when it is done.** When the tests pass and the ticket is closed, merge into `main` with `git merge --ff-only feature/<short-name>` (rebase the branch first if `main` moved). The owner pushes.
- **Tests.** `node --test` (same as `pnpm test`) must pass before a ticket is closed. `pnpm run check` also checks syntax.
- **Tickets.** Claim before you start (`heist claim KEY --agent NAME`), tick to-dos and acceptance criteria as you go (`heist ticket todo KEY N`, `heist ticket check KEY N`), and close with `heist done KEY --note "what changed" --verified "how you checked" --files`. Commit the changed files under `.heist/` together with the code.
- **Language.** Code, comments, commit messages, tickets and docs are English.
- **`src/ui.js`.** The file returns the whole page as one JavaScript template literal, and the browser code sits inside it. Code added inside must not contain a backtick, a dollar sign followed by an opening brace, or a backslash. Run `node --check src/ui.js` after every change.
- **Decisions.** Record a choice that others have to live with in `docs/implementation-decisions.md`, and as a decision in heist when there were real options (`heist ask`, `heist decide`).
