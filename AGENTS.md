# Agent notes

Run `plantool agent onboard` once, the first time you work here, to learn how this project plans its work, and keep the key rules in your own notes. Do not repeat it in every session; repeat it only when `plantool --version` changes or your notes are gone. The plan lives in `.plan/`; `plantool next` lists what is ready, `plantool ticket show KEY` shows a ticket as a document.

## Working in this repository

- **One branch per feature.** Start from an up-to-date `main`: `git switch -c feature/<short-name>`. Commit there. Do not leave work uncommitted on `main` and do not commit unfinished work to `main`.
- **Merge when it is done.** When the tests pass and the ticket is closed, merge into `main` with `git merge --ff-only feature/<short-name>` (rebase the branch first if `main` moved). The owner pushes.
- **Tests.** `node --test` (same as `pnpm test`) must pass before a ticket is closed. `pnpm run check` also checks syntax.
- **Tickets.** Claim before you start (`plantool claim KEY --agent NAME`), tick to-dos and acceptance criteria as you go (`plantool ticket todo KEY N`, `plantool ticket check KEY N`), and close with `plantool done KEY --note "what changed" --verified "how you checked" --files`. Commit the changed files under `.plan/` together with the code.
- **Trying commands.** This repository plans itself with plantool, so `plantool ticket create` here writes into the real plan. Try commands in a throwaway project instead: `cd "$(mktemp -d)" && PLANTOOL_HOME="$PWD/home" PLANTOOL_NO_REGISTER=1 node /path/to/repo/bin/plantool.js init --name demo --key DEMO`. Keep scratch files outside the repository.
- **Language.** Code, comments, commit messages, tickets and docs are English.
- **`src/ui.js`.** The file returns the whole page as one JavaScript template literal, and the browser code sits inside it. Code added inside must not contain a backtick, a dollar sign followed by an opening brace, or a backslash. Run `node --check src/ui.js` after every change.
- **Decisions.** Record a choice that others have to live with in `docs/implementation-decisions.md`, and as a decision in plantool when there were real options (`plantool ask`, `plantool decide`).
