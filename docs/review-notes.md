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
- The CLI test set `PMAN_NO_REGISTER` instead of `HEIST_NO_REGISTER` and would have left test projects in the real registry. Fixed.
- The default owner of a decision is now shown as `agent`, as it is when created.
- Server routes for decisions (create, read, score, recommend, decide, reopen) exist and are tested. Over HTTP, `by` defaults to human because the web view acts for the person.

### Open after that round (2026-11-09)

1. `done` without a note is allowed and only gets a hint. This stays until teams want it enforced.
2. The duplicate warning compares identical titles. Similarity by model is only a hint. Changed on 2026-11-11, see below.
3. The feature blueprint exists but was not checked against real features. Checked on 2026-11-11, see below.
4. `decide --by human` is a statement anyone can make. It protects against mistakes, not against an agent that invents the answer. The briefing says so.
5. The HTTP routes have no permission of their own. They are reachable only locally and protected by a CSRF token, so an agent with access to the server could decide as a person. This was accepted deliberately.
6. Outside the repository: check `where heist` on the Windows machine for a name collision (HEIST-8) and run the real model there (HEIST-3).

## Next-steps round (2026-11-11)

- The repository moved to `mmilad/heistman`; `main` holds everything. Stale lock files and 21 leftover temporary objects in `.git` were removed; `git fsck` is clean.
- Line endings: every tracked text file is LF in the index and in the working tree. Git's CRLF warnings on Windows come from its `core.autocrlf` setting and are harmless with the current `.gitattributes`; nothing to fix.
- Open work is tracked in heist again (HEIST-1 and following), in English.
- Similarity hint in `ticket create`: the fixed threshold 0.86 is gone. The plain z-score rule of `heist similar` was tried first and failed as soon as two related tickets existed, so the hint uses a robust strength (median and median absolute deviation). Numbers are in `implementation-decisions.md`.
- A test with the real model exists (`HEIST_TEST_REAL_MODEL=1`) and passed on Linux. It could not run inside the connected Windows folder from a Linux shell, because `node_modules` there is a Windows install.
- Feature blueprint, applied to HEIST-1 (a CLI feature):
  - `heist blueprint suggest` did not offer it for a ticket of kind `feature`, only for titles containing "feature" or "flow". Fixed: the kind counts now.
  - `behaviour` and `tests` fit, but they overlap with the ticket's own description and acceptance criteria. For a small feature they produce child tickets whose only work is to write those fields.
  - `states` ("empty, loading, error and permission cases") is worded for UI. For a CLI or library feature the same question is "which edge cases and failures".
  - `data` and `contracts` were skipped with a reason, which worked well.
  - Not changed yet: whether the blueprint should fill fields on the feature instead of creating child tickets is a design question (HEIST-14).
- `heist guide decisions` printed its last line twice. Fixed.

### Still open

- Decisions view in a browser (HEIST-4), real model on Windows (HEIST-3), name collision check (HEIST-8).
- `likelyOverlap` in `heist similar` has the same group weakness as the plain z-score; the quality set in `bench/` still points at the removed PM tickets (HEIST-7).
- The create hint embeds all tickets on every call (HEIST-13).
