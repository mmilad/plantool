# Review notes

## CLI exploration (2026-11-08)

Tested: the acceptance run with the Pokémon example through the CLI (as an agent would), and typical misuse in a test project outside the repository.

### Fixed in that round

- Options without scores got score 0 and were shown as the suggestion. Now there is no suggestion until options are scored.
- Agents could decide or reopen decisions that belong to a person. The default decider is now `unknown`; a person's decisions need `--by human`.
- A missing ticket argument gives a readable message instead of "undefined".
- Invalid JSON in `--input`/`--output` names the error directly.
- `ticket create` warns when a ticket with the same title exists and shows the command to link them.
- Finishing a ticket (`done`) with an active claim needs the claimant (`--agent`) or `--force`.
- Consumers with `needs full` and only a planned mock get a warning in `check`.
- `done` without `--note` prints a hint but does not block.
- JSON output of tickets now contains the `key`.
- The order inside the product blueprint is implemented (`after` creates `blocks` relations).
- `ticket create` names related tickets by overlapping title words (no index or model needed). `check` reports tickets whose text names the title of another ticket without a relation between them (`UNLINKED_MENTION`).
- A generic feature blueprint exists.
- The web view has a decisions page: a list with the filter "needs a person", options with choose and reopen (as a person).
- `ticket create` uses an embedding model for hints at related tickets when one is available (otherwise title words only). It is a hint, not a duplicate check.
- The CLI test set `PMAN_NO_REGISTER` instead of `PLANTOOL_NO_REGISTER` and would have left test projects in the real registry. Fixed.
- The default owner of a decision is now shown as `agent`, as it is when created.
- Server routes for decisions (create, read, score, recommend, decide, reopen) exist and are tested. Over HTTP, `by` defaults to human because the web view acts for the person.

### Open after that round (2026-11-09)

1. `done` without a note is allowed and only gets a hint. This stays until teams want it enforced.
2. The duplicate warning compares identical titles. Similarity by model is only a hint. Changed on 2026-11-11, see below.
3. The feature blueprint exists but was not checked against real features. Checked on 2026-11-11, see below.
4. `decide --by human` is a statement anyone can make. It protects against mistakes, not against an agent that invents the answer. The briefing says so.
5. The HTTP routes have no permission of their own. They are reachable only locally and protected by a CSRF token, so an agent with access to the server could decide as a person. This was accepted deliberately.
6. Outside the repository: check `where plantool` on the Windows machine for a name collision (PLAN-8) and run the real model there (PLAN-3).

## Next-steps round (2026-11-11)

- The repository moved to `mmilad/plan`; `main` holds everything. Stale lock files and 21 leftover temporary objects in `.git` were removed; `git fsck` is clean.
- Line endings: every tracked text file is LF in the index and in the working tree. Git's CRLF warnings on Windows come from its `core.autocrlf` setting and are harmless with the current `.gitattributes`; nothing to fix.
- Open work is tracked in plantool again (PLAN-1 and following), in English.
- Similarity hint in `ticket create`: the fixed threshold 0.86 is gone. The plain z-score rule of `plantool similar` was tried first and failed as soon as two related tickets existed, so the hint uses a robust strength (median and median absolute deviation). Numbers are in `implementation-decisions.md`.
- A test with the real model exists (`PLANTOOL_TEST_REAL_MODEL=1`) and passed on Linux. It could not run inside the connected Windows folder from a Linux shell, because `node_modules` there is a Windows install.
- Feature blueprint, applied to PLAN-1 (a CLI feature):
  - `plantool blueprint suggest` did not offer it for a ticket of kind `feature`, only for titles containing "feature" or "flow". Fixed: the kind counts now.
  - `behaviour` and `tests` fit, but they overlap with the ticket's own description and acceptance criteria. For a small feature they produce child tickets whose only work is to write those fields.
  - `states` ("empty, loading, error and permission cases") is worded for UI. For a CLI or library feature the same question is "which edge cases and failures".
  - `data` and `contracts` were skipped with a reason, which worked well.
  - Decided on 2026-11-12 (PLAN-14): the planner chooses per item. Work becomes a child ticket, information is answered on the ticket itself (`plantool blueprint answer`), the rest is skipped. `plantool blueprint attach` puts the checklist on a ticket without creating tickets. The `states` item was reworded.
- `plantool guide decisions` printed its last line twice. Fixed.

### Status of items from this review (checked 2026-11-20)

The bullets above are historical notes from November 2026, not a current open-work list. Plan records PLAN-3, PLAN-4, PLAN-7, PLAN-8 and PLAN-13 as done, and the schema filename mismatch was fixed on 2026-11-12. PLAN-9 (MCP) and PLAN-21 (editable ticket fields) are also done. The current plan has no todo or in-progress tickets and no open decisions. Remaining npm release checks are listed in `implementation-decisions.md`.

## Blueprints and checklists (2026-11-12)

- Owner: the first idea of a blueprint was a ticket template, like a Linear issue template or a GitHub pull request template: what is expected. The lists of parts are something else and both are wanted.
- The lists of parts are now called checklists (PLAN-19). Blueprints are per ticket kind and name the expected fields (PLAN-20). Details in `implementation-decisions.md`.
- Historical note: at the time, `plantool blueprint check` reported PLAN-9 (MCP) as incomplete and PLAN-21 as open. Both tickets are now recorded as done; MCP behavior is described in `implementation-decisions.md`.

