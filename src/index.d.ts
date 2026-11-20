export type Status = 'todo' | 'in_progress' | 'done' | 'cancelled' | string;
export type TicketKind = 'task' | 'feature' | 'bug' | 'decision' | 'option';
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
export interface Ticket { schemaVersion: 1; id: string; number?: number; title: string; kind?: TicketKind; assignee?: Assignee | null; codePlan?: CodePlan | null; description: string; status: Status; priority: string; labels: string[]; properties: Record<string, unknown>; parentId: string | null; createdAt: string; updatedAt: string; completedAt?: string; completedAtSource?:'updatedAt'; requestKey?:string; requestHash?:string; [key: string]: unknown }
export interface TimelineItem { id:string; key:string|null; title:string; kind:string; status:'done'; completedAt:string; completionSource:'recorded'|'updatedAt'; parentId:string|null; parentKey:string|null; parentTitle:string|null; outcome:{summary?:string;changedFiles?:string[]} }
export interface RoadmapPage<T> { items:T[]; total:number; offset:number; limit:number; nextOffset:number|null; snapshot:string }
export interface TimelineOptions { since?:string; until?:string; kind?:string|string[]; kinds?:string|string[]; status?:string|string[]; order?:'asc'|'desc'; limit?:number; offset?:number; snapshot?:string }
export interface RoadmapStructureOptions { maxDepth?:number; limit?:number; offset?:number; fields?:'plan'|'row'|'full'; status?:string|string[]; hide?:string|string[]; kind?:string|string[]; query?:string; ready?:boolean; blocked?:boolean; snapshot?:string }
export interface RoadmapBlocker { id:string; key:string|null; title:string; via:'blocks'|'provider' }
export interface DependencyOptions { root?:string|null; includeFinished?:boolean; limit?:number; snapshot?:string }
export interface DependencyNode { id:string; key:string|null; title:string; kind:TicketKind; status:Status; parentId:string|null; contextOnly:boolean }
export interface DependencyEdge { sourceId:string; targetId:string; via:'blocks'|'provider'; inherited:boolean; components?:Array<{id:string;name:string;stage:'mock'|'full'}> }
export interface DependencyResult { nodes:DependencyNode[]; edges:DependencyEdge[]; totalNodes:number; totalEdges:number; limit:number; edgeLimit:number; truncated:boolean; omittedNodes:number; omittedEdges:number; rootId:string|null; snapshot:string }
export interface RelationGraphOptions { root?:string|null; limit?:number }
export interface GraphNode { id:string; key:string|null; title:string; kind:TicketKind; status:Status; layer:number; row:number }
export interface GraphEdge { sourceId:string; targetId:string; type:string }
export interface RelationGraphResult { nodes:GraphNode[]; edges:GraphEdge[]; layers:number; hidden:number; totalNodes:number; truncated:boolean }
export interface RoadmapStructureRow { id:string; parentId:string|null; depth:number; title:string; number:number|null; key:string|null; kind:TicketKind; status:Status; priority:string; labels:string[]; assignee:string|Assignee|null; childCount:number; rollup:string; updatedAt:string; ready:boolean; readyReasons:string[]; blockedBy:RoadmapBlocker[]; contextOnly?:boolean; [key:string]:unknown }
export type TicketPatch = Omit<Partial<Ticket>,'completedAt'|'completedAtSource'|'requestKey'|'requestHash'> & {completedAt?:never;completedAtSource?:never};
export type TicketCreateInput = TicketPatch & {title:string;requestKey?:string};
export interface Project { root: string; dir: string; config: Record<string, unknown>; key: string; ticketKey(ticket: Ticket): string | null; resolveTicket(ref: string): Promise<string>; timeline(options?:TimelineOptions):Promise<RoadmapPage<TimelineItem>>; deps(options?:DependencyOptions):Promise<DependencyResult>; relationGraph(options?:RelationGraphOptions):Promise<RelationGraphResult>; roadmap:{deps(options?:DependencyOptions):Promise<DependencyResult>;backfillCompletion(options?:{dryRun?:boolean}):Promise<{dryRun:boolean;candidates:number;changed:number;skipped:Array<{id:string;key:string|null;reason:string}>;items:Array<{id:string;key:string|null;completedAt:string}>}>;structure(id?:string|null,options?:RoadmapStructureOptions):Promise<RoadmapPage<RoadmapStructureRow>>}; keys: { init(options?: { key?: string }): Promise<{ key: string; assigned: number; total: number }>; renumber(): Promise<{ changed: Array<{ id: string; from: string; to: string }> }> }; tickets: { create(input: TicketCreateInput):Promise<Ticket>; get(id:string):Promise<Ticket>; getVersioned(id:string):Promise<{ticket:Ticket;revision:string}>; list(options?:{status?:string;parentId?:string|null;limit?:number}):Promise<Ticket[]>; update(id:string,patch:TicketPatch,options?:{expectedRevision?:string;force?:boolean}):Promise<Ticket>; move(id:string,parentId:string|null):Promise<Ticket>; rollup(id:string):Promise<string>; readiness(id:string):Promise<{ready:boolean;blockers:Array<{relationshipId:string;ticket:Ticket|null}>}> }; documents: {create(kind:'goals'|'plans'|'decisions',input:{title:string;body?:string;status?:string;links?:string[]}):Promise<Record<string,unknown>>; list(kind:'goals'|'plans'|'decisions'):Promise<Record<string,unknown>[]>; get(kind:'goals'|'plans'|'decisions',id:string):Promise<Record<string,unknown>>; getVersioned(kind:'goals'|'plans'|'decisions',id:string):Promise<{document:Record<string,unknown>;revision:string}>; update(kind:'goals'|'plans'|'decisions',id:string,patch:{title?:string;status?:string;body?:string;links?:string[]},options?:{expectedRevision?:string}):Promise<{document:Record<string,unknown>;revision:string;changed:boolean}>}; comments:{add(ticketId:string,input:{body:string;author?:string}):Promise<Record<string,unknown>>;list(ticketId?:string):Promise<Record<string,unknown>[]>}; relations:{add(sourceId:string,targetId:string,type:string):Promise<Record<string,unknown>>;list(id?:string):Promise<Record<string,unknown>[]>;remove(id:string):Promise<void>}; validate():Promise<{valid:boolean;errors:string[];counts:Record<string,number>}>; search(query:string,options?:{types?:string[]}):Promise<Record<string,unknown>[]>; searchPage(query:string,options?:{offset?:number;limit?:number;types?:string[];snapshot?:string}):Promise<{query:string;items:Record<string,unknown>[];total:number;offset:number;limit:number;nextOffset:number|null;snapshot:string}>; context(id:string,options?:{budget?:number}):Promise<Record<string,unknown>>; tree(id?:string|null,options?:RoadmapStructureOptions & {withTotal?:boolean}):Promise<any>; next(options?:{limit?:number;parentId?:string;now?:number}):Promise<NextTicket[]>; claim(id:string,options:{agent:string;leaseMinutes?:number;force?:boolean;now?:number}):Promise<Ticket>; release(id:string,options?:{agent?:string;force?:boolean}):Promise<Ticket>; finish(id:string,options?:{note?:string;agent?:string;force?:boolean}):Promise<{ticket:Ticket;comment:Record<string,unknown>|null;unblocked:NextTicket[]}>; components:{create(input:{kind:string;name:string;parentId?:string|null;description?:string}):Promise<Component>; update(ref:string,patch:Partial<Component>):Promise<Component>; get(id:string):Promise<Component>; list():Promise<Component[]>; resolve(ref:string):Promise<Component>}; types:{set(name:string,schema:SchemaInput,options?:{description?:string}):Promise<TypeRecord>; get(name:string):Promise<TypeRecord>; list():Promise<TypeRecord[]>}; contracts:{set(component:string,input:{input?:SchemaInput;output?:SchemaInput;description?:string}):Promise<Contract>; get(component:string):Promise<Contract>; list():Promise<Contract[]>}; codePlan:{get(ticketId:string):Promise<CodePlan>; add(ticketId:string,key:'implements'|'consumes'|'changes',component:string,options?:{requires?:string[];provides?:string[]}):Promise<Ticket>; remove(ticketId:string,key:'implements'|'consumes'|'changes',component:string):Promise<Ticket>}; check():Promise<CheckResult> }
export class PlanError extends Error { code:string; details:Record<string,unknown> }
export class NotFoundError extends PlanError {}
export class ValidationError extends PlanError {}
export class CycleError extends PlanError {}
export class ConflictError extends PlanError {}
export class UnsupportedSchemaVersionError extends PlanError {}
export class StorageError extends PlanError {}
export class OpenWorkError extends PlanError {}
export const TICKET_KINDS: readonly TicketKind[];
export const DEFAULT_COMPONENT_KINDS: readonly string[];
export function normalizeSchema(input:SchemaInput,where?:string):Schema;
export const DEFAULT_STATUSES: readonly string[];
export const RELATION_TYPES: readonly string[];
export function uuidv7(now?:number):string;
export function deriveKey(name:string):string;
export function initProject(options?:{cwd?:string;name?:string;key?:string}):Promise<Record<string,unknown>>;
export function findProject(cwd?:string):Promise<string|null>;
export function openProject(options?:{cwd?:string;cache?:boolean}):Promise<Project>;
export function buildTree(project:Project,id?:string|null,options?:{maxDepth?:number;limit?:number;offset?:number}):Promise<Record<string,unknown>[]>;
export function timeline(project:Project,options?:TimelineOptions):Promise<RoadmapPage<TimelineItem>>;
export function dependencies(project:Project,options?:DependencyOptions):Promise<DependencyResult>;
export function relationGraph(project:Project,options?:RelationGraphOptions):Promise<RelationGraphResult>;
export function validateProject(project:Project):Promise<{valid:boolean;errors:string[];counts:Record<string,number>}>;
export function searchProject(project:Project,query:string):Promise<Record<string,unknown>[]>;
export function contextFor(project:Project,id:string,options?:{budget?:number}):Promise<Record<string,unknown>>;
