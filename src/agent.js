import fs from 'node:fs/promises';
import path from 'node:path';
import { ValidationError } from './index.js';

const START = '<!-- pman:start -->', END = '<!-- pman:end -->';

export const AGENT_SECTION = `${START}
## Planning with pman

This project plans its work in \`.pman/\` (Git-tracked). Use the \`pman\` CLI (if it is only a project dependency, prefix commands with your package runner, e.g. \`pnpm exec pman\`) and do not edit \`.pman/\` files by hand. Tickets can be referenced by key, e.g. \`PM-12\`.

1. \`pman next --format json\` lists tickets that are ready now, ranked with reasons. Take the first one unless you have a reason not to.
2. \`pman claim <id> --agent <your-name>\` before you start. If the claim fails, pick another ticket.
3. \`pman context <id> --format json\` gives the ticket, its ancestors, children, relationships, comments and linked documents.
4. Work only on the claimed ticket. Create follow-up work with \`pman ticket create --parent <id> --title ...\` and dependencies with \`pman relation add <blocker> <blocked> blocks\`.
5. \`pman done <id> --agent <your-name> --note "<what changed, how it was verified>"\` when finished, or \`pman release <id>\` if you stop.
6. Run \`pman validate\` before committing; commit \`.pman/\` changes together with the code they describe.

Before implementing code that other parts call or depend on, plan it centrally: \`pman component add\`, \`pman type set\`, \`pman contract set\`, then attach it to the ticket with \`pman codeplan add <id> implements|consumes|changes <Component>\` (use \`--requires\` for the fields you need). Run \`pman check\` and resolve errors before writing code; change a contract centrally instead of working around it.

When you plan a new feature, check what it really needs: \`pman blueprint suggest <id>\` and \`pman blueprint apply <id> <name> --dry-run\` show the checklist (a header also needs a logo, a mobile menu, a skip link ...). Apply it to create child tickets, and decide optional items with \`--only\` or \`pman blueprint skip <id> <item> --reason ...\`. \`pman check\` warns about missing or undecided items.

A parent ticket can only be marked done after its children and blockers are finished.
${END}
`;

/** Adds or refreshes the pman section between markers; never touches other text. Preview unless write is set. */
export async function agentInit(p, { file = 'AGENTS.md', write = false } = {}) {
  const target = path.resolve(p.root, file);
  const rel = path.relative(p.root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new ValidationError('Agent instruction file must be inside the project');
  let current = '';
  try { current = await fs.readFile(target, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const eol = current.includes('\r\n') ? '\r\n' : '\n';
  const section = AGENT_SECTION.replace(/\n/g, eol);
  const s = current.indexOf(START), e = current.indexOf(END);
  let next;
  if (s >= 0 && e > s) next = current.slice(0, s) + section.trimEnd() + current.slice(e + END.length);
  else next = current + (current && !current.endsWith(eol) ? eol : '') + (current ? eol : '') + section;
  if (write && next !== current) await fs.writeFile(target, next);
  return { file: rel.split(path.sep).join('/'), write, changed: next !== current, section };
}
