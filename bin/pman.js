#!/usr/bin/env node
import { initProject, openProject, PmanError, NotFoundError } from '../src/index.js';
import { agentInit } from '../src/agent.js';
import { registerProject, addProjectPath, removeProject, listProjects, pruneProjects, registryHome } from '../src/registry.js';
const autoRegister=async p=>{if(process.env.PMAN_NO_REGISTER==='1')return;try{await registerProject(p);}catch{}};
import { qualifiedNames } from '../src/design.js';
const qname=async(p,id)=>qualifiedNames(await p.components.list()).get(id);
const qualifiedMap=async p=>qualifiedNames(await p.components.list());
function impactText(head,impact,dryRun,names){console.log(`${dryRun?'[dry run] ':''}${head}`);for(const c of impact.changes)console.log(`  ${c.breaking?'✗ breaking':'· compatible'}  ${c.componentId?names.get(c.componentId)+' ':''}${c.side}.${c.path||'(root)'} ${c.change}${c.from?` (${c.from} → ${c.to})`:''}`);if(impact.affectedConsumers.length){console.log('  Affected open consumer tickets:');for(const a of impact.affectedConsumers)console.log(`    ${a.ticketId}  ${a.title}\n      ${a.reasons.join('; ')}`);}}
const json=(v,flag)=>{if(v===undefined)throw new Error(`Missing ${flag}`);try{return JSON.parse(v);}catch{return v;}};
const labels=v=>v===undefined?undefined:String(v).split(',').map(x=>x.trim()).filter(Boolean);
import { serve } from '../src/server.js';

const usage = `pman — Git-native planning and issue tracking

Usage:
  pman init [--name NAME] [--key KEY]
  pman projects [list|add PATH|remove ID|KEY|PATH|prune] [--format json]
  pman keys init [--key KEY]        set the project key and number existing tickets
  pman keys renumber                fix duplicate KEY-n numbers (e.g. after merging branches)
  pman ticket create --title TITLE [--parent ID] [--description TEXT] [--status STATUS]
                     [--kind task|feature|bug] [--priority low|normal|high|urgent] [--labels A,B]
  pman ticket list [--status STATUS] [--parent ID] [--format json]
  pman ticket show ID [--format json]
  pman ticket update ID [--title TITLE] [--status STATUS] [--description TEXT]
                     [--kind KIND] [--priority PRIORITY] [--labels A,B] [--force]
  pman ticket move ID [--parent ID]
  pman tree [ID] [--max-depth N] [--limit N] [--offset N] [--format json]
  pman goal|plan|decision create --title TITLE [--body TEXT] [--links ID,ID]
  pman goal|plan|decision list [--format json]
  pman goal|plan|decision show ID [--format json]
  pman goal|plan|decision update ID [--title T] [--status S] [--body TEXT] [--links ID,ID]
  pman comment add TICKET_ID TEXT
  pman relation add SOURCE_ID TARGET_ID TYPE
  pman relation list [ID]
  pman relation remove RELATION_ID | SOURCE_ID TARGET_ID TYPE

Agent workflow (agent name defaults to $PMAN_AGENT):
  pman next [--limit N] [--parent ID] [--format json]
  pman claim ID [--agent NAME] [--lease MINUTES] [--force]
  pman release ID [--agent NAME] [--force]
  pman done ID [--note TEXT] [--agent NAME] [--force]
  pman agent init [--file AGENTS.md] [--write]

Code plans (components, types and contracts are maintained centrally):
  pman component add --kind KIND --name NAME [--parent COMPONENT] [--description TEXT]
  pman component list [--format json]
  pman component show COMPONENT [--format json]
  pman type set NAME --schema JSON [--description TEXT] [--dry-run]
  pman type list [--format json]
  pman contract set COMPONENT [--input JSON] [--output JSON] [--description TEXT] [--dry-run]
  pman contract history COMPONENT [--format json]
  pman contract show COMPONENT [--format json]
  pman codeplan add TICKET_ID implements|consumes|changes COMPONENT [--requires a,b.c:type] [--provides x,y]
  pman codeplan remove TICKET_ID implements|consumes|changes COMPONENT
  pman codeplan show TICKET_ID
  pman check [--format json]

COMPONENT is a qualified name (UserService.getUser), a unique short name or an ID.
Schemas: full JSON Schema subset or shorthand, e.g. '{"userId":"string","nick":"string?","tags":"string[]","owner":"User"}'.

  pman search QUERY [--type ticket,comment,goal,plan,decision] [--limit N] [--offset N] [--format json]
  pman context ID [--budget BYTES] [--format json]
  pman validate [--format json]
  pman serve [--port N] [--open]   all registered projects, from any directory (default: 127.0.0.1:4000)

All commands operate on the nearest project-local .pman/ directory. Ticket IDs can be given as UUIDs or keys such as PM-42.`;

