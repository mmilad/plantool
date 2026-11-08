#!/usr/bin/env node
import { initProject, openProject, HeistError, NotFoundError } from '../src/index.js';
import { onboardText } from '../src/onboard.js';
import { registerProject, addProjectPath, removeProject, listProjects, pruneProjects, registryHome } from '../src/registry.js';
const autoRegister=async p=>{if(process.env.HEIST_NO_REGISTER==='1')return;try{await registerProject(p);}catch{}};
import { qualifiedNames } from '../src/design.js';
const qname=async(p,id)=>qualifiedNames(await p.components.list()).get(id);
const qualifiedMap=async p=>qualifiedNames(await p.components.list());
function impactText(head,impact,dryRun,names){console.log(`${dryRun?'[dry run] ':''}${head}`);for(const c of impact.changes)console.log(`  ${c.breaking?'✗ breaking':'· compatible'}  ${c.componentId?names.get(c.componentId)+' ':''}${c.side}.${c.path||'(root)'} ${c.change}${c.from?` (${c.from} → ${c.to})`:''}`);if(impact.affectedConsumers.length){console.log('  Affected open consumer tickets:');for(const a of impact.affectedConsumers)console.log(`    ${a.ticketId}  ${a.title}\n      ${a.reasons.join('; ')}`);}}
const json=(v,flag)=>{if(v===undefined)throw new Error(`Missing ${flag}`);try{return JSON.parse(v);}catch(e){if(/^\s*[{[]/.test(v))throw new Error(`${flag} is not valid JSON: ${e.message}`);return v;}};
const labels=v=>v===undefined?undefined:[].concat(v).flatMap(x=>String(x).split(',')).map(x=>x.trim()).filter(Boolean);
// Sentences may contain commas: lists of sentences are separated with ';' or by repeating the flag.
const items=v=>v===undefined?undefined:[].concat(v).flatMap(x=>String(x).split(';')).map(x=>x.trim()).filter(Boolean);
const one=v=>Array.isArray(v)?v.at(-1):v;
/** Standard metadata flags shared by ticket create/update. */
function fieldFlags(opts){const f={};if(opts.why!==undefined)f.why=one(opts.why);if(opts.accept!==undefined)f.acceptance=items(opts.accept).map(text=>({text,met:false}));if(opts.files!==undefined&&opts.files!==true)f.files=labels(opts.files);if(opts.size!==undefined)f.size=one(opts.size);if(opts.assume!==undefined)f.assumptions=items(opts.assume);if(opts.refs!==undefined)f.refs=labels(opts.refs);if(opts.risks!==undefined)f.risks=items(opts.risks);if(opts.evaluation)f.evaluation=true;if(opts['no-evaluation'])f.evaluation=false;
  if(opts.steps!==undefined||opts.expected!==undefined||opts.actual!==undefined||opts.environment!==undefined)f.repro={...(opts.steps!==undefined?{steps:items(opts.steps)}:{}),...(opts.expected!==undefined?{expected:one(opts.expected)}:{}),...(opts.actual!==undefined?{actual:one(opts.actual)}:{}),...(opts.environment!==undefined?{environment:one(opts.environment)}:{})};
  return f;}
/** --set name=value for custom fields from .heist/config.json (stored under properties). */
function customFlags(project,kind,opts,current={}){const sets=[].concat(opts.set??[]);if(!sets.length)return undefined;const defs=new Map(project.fields(kind).filter(d=>d.custom).map(d=>[d.name,d]));const props={...current};for(const s of sets){const i=String(s).indexOf('=');if(i<1)throw new Error('Use --set name=value');const name=s.slice(0,i),raw=s.slice(i+1),d=defs.get(name);if(!d)throw new Error(`Unknown custom field "${name}" for ${kind}; see heist fields ${kind}`);props[name]=raw===''?undefined:d.type==='number'?Number(raw):d.type==='bool'?raw==='true':d.type==='list'?items(raw):raw;}return props;}
const gitFiles=(cwd,commit)=>{try{const run=a=>execFileSync('git',a,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']});if(commit)return run(['show','--name-only','--format=',commit]).split('\n').filter(Boolean);return [...new Set(run(['status','--porcelain']).split('\n').filter(Boolean).map(l=>l.slice(3).split(' -> ').at(-1)))];}catch{return [];}};
import { serve } from '../src/server.js';
import { execFileSync } from 'node:child_process';
import { guide, GUIDE } from '../src/guide.js';

const usage = `heist — Git-native planning and issue tracking

Usage:
  heist init [--name NAME] [--key KEY]
  heist projects [list|add PATH|remove ID|KEY|PATH|prune] [--format json]
  heist keys init [--key KEY]        set the project key and number existing tickets
  heist keys renumber                fix duplicate KEY-n numbers (e.g. after merging branches)
  heist ticket create --title TITLE [--parent ID] [--description TEXT] [--status STATUS]
                     [--kind task|feature|bug] [--priority low|normal|high|urgent] [--labels A,B]
  heist ticket list [--status STATUS] [--parent ID] [--format json]
  heist ticket show ID [--format json]
  heist ticket update ID [--title TITLE] [--status STATUS] [--description TEXT]
                     [--kind KIND] [--priority PRIORITY] [--labels A,B] [--force]
  heist ticket move ID [--parent ID]
  heist tree [ID] [--max-depth N] [--limit N] [--offset N] [--format json]
  heist goal|plan|decision create --title TITLE [--body TEXT] [--links ID,ID]
  heist goal|plan|decision list [--format json]
  heist goal|plan|decision show ID [--format json]
  heist goal|plan|decision update ID [--title T] [--status S] [--body TEXT] [--links ID,ID]
  heist comment add TICKET_ID TEXT
  heist relation add SOURCE_ID TARGET_ID TYPE
  heist relation list [ID]
  heist relation remove RELATION_ID | SOURCE_ID TARGET_ID TYPE

Agent workflow (agent name defaults to $HEIST_AGENT):
  heist next [--limit N] [--parent ID] [--format json]
  heist claim ID [--agent NAME] [--lease MINUTES] [--force]
  heist release ID [--agent NAME] [--force]
  heist done ID [--note TEXT] [--agent NAME] [--force]
  heist agent onboard                              a briefing on heist for agents (prints only)

Code plans (components, types and contracts are maintained centrally):
  heist component add --kind KIND --name NAME [--parent COMPONENT] [--description TEXT]
  heist component list [--format json]
  heist component show COMPONENT [--format json]
  heist type set NAME --schema JSON [--description TEXT] [--dry-run]
  heist type list [--format json]
  heist contract set COMPONENT [--input JSON] [--output JSON] [--description TEXT] [--dry-run]
  heist contract history COMPONENT [--format json]
  heist contract show COMPONENT [--format json]
  heist codeplan add TICKET_ID implements|consumes|changes COMPONENT [--requires a,b.c:type] [--provides x,y] [--stage mock|full] [--needs mock|full]
  heist codeplan remove TICKET_ID implements|consumes|changes COMPONENT
  heist codeplan show TICKET_ID
  heist check [--format json]

Decisions (questions with options; options can have their own plan):
  heist ask QUESTION [--parent ID] [--options "A;B"] [--criteria "Speed:3,Cost:1"] [--blocks ID,ID]
           [--owner human|agent] [--reversible|--irreversible] [--decide-by DATE] [--why TEXT]
  heist option add DECISION --title T [--pros "a;b"] [--cons "a;b"] [--risks "a;b"] [--size m] [--why TEXT]
  heist option score OPTION criterion=0..5 ...
  heist criteria DECISION "Speed:3, Cost:1"
  heist decide DECISION               show options, scores, effort and the suggestion
  heist recommend DECISION OPTION --why TEXT
  heist decide DECISION OPTION --why TEXT   |   heist decide DECISION --reopen
  heist decisions [--all]             open decisions; '?' = a person has to decide

Metadata (heist fields [KIND] lists what each kind supports):
  ticket create/update also take --why TEXT --accept "a;b" --files a,b --size xs|s|m|l|xl --assume "a;b"
     --refs a,b --risks "a;b" --evaluation --steps "a;b" --expected T --actual T --environment T --set name=value
  heist ticket update ID --add-accept "c"     heist ticket check ID N [--unmet]
  heist which PATH                    tickets that plan or changed a file/folder
  heist done ID --note T [--verified T] [--files | --commit SHA | --changed a,b]   records the outcome

Start and method:
  heist new "What you want to build" [--why TEXT]   top ticket + product checklist (goal, platform, stack, ...)
  heist guide [decisions|blueprints|metadata|workflow|contracts]   the planning method for agents

Blueprints (checklists that expand a ticket into everything it really needs):
  heist blueprint list [--format json]
  heist blueprint show NAME [--format json]
  heist blueprint suggest TICKET                     blueprints that fit the ticket
  heist blueprint apply TICKET NAME [--only a,b] [--optional] [--dry-run]
                                                    create child tickets for the blueprint items
  heist blueprint status TICKET [--format json]      which items are planned, done, skipped or missing
  heist blueprint skip TICKET ITEM --reason TEXT     record that an item does not apply
  heist blueprint unskip TICKET ITEM
  heist blueprint check [--format json]              missing items and tickets that look like a blueprint
  heist blueprint init NAME [--from BUILTIN]         copy a blueprint into .heist/blueprints/ to customise it

COMPONENT is a qualified name (UserService.getUser), a unique short name or an ID.
Schemas: full JSON Schema subset or shorthand, e.g. '{"userId":"string","nick":"string?","tags":"string[]","owner":"User"}'.

  heist search QUERY [--mode keyword|semantic|hybrid] [--type ticket,comment,goal,plan,decision] [--limit N] [--offset N] [--format json]
  heist similar TICKET [--limit N] [--strength 1.5] [--format json]   tickets that look alike (needs the semantic index)
  heist index [status|update|rebuild] [--format json]              local semantic index in ~/.heist/cache (optional)
  heist context ID [--budget BYTES] [--format json]
  heist validate [--format json]
  heist serve [--port N] [--open]   all registered projects, from any directory (default: 127.0.0.1:4000)

All commands operate on the nearest project-local .heist/ directory. Ticket IDs can be given as UUIDs or keys such as PM-42.`;

function parse(args) {
  const opts={}, positional=[];
  for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);if(['open','force','write','dry-run','optional','evaluation','no-evaluation','files','all','reopen','reversible','irreversible','unmet'].includes(k)&&(k!=='files'||i+1>=args.length||args[i+1].startsWith('--'))){opts[k]=true;continue;}if(i+1>=args.length)throw new Error(`Missing value for ${a}`);const key=k.replaceAll('-','_'),v=args[++i];opts[key]=opts[key]===undefined?v:[].concat(opts[key],v);}else positional.push(a);}
  return {opts,positional};
}
const out=(value,format='text',kind)=>{
  if(format==='json'){console.log(JSON.stringify(value,null,2));return;}
  if(typeof value==='string'){console.log(value);return;}
  if(Array.isArray(value)&&value.every(x=>x&&typeof x==='object'&&'id'in x&&'title'in x)){
    for(const x of value)console.log(`${(x.key??(Number.isInteger(x.number)&&globalThis.__heistKey?`${globalThis.__heistKey}-${x.number}`:x.id.slice(0,8))).padEnd(10)}  ${String(x.status??x.rollup??'').padEnd(11)}  ${'depth'in x?'  '.repeat(x.depth):''}${x.title}`);
    if(!value.length)console.log('No matching items.');return;
  }
  if(value&&typeof value==='object'&&'id'in value)console.log(`${kind??value.type??value.kind??'record'} ${Number.isInteger(value.number)&&globalThis.__heistKey?`${globalThis.__heistKey}-${value.number} `:''}${value.id}  ${value.title??''}`.trim());
  else if(value&&typeof value==='object'&&'valid'in value){for(const e of value.errors??[])console.log(`✗ ${e}`);for(const w of value.warnings??[])console.log(`! ${w}`);console.log(value.valid?'Project is valid.':`Project has ${value.errors.length} validation error(s).`);}
  else console.log(JSON.stringify(value,null,2));
};
async function main(argv) {
  if(argv.includes('--help')||argv[0]==='help'||!argv.length){console.log(usage);return;}
  const [command,sub,...rest]=argv;
  if(command==='init'){const {opts}=parse([sub,...rest].filter(Boolean));const c=await initProject({name:opts.name,key:opts.key});await autoRegister(await openProject());out(`Initialized ${c.name} (${c.key}) at .heist/`);return;}
  if(command==='serve'){const {opts}=parse([sub,...rest].filter(Boolean));const s=await serve({port:opts.port===undefined?4000:Number(opts.port),open:!!opts.open,register:process.env.HEIST_NO_REGISTER!=='1'});const n=(await listProjects()).length;console.log(`heist is serving ${n} registered project${n===1?'':'s'}${s.project?` (opened in ${s.project.config.name})`:''} at ${s.url}`);console.log('Press Ctrl-C to stop.');await new Promise(resolve=>s.server.once('close',resolve));return;}
  if(command==='projects'){const parsed=parse([sub,...rest].filter(x=>x!==undefined));const opts=parsed.opts;const action=parsed.positional[0]??'list';const positional=parsed.positional.slice(1);
    if(action==='list'){const all=await listProjects();if(opts.format==='json'){out(all,'json');return;}if(!all.length){console.log(`No projects registered yet (${registryHome()}). Run heist init or any heist command inside a project, or heist projects add PATH.`);return;}for(const x of all)console.log(`${(x.key??'').padEnd(8)}  ${x.name.padEnd(28)}  ${x.available?'':'[missing] '}${x.root}`);return;}
    if(action==='add'){const e=await addProjectPath(positional[0]??'.');out(`Registered ${e.name} (${e.key}) at ${e.root}`);return;}
    if(action==='remove'){if(!positional[0])throw new Error('Usage: heist projects remove ID|KEY|PATH');const e=await removeProject(positional[0]);out(`Removed ${e.name} (${e.key}) from the registry; no files were changed.`);return;}
    if(action==='prune'){const gone=await pruneProjects();out(gone.length?`Removed ${gone.length} missing project(s) from the registry.`:'Nothing to prune.');return;}
    throw new Error(`Unknown projects command: ${action}`);}
  if(command==='guide'){const text=guide(sub);if(!text)throw new Error(`Unknown guide topic: ${sub}. Topics: ${Object.keys(GUIDE).join(', ')}`);console.log(text);return;}
  const project=await openProject();globalThis.__heistKey=project.key;await autoRegister(project);
  if(command==='ticket'&&sub==='create') {const {opts}=parse(rest);const kind=one(opts.kind)??'task';const props=customFlags(project,kind,opts);const t=await project.tickets.create({title:one(opts.title),description:one(opts.description),status:opts.status,kind,priority:opts.priority,labels:labels(opts.labels),parentId:opts.parent??null,createdBy:process.env.HEIST_AGENT||undefined,...fieldFlags(opts),...(props?{properties:props}:{})});
    const norm = x => String(x ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    const twins = (await project.tickets.list({ limit: Infinity })).filter(x => x.id !== t.id && norm(x.title) === norm(t.title));
    if (twins.length && opts.format !== 'json') console.error(`Note: ${twins.length} ticket(s) with the same title already exist: ${twins.map(x => project.ticketKey(x) ?? x.id).join(', ')}. If it is the same work, link it instead (heist relation add ${project.ticketKey(t) ?? t.id} ${project.ticketKey(twins[0]) ?? twins[0].id} duplicates).`);
    out(t,opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='list') {const {opts}=parse(rest);out(await project.tickets.list({status:opts.status,parentId:opts.parent,limit:Number(opts.limit??5000)}),opts.format);return;}
  if(command==='ticket'&&sub==='show') {const {opts,positional}=parse(rest);out(await project.tickets.get(positional[0]),opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='update') {const {opts,positional}=parse(rest),patch={};for(const k of ['title','status','description','priority','kind'])if(opts[k]!==undefined)patch[k]=one(opts[k]);if(opts.labels!==undefined)patch.labels=labels(opts.labels);Object.assign(patch,fieldFlags(opts));if(opts.set!==undefined){const cur=await project.tickets.get(positional[0]);patch.properties=customFlags(project,patch.kind??cur.kind??'task',opts,cur.properties??{});}if(opts.add_accept!==undefined){const cur=await project.tickets.get(positional[0]);patch.acceptance=[...(cur.acceptance??[]),...items(opts.add_accept).map(text=>({text,met:false}))];}out(await project.tickets.update(positional[0],patch,{force:!!opts.force}),opts.format,'ticket');return;}
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
  if(command==='next') {const {opts}=parse([sub,...rest].filter(Boolean));const rows=await project.next({limit:Number(opts.limit??5),parentId:opts.parent});if(opts.format==='json'){out(rows,'json');return;}const human=(await project.decisions.list()).filter(d=>d.owner==='human'&&d.status==='open');if(!rows.length)console.log('No ready tickets.');rows.forEach((r,i)=>console.log(`${i+1}. [${r.effectivePriority}] ${r.key?r.key+' ':''}${r.title}\n   ${r.id}  ${r.kind}${r.path.length?'  in: '+r.path.join(' > '):''}\n   ${r.reasons.join('; ')}`));if(human.length)console.log(`\n${human.length} decision(s) need a person: ${human.slice(0,3).map(d=>(d.key??d.id)+' '+d.question).join('; ')}${human.length>3?' …':''} (heist decisions)`);return;}
  if(command==='claim') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const t=await project.claim(positional[0],{agent:opts.agent??process.env.HEIST_AGENT,leaseMinutes:opts.lease===undefined?undefined:Number(opts.lease),force:!!opts.force});out(opts.format==='json'?t:`Claimed ${t.id} for ${t.assignee.agent} until ${t.assignee.expiresAt}`,opts.format);return;}
  if(command==='release') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const t=await project.release(positional[0],{agent:opts.agent??process.env.HEIST_AGENT,force:!!opts.force});out(opts.format==='json'?t:`Released ${t.id}`,opts.format);return;}
  if(command==='done') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const changed=opts.changed!==undefined?labels(opts.changed):opts.files||opts.commit?gitFiles(project.root,one(opts.commit)):undefined;const outcome=(opts.note||opts.verified||changed||opts.commit)?{...(opts.note?{summary:one(opts.note)}:{}),...(opts.verified?{verifiedBy:one(opts.verified)}:{}),...(changed?.length?{changedFiles:changed}:{}),...(opts.commit?{commits:labels(opts.commit)}:{})}:undefined;const r=await project.finish(positional[0],{note:one(opts.note),agent:opts.agent??process.env.HEIST_AGENT,force:!!opts.force,outcome});if(opts.format==='json'){out(r,'json');return;}console.log(`Done ${r.ticket.id}  ${r.ticket.title}`);if(r.unblocked.length){console.log('Now ready:');for(const x of r.unblocked)console.log(`  ${x.id}  ${x.title}`);}return;}
  if(command==='agent'&&sub==='onboard'){console.log(onboardText());return;}
  if(command==='component'&&sub==='add') {const {opts}=parse(rest);const c=await project.components.create({kind:opts.kind,name:opts.name,parentId:opts.parent,description:opts.description});out(opts.format==='json'?c:`component ${c.id}  ${c.kind} ${await qname(project,c.id)}`,opts.format);return;}
  if(command==='component'&&sub==='list') {const {opts}=parse(rest);const all=await project.components.list(),q=qualifiedNames(all),ks=new Map((await project.contracts.list()).map(k=>[k.componentId,k]));const rows=all.map(c=>({...c,qualifiedName:q.get(c.id),contractVersion:ks.get(c.id)?.version??null})).sort((a,b)=>a.qualifiedName.localeCompare(b.qualifiedName));if(opts.format==='json'){out(rows,'json');return;}if(!rows.length)console.log('No components.');for(const r of rows)console.log(`${r.id}  ${r.kind.padEnd(12)}  ${r.qualifiedName}${r.contractVersion?`  (contract v${r.contractVersion})`:''}`);return;}
  if(command==='component'&&sub==='show') {const {opts,positional}=parse(rest);const c=await project.components.resolve(positional[0]);const k=(await project.contracts.list()).find(x=>x.componentId===c.id)??null;out({...c,qualifiedName:await qname(project,c.id),contract:k},'json');return;}
  if(command==='type'&&sub==='set') {const {opts,positional}=parse(rest);const r=await project.types.set(positional[0],json(opts.schema,'--schema'),{description:opts.description,dryRun:!!opts['dry-run']});if(opts.format==='json')out(r,'json');else impactText(`type ${r.name} v${r.version}`,r.impact,!!opts['dry-run'],await qualifiedMap(project));return;}
  if(command==='type'&&sub==='list') {const {opts}=parse(rest);const all=await project.types.list();if(opts.format==='json'){out(all,'json');return;}if(!all.length)console.log('No types.');for(const x of all)console.log(`${x.name}  ${JSON.stringify(x.schema)}`);return;}
  if(command==='contract'&&sub==='set') {const {opts,positional}=parse(rest);const k=await project.contracts.set(positional[0],{input:opts.input===undefined?undefined:json(opts.input,'--input'),output:opts.output===undefined?undefined:json(opts.output,'--output'),description:opts.description});if(opts.format==='json')out(k,'json');else impactText(`contract ${await qname(project,k.componentId)} v${k.version}`,k.impact,!!opts['dry-run'],await qualifiedMap(project));return;}
  if(command==='contract'&&sub==='history') {const {opts,positional}=parse(rest);const k=await project.contracts.get(positional[0]);const rows=[...(k.history??[]),{version:k.version,input:k.input,output:k.output,updatedAt:k.updatedAt}];if(opts.format==='json'){out(rows,'json');return;}for(const r of rows)console.log(`v${r.version}  ${r.updatedAt}\n  input:  ${JSON.stringify(r.input)}\n  output: ${JSON.stringify(r.output)}`);return;}
  if(command==='contract'&&sub==='show') {const {positional}=parse(rest);out(await project.contracts.get(positional[0]),'json');return;}
  if(command==='codeplan'&&sub==='add') {const {opts,positional}=parse(rest);const t=await project.codePlan.add(positional[0],positional[1],positional[2],{requires:labels(opts.requires),provides:labels(opts.provides),stage:one(opts.stage),needs:one(opts.needs)});out(opts.format==='json'?t.codePlan:`codeplan ${t.id} ${positional[1]} ${positional[2]}`,opts.format);return;}
  if(command==='codeplan'&&sub==='remove') {const {positional}=parse(rest);await project.codePlan.remove(positional[0],positional[1],positional[2]);out(`Removed ${positional[1]} ${positional[2]} from ${positional[0]}`);return;}
  if(command==='codeplan'&&sub==='show') {const {positional}=parse(rest);out((await project.context(positional[0],{budget:1e9})).codePlan??{},'json');return;}
  if(command==='new') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const title=positional.join(' ').trim();if(!title)throw new Error('Usage: heist new "What you want to build" [--why TEXT] [--blueprint product]');const t=await project.tickets.create({title,kind:'feature',why:one(opts.why),description:one(opts.description),createdBy:process.env.HEIST_AGENT||undefined});const r=await project.blueprints.apply(t.id,one(opts.blueprint)??'product');if(opts.format==='json'){out({ticket:t,...r},'json');return;}console.log(`${project.ticketKey(t)??t.id}  ${title}`);for(const c of r.created)console.log(`  ${(c.key??c.id).padEnd(8)} ${c.title}`);if(r.coverage.undecided.length)console.log(`Optional, decide later: ${r.coverage.undecided.join(', ')} (heist blueprint status ${project.ticketKey(t)??t.id})`);console.log(`\nNext: fill in the goal, add options to the decisions, then show the person: heist decisions\nMethod: heist guide`);return;}
  if(command==='fields') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const kinds=positional.length?positional:['task','feature','bug','decision','option'];const rows=Object.fromEntries(kinds.map(k=>[k,project.fields(k)]));if(opts.format==='json'){out(rows,'json');return;}for(const k of kinds){console.log(`${k}:`);for(const f of rows[k])console.log(`  ${f.name.padEnd(13)} ${(f.type+(f.values?' ('+f.values.join('|')+')':'')).padEnd(22)} ${f.help??f.label}${f.custom?'  [project]':''}`);}return;}
  if(command==='which') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const q=positional[0];if(!q)throw new Error('Usage: heist which PATH');const norm=x=>String(x).replaceAll('\\','/').replace(/^\.\//,'').replace(/\/+$/,'');const target=norm(q);const hit=f=>{const x=norm(f);return x===target||target.startsWith(x+'/')||x.startsWith(target+'/');};const rows=(await project.tickets.list({limit:Infinity})).map(t=>({t,planned:(t.files??[]).filter(hit),changed:(t.outcome?.changedFiles??[]).filter(hit)})).filter(r=>r.planned.length||r.changed.length).map(({t,planned,changed})=>({id:t.id,key:project.ticketKey(t),title:t.title,status:t.status,planned,changed}));if(opts.format==='json'){out(rows,'json');return;}console.log(rows.length?rows.map(r=>`${r.key??r.id}  ${r.status.padEnd(11)} ${r.title}${r.planned.length?'  planned: '+r.planned.join(', '):''}${r.changed.length?'  changed: '+r.changed.join(', '):''}`).join('\n'):`No ticket mentions ${q}.`);return;}
  if(command==='ticket'&&sub==='check') {const {opts,positional}=parse(rest);const t=await project.tickets.get(positional[0]);const n=Number(positional[1]);const list=[...(t.acceptance??[])];if(!Number.isInteger(n)||n<1||n>list.length)throw new Error(`Usage: heist ticket check TICKET N [--unmet] (N from 1 to ${list.length})`);list[n-1]={...list[n-1],met:!opts.unmet};await project.tickets.update(t.id,{acceptance:list});console.log(list.map((a,i)=>`${a.met?'[x]':'[ ]'} ${i+1}. ${a.text}`).join('\n'));return;}
  if(command==='ask') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const q=[sub,...rest].length?positional.join(' '):'';const r=await project.decisions.ask(q,{parentId:opts.parent,options:items(opts.options)??[],criteria:one(opts.criteria),owner:opts.owner,reversible:opts.reversible?true:opts.irreversible?false:undefined,decideBy:one(opts.decide_by),why:one(opts.why),blocks:labels(opts.blocks)??[],priority:opts.priority,createdBy:process.env.HEIST_AGENT||undefined});if(opts.format==='json'){out(r,'json');return;}console.log(`decision ${project.ticketKey(r.decision)??r.decision.id}  ${r.decision.title}  (decided by ${r.decision.decision.owner})`);for(const o of r.options)console.log(`  option ${project.ticketKey(o)??o.id}  ${o.title}`);return;}
  if(command==='option'&&sub==='add') {const {opts,positional}=parse(rest);const o=await project.decisions.addOption(positional[0],{title:one(opts.title)??positional.slice(1).join(' '),why:one(opts.why),pros:items(opts.pros)??[],cons:items(opts.cons)??[],risks:items(opts.risks),size:one(opts.size),createdBy:process.env.HEIST_AGENT||undefined});out(opts.format==='json'?o:`option ${project.ticketKey(o)??o.id}  ${o.title}`,opts.format);return;}
  if(command==='option'&&sub==='score') {const {opts,positional}=parse(rest);const scores={};for(const s of positional.slice(1)){const i=s.lastIndexOf('=');if(i<1)throw new Error('Use criterion=score, e.g. performance=4');scores[s.slice(0,i)]=s.slice(i+1);}const o=await project.decisions.score(positional[0],scores);out(opts.format==='json'?o:`Scored ${o.title}: ${Object.entries(o.option.scores).map(([k,v])=>k+'='+v).join(', ')}`,opts.format);return;}
  if(command==='criteria') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const d=await project.decisions.setCriteria(positional[0],positional.slice(1).join(' '));out(opts.format==='json'?d:`Criteria: ${d.decision.criteria.map(c=>c.name+' ×'+c.weight).join(', ')}`,opts.format);return;}
  if(command==='recommend'||command==='decide') {const {opts,positional}=parse([sub,...rest].filter(Boolean));let e;
    if(command==='recommend'&&positional[1])e=await project.decisions.recommend(positional[0],positional[1],{why:one(opts.why),by:process.env.HEIST_AGENT||opts.by});
    else if(command==='decide'&&opts.reopen)e=await project.decisions.reopen(positional[0],{by:one(opts.by)??process.env.HEIST_AGENT});
    else if(command==='decide'&&positional[1]){e=await project.decisions.decide(positional[0],positional[1],{why:one(opts.why),by:one(opts.by)??process.env.HEIST_AGENT});}
    else e=await project.decisions.evaluate(positional[0]);
    if(opts.format==='json'){out(e,'json');return;}
    console.log(`${e.key??e.id}  ${e.question}\n  ${e.status}; ${e.owner==='human'?'a person decides':'an agent may decide'}${e.reversible===true?', reversible':e.reversible===false?', hard to reverse':''}${e.decideBy?', decide by '+e.decideBy:''}`);if(e.why)console.log(`  why: ${e.why}`);
    if(e.criteria.length)console.log(`  criteria: ${e.criteria.map(c=>c.name+' ×'+c.weight).join(', ')}`);
    for(const o of e.options){console.log(`  ${o.chosen?'✓':o.status==='cancelled'?'×':'•'} ${(o.key??'').padEnd(8)} ${o.title}${o.score!==null?'  score '+Math.round(o.score*100)+'%':''}  effort ${o.effort}${o.planned?' ('+o.planned+' planned)':''}`);for(const x of o.pros)console.log(`        + ${x}`);for(const x of o.cons)console.log(`        - ${x}`);}
    if(e.suggested&&!e.chosen)console.log(`  suggested: ${e.suggested.title} (${e.suggested.reason})`);if(e.recommendation)console.log(`  recommended by ${e.recommendation.by}: ${e.options.find(o=>o.id===e.recommendation.option)?.title} — ${e.recommendation.why}`);if(e.chosen)console.log(`  chosen: ${e.options.find(o=>o.id===e.chosen)?.title} — ${e.rationale}`);
    if(e.activated?.length)console.log(`  now part of the plan: ${e.activated.map(t=>(t.key??t.id)+' '+t.title).join('; ')}`);return;}
  if(command==='decisions') {const {opts}=parse([sub,...rest].filter(Boolean));const rows=await project.decisions.list({all:!!opts.all});if(opts.format==='json'){out(rows,'json');return;}if(!rows.length){console.log('No open decisions.');return;}for(const r of rows)console.log(`${r.owner==='human'&&r.status==='open'?'? ':'  '}${(r.key??r.id).padEnd(8)} ${r.question}  [${r.status}, ${r.owner}${r.options?', '+r.options+' options':', no options yet'}${r.recommendation?', recommended: '+r.recommendation:r.suggested?', suggested: '+r.suggested:''}]`);return;}
  if(command==='blueprint') {const {opts,positional}=parse(rest);const fmt=opts.format;const icon={done:'✓',planned:'•',skipped:'–',cancelled:'×',open:'○'};
    const statusText=c=>{if(!c.blueprint)return 'No blueprint on this ticket. Try: heist blueprint suggest '+positional[0];const lines=[`Blueprint ${c.blueprint.name}${c.blueprint.title?' ('+c.blueprint.title+')':''}`];for(const i of c.items)lines.push(`  ${icon[i.state]} ${i.id.padEnd(18)} ${i.title}${i.optional?' (optional)':''}${i.ticket?'  → '+(i.ticket.key??i.ticket.id):''}${i.reason?'  — skipped: '+i.reason:''}`);if(c.missing.length)lines.push(`Missing: ${c.missing.join(', ')}`);if(c.undecided.length)lines.push(`Undecided optional items: ${c.undecided.join(', ')} (apply with --only, or skip with a reason)`);return lines.join('\n');};
    if(sub==='list'){const all=await project.blueprints.list();if(fmt==='json'){out(all,'json');return;}for(const b of all)console.log(`${b.name.padEnd(14)} ${String(b.items).padStart(2)} items  ${b.source==='project'?'[project] ':''}${b.description}${b.extends?' (extends '+b.extends+')':''}`);return;}
    if(sub==='show'){const b=await project.blueprints.get(positional[0]);if(fmt==='json'){out(b,'json');return;}console.log(`${b.name} — ${b.title??''}\n${b.description??''}\n`);for(const i of b.items)console.log(`  ${i.id.padEnd(18)} ${i.title}${i.optional?' (optional)':''}${i.from!==b.name?'  [from '+i.from+']':''}`);return;}
    if(sub==='suggest'){const s=await project.blueprints.suggest(positional[0]);if(fmt==='json'){out(s,'json');return;}console.log(s.length?s.map(x=>`${x.name}  (${x.title})`).join('\n'):'No blueprint matches this ticket. See heist blueprint list.');return;}
    if(sub==='apply'){const r=await project.blueprints.apply(positional[0],positional[1],{only:opts.only?labels(opts.only):undefined,includeOptional:!!opts.optional,dryRun:!!opts['dry-run']});if(fmt==='json'){out(r,'json');return;}if(opts['dry-run']){console.log(r.create.length?`Would create ${r.create.length} child ticket(s):\n`+r.create.map(c=>`  ${c.item.padEnd(18)} ${c.title}${c.optional?' (optional)':''}`).join('\n'):'Nothing to create; all chosen items are covered.');return;}console.log(r.created.length?`Created ${r.created.length} child ticket(s):\n`+r.created.map(c=>`  ${c.key??c.id}  ${c.title}`).join('\n'):'Nothing to create; all chosen items are covered.');if(r.coverage.undecided.length)console.log(`Undecided optional items: ${r.coverage.undecided.join(', ')}`);return;}
    if(sub==='status'){const c=await project.blueprints.coverage(positional[0]);if(fmt==='json'){out(c,'json');return;}console.log(statusText(c));return;}
    if(sub==='skip'||sub==='unskip'){const c=await project.blueprints.skip(positional[0],positional[1],sub==='unskip'?null:opts.reason);if(fmt==='json'){out(c,'json');return;}console.log(statusText(c));return;}
    if(sub==='check'){const w=await project.blueprints.check();if(fmt==='json'){out(w,'json');return;}console.log(w.length?w.map(x=>`! ${x.message}`).join('\n'):'All blueprint items are covered.');return;}
    if(sub==='init'){const r=await project.blueprints.init(positional[0],{from:opts.from});out(fmt==='json'?r:`Wrote ${r.file}; edit it to fit this project.`,fmt);return;}
    throw new Error('Usage: heist blueprint list|show|suggest|apply|status|skip|unskip|check|init');}
  if(command==='check') {const {opts}=parse([sub,...rest].filter(Boolean));const r=await project.check();if(opts.format==='json')out(r,'json');else{for(const e of r.errors)console.log(`✗ ${e.code}  ${e.message}`);for(const w of r.warnings)console.log(`! ${w.code}  ${w.message}`);console.log(r.valid?`Design is consistent (${r.warnings.length} warning(s)).`:`Design has ${r.errors.length} error(s) and ${r.warnings.length} warning(s).`);}if(!r.valid)process.exitCode=1;return;}
  if(command==='keys'&&['init','renumber'].includes(sub)) {const {opts}=parse(rest);const r=sub==='init'?await project.keys.init({key:opts.key}):await project.keys.renumber();if(opts.format==='json'){out(r,'json');return;}if(sub==='init')console.log(`Project key ${r.key}; numbered ${r.assigned} of ${r.total} tickets.`);else{for(const c of r.changed)console.log(`${c.from} -> ${c.to}  ${c.id}`);console.log(r.changed.length?`Renumbered ${r.changed.length} ticket(s).`:'No duplicate keys.');}return;}
  if(command==='index') {const {opts}=parse(rest);const action=sub&&!sub.startsWith('--')?sub:'status';if(action==='status'){const s=await project.semantic.status();if(opts.format==='json'){out(s,'json');return;}console.log(s.available?`Semantic index ready (${s.sources} sources, ${s.chunks} chunks, generation ${s.generation}${s.indexing?', updating':''}).`:`Semantic search unavailable: ${s.reason??s.error??s.status}`);return;}
    if(action==='update'||action==='rebuild'){let last=0;const r=await project.semantic[action==='rebuild'?'rebuild':'update']({onProgress:({done,total})=>{if(process.stderr.isTTY&&Date.now()-last>500){last=Date.now();process.stderr.write(`\rIndexing ${done}/${total} …`);}}});if(process.stderr.isTTY)process.stderr.write('\r');if(opts.format==='json'){out(r,'json');return;}console.log(`Index up to date: ${r.sources} sources, ${r.chunks} chunks (${r.changed} changed, ${r.embedded} texts embedded) with ${r.model}.`);return;}
    throw new Error(`Unknown index command: ${action}`);}
  if(command==='similar') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const rows=await project.semantic.similar(positional[0],{limit:Number(opts.limit??5),minScore:Number(opts.min??0),minStrength:Number(opts.strength??1.5)});if(opts.format==='json'){out(rows,'json');return;}if(!rows.length){console.log('No similar tickets above the threshold.');return;}for(const r of rows)console.log(`${r.score.toFixed(2)}  z ${r.strength.toFixed(1).padStart(4)}  ${(r.key??r.id).padEnd(10)} ${r.title}${r.likelyOverlap?'  ← likely overlap':''}${r.relation?`  [${r.relation}]`:''}`);return;}
  if(command==='search'&&['semantic','hybrid'].includes(parse([sub,...rest].filter(Boolean)).opts.mode)) {const {opts,positional}=parse([sub,...rest].filter(Boolean));const q=positional.join(' ');const types=labels(opts.type);const r=opts.mode==='semantic'?{mode:'semantic',...(await project.semantic.search(q,{types,limit:Number(opts.limit??20)}))}:await project.semantic.hybrid(q,{types});const hits=r.hits.slice(0,Number(opts.limit??20));if(opts.format==='json'){out({...r,hits},'json');return;}if(r.fallbackReason)console.log(`(keyword only: ${r.fallbackReason})`);if(!hits.length){console.log('No results.');return;}for(const h of hits){const t=h.type==='ticket'?(await project.tickets.get(h.id).then(x=>project.ticketKey(x)).catch(()=>null)):null;console.log(`${(t??h.id.slice(0,8)).padEnd(10)}  ${h.type.padEnd(8)}  ${h.similarity!==undefined?h.similarity.toFixed(2)+' ':''}${h.title}`);}return;}
  if(command==='search') {const {opts,positional}=parse([sub,...rest].filter(Boolean));const page=await project.searchPage(positional.join(' '),{offset:Number(opts.offset??0),limit:Number(opts.limit??20),types:labels(opts.type)});if(opts.format==='json'){out(page,'json');return;}if(!page.items.length){console.log('No results.');return;}for(const h of page.items)console.log(`${(h.key??h.id).padEnd(10)}  ${h.type.padEnd(8)}  ${h.title}`);console.log(`${page.offset+1}-${page.offset+page.items.length} of ${page.total}${page.nextOffset!==null?`; next: --offset ${page.nextOffset}`:''}`);return;}
  if(command==='context') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.context(positional[0],{budget:Number(opts.budget??8000)}),opts.format);return;}
  if(command==='validate') {const {opts}=parse([sub,...rest].filter(Boolean));const result=await project.validate();out(result,opts.format);if(!result.valid)process.exitCode=1;return;}
  throw new Error(`Unknown command: ${command}\n\n${usage}`);
}
try { await main(process.argv.slice(2)); }
catch(error){console.error(JSON.stringify({error:error.message,code:error.code??'USAGE_ERROR',details:error.details??{}},null,2));process.exitCode=error instanceof HeistError?1:2;}
