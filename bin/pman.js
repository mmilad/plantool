#!/usr/bin/env node
import { initProject, openProject, PmanError } from '../src/index.js';
import { serve } from '../src/server.js';

const usage = `pman — Git-native planning and issue tracking

Usage:
  pman init [--name NAME]
  pman ticket create --title TITLE [--parent ID] [--description TEXT] [--status STATUS]
  pman ticket list [--status STATUS] [--parent ID] [--format json]
  pman ticket show ID [--format json]
  pman ticket update ID [--title TITLE] [--status STATUS] [--description TEXT]
  pman ticket move ID [--parent ID]
  pman tree [ID] [--max-depth N] [--limit N] [--offset N] [--format json]
  pman goal|plan|decision create --title TITLE [--body TEXT] [--links ID,ID]
  pman comment add TICKET_ID TEXT
  pman relation add SOURCE_ID TARGET_ID TYPE
  pman relation list [ID]
  pman search QUERY [--format json]
  pman context ID [--budget BYTES] [--format json]
  pman validate [--format json]
  pman serve [--port N] [--open]

All commands operate on the nearest project-local .pman/ directory.`;

function parse(args) {
  const opts={}, positional=[];
  for(let i=0;i<args.length;i++){const a=args[i];if(a.startsWith('--')){const k=a.slice(2);if(k==='open'){opts[k]=true;continue;}if(i+1>=args.length)throw new Error(`Missing value for ${a}`);opts[k.replaceAll('-','_')]=args[++i];}else positional.push(a);}
  return {opts,positional};
}
const out=(value,format='text',kind)=>{
  if(format==='json'){console.log(JSON.stringify(value,null,2));return;}
  if(typeof value==='string'){console.log(value);return;}
  if(Array.isArray(value)&&value.every(x=>x&&typeof x==='object'&&'id'in x&&'title'in x)){
    for(const x of value)console.log(`${x.id}  ${x.status??x.rollup??''}  ${'depth'in x?'  '.repeat(x.depth):''}${x.title}`);
    if(!value.length)console.log('No matching items.');return;
  }
  if(value&&typeof value==='object'&&'id'in value)console.log(`${kind??value.type??value.kind??'record'} ${value.id}  ${value.title??''}`.trim());
  else if(value&&typeof value==='object'&&'valid'in value)console.log(value.valid?'Project is valid.':`Project has ${value.errors.length} validation error(s).`);
  else console.log(JSON.stringify(value,null,2));
};
async function main(argv) {
  if(argv.includes('--help')||argv[0]==='help'||!argv.length){console.log(usage);return;}
  const [command,sub,...rest]=argv;
  if(command==='init'){const {opts}=parse([sub,...rest].filter(Boolean));const c=await initProject({name:opts.name});out(`Initialized ${c.name} at .pman/`);return;}
  if(command==='serve'){const {opts}=parse([sub,...rest].filter(Boolean));const s=await serve({port:Number(opts.port??0),open:!!opts.open});console.log(`pman is serving ${s.project.config.name} at ${s.url}`);console.log('Press Ctrl-C to stop.');await new Promise(resolve=>s.server.once('close',resolve));return;}
  const project=await openProject();
  if(command==='ticket'&&sub==='create') {const {opts}=parse(rest);const t=await project.tickets.create({title:opts.title,description:opts.description,status:opts.status,parentId:opts.parent??null});out(t,opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='list') {const {opts}=parse(rest);out(await project.tickets.list({status:opts.status,parentId:opts.parent,limit:Number(opts.limit??5000)}),opts.format);return;}
  if(command==='ticket'&&sub==='show') {const {opts,positional}=parse(rest);out(await project.tickets.get(positional[0]),opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='update') {const {opts,positional}=parse(rest),patch={};for(const k of ['title','status','description','priority'])if(opts[k]!==undefined)patch[k]=opts[k];out(await project.tickets.update(positional[0],patch),opts.format,'ticket');return;}
  if(command==='ticket'&&sub==='move') {const {opts,positional}=parse(rest);out(await project.tickets.move(positional[0],opts.parent??null),opts.format,'ticket');return;}
  if(command==='tree') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.tree(positional[0]??null,{maxDepth:opts.max_depth===undefined?Infinity:Number(opts.max_depth),limit:Number(opts.limit??5000),offset:Number(opts.offset??0)}),opts.format);return;}
  if(['goal','plan','decision'].includes(command)&&sub==='create') {const {opts}=parse(rest);const kind={goal:'goals',plan:'plans',decision:'decisions'}[command];out(await project.documents.create(kind,{title:opts.title,body:opts.body??'',links:opts.links?opts.links.split(',').filter(Boolean):[]}),opts.format);return;}
  if(command==='comment'&&sub==='add') {const {positional}=parse(rest);out(await project.comments.add(positional[0],{body:positional.slice(1).join(' ')}));return;}
  if(command==='relation'&&sub==='add') {const {positional}=parse(rest);out(await project.relations.add(...positional));return;}
  if(command==='relation'&&sub==='list') {const {positional,opts}=parse(rest);out(await project.relations.list(positional[0]),opts.format);return;}
  if(command==='search') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.search(positional.join(' ')),opts.format);return;}
  if(command==='context') {const {opts,positional}=parse([sub,...rest].filter(Boolean));out(await project.context(positional[0],{budget:Number(opts.budget??8000)}),opts.format);return;}
  if(command==='validate') {const {opts}=parse([sub,...rest].filter(Boolean));const result=await project.validate();out(result,opts.format);if(!result.valid)process.exitCode=1;return;}
  throw new Error(`Unknown command: ${command}\n\n${usage}`);
}
try { await main(process.argv.slice(2)); }
catch(error){console.error(JSON.stringify({error:error.message,code:error.code??'USAGE_ERROR',details:error.details??{}},null,2));process.exitCode=error instanceof PmanError?1:2;}