function parse(args) {
  const opts={}, positional=[];
  for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);if(['open','force','write','dry-run'].includes(k)){opts[k]=true;continue;}if(i+1>=args.length)throw new Error(`Missing value for ${a}`);opts[k.replaceAll('-','_')]=args[++i];}else positional.push(a);}
  return {opts,positional};
}
const out=(value,format='text',kind)=>{
  if(format==='json'){console.log(JSON.stringify(value,null,2));return;}
  if(typeof value==='string'){console.log(value);return;}
  if(Array.isArray(value)&&value.every(x=>x&&typeof x==='object'&&'id'in x&&'title'in x)){
    for(const x of value)console.log(`${(x.key??(Number.isInteger(x.number)&&globalThis.__pmanKey?`${globalThis.__pmanKey}-${x.number}`:x.id.slice(0,8))).padEnd(10)}  ${String(x.status??x.rollup??'').padEnd(11)}  ${'depth'in x?'  '.repeat(x.depth):''}${x.title}`);
    if(!value.length)console.log('No matching items.');return;
  }
  if(value&&typeof value==='object'&&'id'in value)console.log(`${kind??value.type??value.kind??'record'} ${Number.isInteger(value.number)&&globalThis.__pmanKey?`${globalThis.__pmanKey}-${value.number} `:''}${value.id}  ${value.title??''}`.trim());
  else if(value&&typeof value==='object'&&'valid'in value){for(const e of value.errors??[])console.log(`✗ ${e}`);for(const w of value.warnings??[])console.log(`! ${w}`);console.log(value.valid?'Project is valid.':`Project has ${value.errors.length} validation error(s).`);}
  else console.log(JSON.stringify(value,null,2));
};
async function main(argv) {
  if(argv.includes('--help')||argv[0]==='help'||!argv.length){console.log(usage);return;}
  const [command,sub,...rest]=argv;
  if(command==='init'){const {opts}=parse([sub,...rest].filter(Boolean));const c=await initProject({name:opts.name,key:opts.key});await autoRegister(await openProject());out(`Initialized ${c.name} (${c.key}) at .pman/`);return;}
  if(command==='serve'){const {opts}=parse([sub,...rest].filter(Boolean));const s=await serve({port:opts.port===undefined?4000:Number(opts.port),open:!!opts.open,register:process.env.PMAN_NO_REGISTER!=='1'});const n=(await listProjects()).length;console.log(`pman is serving ${n} registered project${n===1?'':'s'}${s.project?` (opened in ${s.project.config.name})`:''} at ${s.url}`);console.log('Press Ctrl-C to stop.');await new Promise(resolve=>s.server.once('close',resolve));return;}
  if(command==='projects'){const parsed=parse([sub,...rest].filter(x=>x!==undefined));const opts=parsed.opts;const action=parsed.positional[0]??'list';const positional=parsed.positional.slice(1);
    if(action==='list'){const all=await listProjects();if(opts.format==='json'){out(all,'json');return;}if(!all.length){console.log(`No projects registered yet (${registryHome()}). Run pman init or any pman command inside a project, or pman projects add PATH.`);return;}for(const x of all)console.log(`${(x.key??'').padEnd(8)}  ${x.name.padEnd(28)}  ${x.available?'':'[missing] '}${x.root}`);return;}
    if(action==='add'){const e=await addProjectPath(positional[0]??'.');out(`Registered ${e.name} (${e.key}) at ${e.root}`);return;}
    if(action==='remove'){if(!positional[0])throw new Error('Usage: pman projects remove ID|KEY|PATH');const e=await removeProject(positional[0]);out(`Removed ${e.name} (${e.key}) from the registry; no files were changed.`);return;}
    if(action==='prune'){const gone=await pruneProjects();out(gone.length?`Removed ${gone.length} missing project(s) from the registry.`:'Nothing to prune.');return;}
    throw new Error(`Unknown projects command: ${action}`);}
  const project=await openProject();globalThis.__pmanKey=project.key;await autoRegister(project);
  if(command==='ticket'&&sub==='create') {const {opts}=parse(rest);const t=await project.tickets.create({title:opts.title,description:opts.description,status:opts.status,kind:opts.kind,priority:opts.priority,labels:labels(opts.labels),parentId:opts.parent??null});out(t,opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='list') {const {opts}=parse(rest);out(await project.tickets.list({status:opts.status,parentId:opts.parent,limit:Number(opts.limit??5000)}),opts.format);return;}
  if(command==='ticket'&&sub==='show') {const {opts,positional}=parse(rest);out(await project.tickets.get(positional[0]),opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='update') {const {opts,positional}=parse(rest),patch={};for(const k of ['title','status','description','priority','kind'])if(opts[k]!==undefined)patch[k]=opts[k];if(opts.labels!==undefined)patch.labels=labels(opts.labels);out(await project.tickets.update(positional[0],patch,{force:!!opts.force}),opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='move') {const {opts,positional}=parse(rest);out(await project.tickets.move(positional[0],opts.parent??null),opts.format,'ticket');return;}
  if(command==='tree') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.tree(positional[0]??null,{maxDepth:opts.max_depth===undefined?Infinity:Number(opts.max_depth),limit:Number(opts.limit??5000),offset:Number(opts.offset??0)}),opts.format);return;}
  if(['goal','plan','decision'].includes(command)&&sub==='create') {const {opts}=parse(rest);const kind={goal:'goals',plan:'plans',decision:'decisions'}[command];out(await project.documents.create(kind,{title:opts.title,body:opts.body??'',links:opts.links?opts.links.split(',').filter(Boolean):[]}),opts.format);return;}
  if(['goal','plan','decision'].includes(command)&&['list','show','update'].includes(sub)) {const {opts,positional}=parse(rest);const kind={goal:'goals',plan:'plans',decision:'decisions'}[command];
    if(sub==='list'){const all=await project.documents.list(kind,{body:false});if(opts.format==='json'){out(all,'json');return;}if(!all.length)console.log('No documents.');for(const d of all)console.log(`${d.id}  ${d.status}  ${d.title}`);return;}
    if(sub==='show'){const r=await project.documents.getVersioned(kind,positional[0]);if(opts.format==='json'){out({...r.document,revision:r.revision},'json');return;}console.log(`${command} ${r.document.id}  ${r.document.status}  ${r.document.title}\nlinks: ${(r.document.links??[]).join(', ')||'none'}\n\n${r.document.body??''}`);return;}
    const patch={};for(const k of ['title','status','body'])if(opts[k]!==undefined)patch[k]=opts[k];if(opts.links!==undefined)patch.links=labels(opts.links);const r=await project.documents.update(kind,positional[0],patch);out(opts.format==='json'?{...r.document,revision:r.revision,changed:r.changed}:(r.changed?`Updated ${command} ${r.document.id}`:'No changes.'),opts.format);return;}
  if(command==='comment'&&sub==='add') {const {positional}=parse(rest);out(await project.comments.add(positional[0],{body:positional.slice(1).join(' ')}));return;}
  if(command==='relation'&&sub==='add') {const {positional}=parse(rest);out(await project.relations.add(...positional));return;}
  if(command==='relation'&&sub==='list') {const {positional,opts}=parse(rest);out(await project.relations.list(positional[0]),opts.format);return;}
  if(command==='relation'&&sub==='remove') {const {positional}=parse(rest);let id=positional[0];if(positional.length===3){const match=(await project.relations.list(positional[0])).find(r=>r.sourceId===positional[0]&&r.targetId===positional[1]&&r.type===positional[2]);if(!match)throw new NotFoundError('No matching relationship');id=match.id;}await project.relations.remove(id);out(`Removed relationship ${id}`);return;}
  if(command==='next') {const {opts}=parse([sub,...rest].filter(Boolean));const rows=await project.next({limit:Number(opts.limit??5),parentId:opts.parent});if(opts.format==='json'){out(rows,'json');return;}if(!rows.length){console.log('No ready tickets.');return;}rows.forEach((r,i)=>console.log(`${i+1}. [${r.effectivePriority}] ${r.key?r.key+' ':''}${r.title}\n   ${r.id}  ${r.kind}${r.path.length?'  in: '+r.path.join(' > '):''}\n   ${r.reasons.join('; ')}`));return;}
  if(command==='claim') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const t=await project.claim(positional[0],{agent:opts.agent??process.env.PMAN_AGENT,leaseMinutes:opts.lease===undefined?undefined:Number(opts.lease),force:!!opts.force});out(opts.format==='json'?t:`Claimed ${t.id} for ${t.assignee.agent} until ${t.assignee.expiresAt}`,opts.format);return;}
  if(command==='release') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const t=await project.release(positional[0],{agent:opts.agent??process.env.PMAN_AGENT,force:!!opts.force});out(opts.format==='json'?t:`Released ${t.id}`,opts.format);return;}
  if(command==='done') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const r=await project.finish(positional[0],{note:opts.note,agent:opts.agent??process.env.PMAN_AGENT,force:!!opts.force});if(opts.format==='json'){out(r,'json');return;}console.log(`Done ${r.ticket.id}  ${r.ticket.title}`);if(r.unblocked.length){console.log('Now ready:');for(const x of r.unblocked)console.log(`  ${x.id}  ${x.title}`);}return;}
  if(command==='agent'&&sub==='init') {const {opts}=parse(rest);const r=await agentInit(project,{file:opts.file??'AGENTS.md',write:!!opts.write});console.log(r.write?`Updated ${r.file}`:`Preview for ${r.file} (run again with --write to apply):\n\n${r.section}`);return;}
  if(command==='component'&&sub==='add') {const {opts}=parse(rest);const c=await project.components.create({kind:opts.kind,name:opts.name,parentId:opts.parent,description:opts.description});out(opts.format==='json'?c:`component ${c.id}  ${c.kind} ${await qname(project,c.id)}`,opts.format);return;}
  if(command==='component'&&sub==='list') {const {opts}=parse(rest);const all=await project.components.list(),q=qualifiedNames(all),ks=new Map((await project.contracts.list()).map(k=>[k.componentId,k]));const rows=all.map(c=>({...c,qualifiedName:q.get(c.id),contractVersion:ks.get(c.id)?.version??null})).sort((a,b)=>a.qualifiedName.localeCompare(b.qualifiedName));if(opts.format==='json'){out(rows,'json');return;}if(!rows.length)console.log('No components.');for(const r of rows)console.log(`${r.id}  ${r.kind.padEnd(12)}  ${r.qualifiedName}${r.contractVersion?`  (contract v${r.contractVersion})`:''}`);return;}
  if(command==='component'&&sub==='show') {const {opts,positional}=parse(rest);const c=await project.components.resolve(positional[0]);const k=(await project.contracts.list()).find(x=>x.componentId===c.id)??null;out({...c,qualifiedName:await qname(project,c.id),contract:k},'json');return;}
  if(command==='type'&&sub==='set') {const {opts,positional}=parse(rest);const r=await project.types.set(positional[0],json(opts.schema,'--schema'),{description:opts.description,dryRun:!!opts['dry-run']});if(opts.format==='json')out(r,'json');else impactText(`type ${r.name} v${r.version}`,r.impact,!!opts['dry-run'],await qualifiedMap(project));return;}
  if(command==='type'&&sub==='list') {const {opts}=parse(rest);const all=await project.types.list();if(opts.format==='json'){out(all,'json');return;}if(!all.length)console.log('No types.');for(const x of all)console.log(`${x.name}  ${JSON.stringify(x.schema)}`);return;}
  if(command==='contract'&&sub==='set') {const {opts,positional}=parse(rest);const k=await project.contracts.set(positional[0],{input:opts.input===undefined?undefined:json(opts.input,'--input'),output:opts.output===undefined?undefined:json(opts.output,'--output'),description:opts.description});if(opts.format==='json')out(k,'json');else impactText(`contract ${await qname(project,k.componentId)} v${k.version}`,k.impact,!!opts['dry-run'],await qualifiedMap(project));return;}
  if(command==='contract'&&sub==='history') {const {opts,positional}=parse(rest);const k=await project.contracts.get(positional[0]);const rows=[...(k.history??[]),{version:k.version,input:k.input,output:k.output,updatedAt:k.updatedAt}];if(opts.format==='json'){out(rows,'json');return;}for(const r of rows)console.log(`v${r.version}  ${r.updatedAt}\n  input:  ${JSON.stringify(r.input)}\n  output: ${JSON.stringify(r.output)}`);return;}
  if(command==='contract'&&sub==='show') {const {positional}=parse(rest);out(await project.contracts.get(positional[0]),'json');return;}
  if(command==='codeplan'&&sub==='add') {const {opts,positional}=parse(rest);const t=await project.codePlan.add(positional[0],positional[1],positional[2],{requires:labels(opts.requires),provides:labels(opts.provides)});out(opts.format==='json'?t.codePlan:`codeplan ${t.id} ${positional[1]} ${positional[2]}`,opts.format);return;}
  if(command==='codeplan'&&sub==='remove') {const {positional}=parse(rest);await project.codePlan.remove(positional[0],positional[1],positional[2]);out(`Removed ${positional[1]} ${positional[2]} from ${positional[0]}`);return;}
  if(command==='codeplan'&&sub==='show') {const {positional}=parse(rest);out((await project.context(positional[0],{budget:1e9})).codePlan??{},'json');return;}
  if(command==='check') {const {opts}=parse([sub,...rest].filter(Boolean));const r=await project.check();if(opts.format==='json')out(r,'json');else{for(const e of r.errors)console.log(`✗ ${e.code}  ${e.message}`);for(const w of r.warnings)console.log(`! ${w.code}  ${w.message}`);console.log(r.valid?`Design is consistent (${r.warnings.length} warning(s)).`:`Design has ${r.errors.length} error(s) and ${r.warnings.length} warning(s).`);}if(!r.valid)process.exitCode=1;return;}
  if(command==='keys'&&['init','renumber'].includes(sub)) {const {opts}=parse(rest);const r=sub==='init'?await project.keys.init({key:opts.key}):await project.keys.renumber();if(opts.format==='json'){out(r,'json');return;}if(sub==='init')console.log(`Project key ${r.key}; numbered ${r.assigned} of ${r.total} tickets.`);else{for(const c of r.changed)console.log(`${c.from} -> ${c.to}  ${c.id}`);console.log(r.changed.length?`Renumbered ${r.changed.length} ticket(s).`:'No duplicate keys.');}return;}
  if(command==='search') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const page=await project.searchPage(positional.join(' '),{offset:Number(opts.offset??0),limit:Number(opts.limit??20),types:labels(opts.type)});if(opts.format==='json'){out(page,'json');return;}if(!page.items.length){console.log('No results.');return;}for(const h of page.items)console.log(`${(h.key??h.id).padEnd(10)}  ${h.type.padEnd(8)}  ${h.title}`);console.log(`${page.offset+1}-${page.offset+page.items.length} of ${page.total}${page.nextOffset!==null?`; next: --offset ${page.nextOffset}`:''}`);return;}
  if(command==='context') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.context(positional[0],{budget:Number(opts.budget??8000)}),opts.format);return;}
  if(command==='validate') {const {opts}=parse([sub,...rest].filter(Boolean));const result=await project.validate();out(result,opts.format);if(!result.valid)process.exitCode=1;return;}
  throw new Error(`Unknown command: ${command}\n\n${usage}`);
}
try { await main(process.argv.slice(2)); }
catch(error){console.error(JSON.stringify({error:error.message,code:error.code??'USAGE_ERROR',details:error.details??{}},null,2));process.exitCode=error instanceof PmanError?1:2;}
