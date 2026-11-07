export type Status = 'todo' | 'in_progress' | 'done' | 'cancelled' | string;
export type TicketKind = 'task' | 'feature' | 'bug';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export interface Assignee { agent: string; claimedAt: string; expiresAt: string }
export interface NextTicket { id: string; title: string; kind: TicketKind; status: Status; priority: Priority; effectivePriority: Priority; unblocks: number; focus: boolean; path: string[]; createdAt: string; reasons: string[] }
export type Schema = { type?: 'string'|'number'|'integer'|'boolean'|'null'|'any'|'array'|'object'; properties?: Record<string, Schema>; required?: string[]; items?: Schema; enum?: unknown[]; description?: string; $ref?: string };
/** Shorthand accepted wherever a schema is written: "string", "string[]", "User", ["User"], { field: "string", optional: "string?" } or a full Schema. */
export type SchemaInput = string | SchemaInput[] | Schema | { [field: string]: SchemaInput };
export interface Component { schemaVersion: 1; id: string; kind: string; name: string; description: string; parentId: string | null; createdAt: string; updatedAt: string }
export interface TypeRecord { schemaVersion: 1; id: string; name: string; description: string; schema: Schema; createdAt: string; updatedAt: string }
export interface Contract { schemaVersion: 1; id: string; componentId: string; version: number; description: string; input: Schema; output: Schema; createdAt: string; updatedAt: string }
export interface CodePlanEntry { component: string; requires?: string[]; provides?: string[] }
export interface CodePlan { implements?: CodePlanEntry[]; consumes?: CodePlanEntry[]; changes?: CodePlanEntry[] }
export interface Diagnostic { code: string; message: string; ticketId?: string; componentId?: string; [key: string]: unknown }
export interface CheckResult { valid: boolean; errors: Diagnostic[]; warnings: Diagnostic[]; counts: Record<string, number> }
export interface Ticket { schemaVersion: 1; id: string; title: string; kind?: TicketKind; assignee?: Assignee | null; codePlan?: CodePlan | null; description: string; status: Status; priority: string; labels: string[]; properties: Record<string, unknown>; parentId: string | null; createdAt: string; updatedAt: string; [key: string]: unknown }
export interface Project { root: string; dir: string; config: Record<string, unknown>; tickets: { create(input: Partial<Ticket> & {title:string}):Promise<Ticket>; get(id:string):Promise<Ticket>; getVersioned(id:string):Promise<{ticket:Ticket;revision:string}>; list(options?:{status?:string;parentId?:string|null;limit?:number}):Promise<Ticket[]>; update(id:string,patch:Partial<Ticket>,options?:{expectedRevision?:string;force?:boolean}):Promise<Ticket>; move(id:string,parentId:string|null):Promise<Ticket>; rollup(id:string):Promise<string>; readiness(id:string):Promise<{ready:boolean;blockers:Array<{relationshipId:string;ticket:Ticket|null}>}> }; documents: {create(kind:'goals'|'plans'|'decisions',input:{title:string;body?:string;status?:string;links?:string[]}):Promise<Record<string,unknown>>; list(kind:'goals'|'plans'|'decisions'):Promise<Record<string,unknown>[]>; get(kind:'goals'|'plans'|'decisions',id:string):Promise<Record<string,unknown>>}; comments:{add(ticketId:string,input:{body:string;author?:string}):Promise<Record<string,unknown>>;list(ticketId?:string):Promise<Record<string,unknown>[]>}; relations:{add(sourceId:string,targetId:string,type:string):Promise<Record<string,unknown>>;list(id?:string):Promise<Record<string,unknown>[]>;remove(id:string):Promise<void>}; validate():Promise<{valid:boolean;errors:string[];counts:Record<string,number>}>; search(query:string):Promise<Record<string,unknown>[]>; context(id:string,options?:{budget?:number}):Promise<Record<string,unknown>>; tree(id?:string|null,options?:{maxDepth?:number}):Promise<Record<string,unknown>[]>; next(options?:{limit?:number;parentId?:string;now?:number}):Promise<NextTicket[]>; claim(id:string,options:{agent:string;leaseMinutes?:number;force?:boolean;now?:number}):Promise<Ticket>; release(id:string,options?:{agent?:string;force?:boolean}):Promise<Ticket>; finish(id:string,options?:{note?:string;agent?:string;force?:boolean}):Promise<{ticket:Ticket;comment:Record<string,unknown>|null;unblocked:NextTicket[]}>; components:{create(input:{kind:string;name:string;parentId?:string|null;description?:string}):Promise<Component>; update(ref:string,patch:Partial<Component>):Promise<Component>; get(id:string):Promise<Component>; list():Promise<Component[]>; resolve(ref:string):Promise<Component>}; types:{set(name:string,schema:SchemaInput,options?:{description?:string}):Promise<TypeRecord>; get(name:string):Promise<TypeRecord>; list():Promise<TypeRecord[]>}; contracts:{set(component:string,input:{input?:SchemaInput;output?:SchemaInput;description?:string}):Promise<Contract>; get(component:string):Promise<Contract>; list():Promise<Contract[]>}; codePlan:{get(ticketId:string):Promise<CodePlan>; add(ticketId:string,key:'implements'|'consumes'|'changes',component:string,options?:{requires?:string[];provides?:string[]}):Promise<Ticket>; remove(ticketId:string,key:'implements'|'consumes'|'changes',component:string):Promise<Ticket>}; check():Promise<CheckResult> }
export class PmanError extends Error { code:string; details:Record<string,unknown> }
export class NotFoundError extends PmanError {}
export class ValidationError extends PmanError {}
export class CycleError extends PmanError {}
export class ConflictError extends PmanError {}
export class UnsupportedSchemaVersionError extends PmanError {}
export class StorageError extends PmanError {}
export class OpenWorkError extends PmanError {}
export const TICKET_KINDS: readonly TicketKind[];
export const DEFAULT_COMPONENT_KINDS: readonly string[];
export function normalizeSchema(input:SchemaInput,where?:string):Schema;
export const DEFAULT_STATUSES: readonly string[];
export const RELATION_TYPES: readonly string[];
export function uuidv7(now?:number):string;
export function initProject(options?:{cwd?:string;name?:string}):Promise<Record<string,unknown>>;
export function findProject(cwd?:string):Promise<string|null>;
export function openProject(options?:{cwd?:string}):Promise<Project>;
export function buildTree(project:Project,id?:string|null,options?:{maxDepth?:number;limit?:number;offset?:number}):Promise<Record<string,unknown>[]>;
export function validateProject(project:Project):Promise<{valid:boolean;errors:string[];counts:Record<string,number>}>;
export function searchProject(project:Project,query:string):Promise<Record<string,unknown>[]>;
export function contextFor(project:Project,id:string,options?:{budget?:number}):Promise<Record<string,unknown>>;
