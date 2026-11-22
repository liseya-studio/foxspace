import type {ApiRequest,ApiResponse,AgentPolicy,Resource,AuditEvent} from "./data";
import {readPolicies,canAgent,requiresApproval,appendAudit} from "./data";
import type {FoxSpaceTransport} from "./api";
const PENDING_KEY="fox-agent-pending-v1";
export type PendingAgentAction={id:string;actorId:string;resource:Resource;method:"POST"|"PATCH"|"DELETE";recordId?:string;body?:Record<string,unknown>;path:string;summary:string;createdAt:string;status:"pending"|"approved"|"rejected"|"failed";resolvedAt?:string;result?:string};
type Collection={items:Record<string,unknown>[];save:(items:Record<string,unknown>[])=>void};
const resourceConfig:Partial<Record<Resource,{key:string;collection:string}>>={
 projects:{key:"fox-projects-v1",collection:"projects"},
 tasks:{key:"fox-notes-tasks-v1",collection:"tasks"},
 finance:{key:"fox-operations-v1",collection:"transactions"},
 content:{key:"fox-operations-v1",collection:"publications"},
 trackers:{key:"fox-trackers-v1",collection:"trackers"},
 tables:{key:"fox-tables-v1",collection:"root"}
};
function readStore(key:string):Record<string,unknown>|Record<string,unknown>[] {try{return JSON.parse(localStorage.getItem(key)||"null")??(key==="fox-tables-v1"?[]:{});}catch{return key==="fox-tables-v1"?[]:{ };}}
function getCollection(resource:Resource):Collection{
 if(resource==="goals")throw new Error("Изменение целей через API пока не поддерживается; используйте проекты.");
 const config=resourceConfig[resource];if(!config)throw new Error("Этот ресурс пока недоступен через локальный API.");
 const stored=readStore(config.key);
 if(config.collection==="root"){if(!Array.isArray(stored))throw new Error("Повреждено хранилище таблиц");return {items:stored as Record<string,unknown>[],save:items=>localStorage.setItem(config.key,JSON.stringify(items))};}
 if(!stored||Array.isArray(stored)||typeof stored!=="object")throw new Error("Повреждено хранилище "+resource);
 const root=stored as Record<string,unknown>,items=root[config.collection];
 if(!Array.isArray(items))throw new Error("Коллекция "+resource+" не найдена");
 return {items:items as Record<string,unknown>[],save:next=>{localStorage.setItem(config.key,JSON.stringify({...root,[config.collection]:next}));window.dispatchEvent(new Event(resource==="tasks"?"fox-notes-tasks-updated":resource==="projects"?"fox-projects-updated":resource==="trackers"?"fox-trackers-updated":"fox-operations-updated"));}};
}
export function readPendingAgentActions():PendingAgentAction[]{try{const value=JSON.parse(localStorage.getItem(PENDING_KEY)||"[]");return Array.isArray(value)?value:[];}catch{return [];}}
function writePending(items:PendingAgentAction[]){localStorage.setItem(PENDING_KEY,JSON.stringify(items.slice(-300)));window.dispatchEvent(new Event("fox-agent-pending-updated"));}
function audit(actorId:string,action:string,resource:Resource|"system",summary:string,outcome:AuditEvent["outcome"],approvalRequired:boolean,resourceId?:string,actorType:AuditEvent["actorType"]="agent"){appendAudit({actorType,actorId,action,resource,resourceId,summary,outcome,approvalRequired});}
function policyFor(actorId:string):AgentPolicy{const policy=readPolicies().find(p=>p.id===actorId);if(!policy||!policy.enabled)throw new Error("Профиль агента отсутствует или отключён");return policy;}
function route(path:string):{resource:Resource;id?:string}{if(path.length>300||path.includes("..")||path.includes("?")||path.includes("#"))throw new Error("Некорректный API-маршрут");const match=path.match(/^\/v1\/(projects|goals|tasks|tables|finance|content|trackers)(?:\/([A-Za-z0-9_-]{1,100}))?$/);if(!match)throw new Error("Маршрут API не найден");return {resource:match[1] as Resource,id:match[2]};}
function execute(request:PendingAgentAction,policy:AgentPolicy){const collection=getCollection(request.resource);const items=collection.items;let next=items;let recordId=request.recordId;
 if(request.method==="POST"){const body={...(request.body||{})};recordId=typeof body.id==="string"?body.id:crypto.randomUUID();if(items.some(x=>x.id===recordId))throw new Error("Запись с таким ID уже существует");next=[...items,{...body,id:recordId,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];}
 else if(request.method==="PATCH"){if(!recordId)throw new Error("Для изменения нужен ID записи");const index=items.findIndex(x=>x.id===recordId);if(index<0)throw new Error("Запись не найдена");const body=request.body||{};next=items.map((item,i)=>i===index?{...item,...body,id:recordId,updatedAt:new Date().toISOString()}:item);}
 else {if(!recordId)throw new Error("Для удаления нужен ID записи");if(!items.some(x=>x.id===recordId))throw new Error("Запись не найдена");next=items.filter(x=>x.id!==recordId);}
 collection.save(next);
 audit(request.actorId,"api."+request.method.toLowerCase(),request.resource,request.summary,"success",false,recordId);
 return {status:"executed",recordId};
}
export class LocalAgentTransport implements FoxSpaceTransport{
 async request<T>(request:ApiRequest):Promise<ApiResponse<T>>{
  const respond=(data:unknown)=>({data:data as T,requestId:request.requestId,version:"1.0"});
  let parsed:{resource:Resource;id?:string};
  try{parsed=route(request.path);}catch(error){audit(request.actorId,"api.route", "system" as Resource,String(error),"denied",false);throw error;}
  const {resource,id}=parsed;
  let policy:AgentPolicy;try{policy=policyFor(request.actorId);}catch(error){audit(request.actorId,"api.auth",resource,String(error),"denied",false,id);throw error;}
  if(request.method==="GET"){
   if(request.capability!=="read")throw new Error("Для GET требуется read capability");
   if(!canAgent(policy,resource,"read")){audit(request.actorId,"api.read",resource,"Чтение запрещено политикой доступа","denied",false,id);throw new Error("Агенту не разрешено читать этот ресурс");}
   if(resource==="goals"){const projects=getCollection("projects").items;const goals:Record<string,unknown>[]=[];for(const project of projects){const nested=project.goals;if(Array.isArray(nested)){for(const goal of nested){if(goal&&typeof goal==="object"&&!Array.isArray(goal))goals.push({...goal as Record<string,unknown>,projectId:project.id});}}}return respond(id?goals.find(goal=>String(goal.id)===id)??null:goals);}
   const items=getCollection(resource).items;return respond(id?items.find(x=>x.id===id)??null:items);
  }
  const action=request.method==="POST"?"create":request.method==="PATCH"?"update":"delete";
  if(request.capability!==(request.method==="DELETE"?"delete":"write"))throw new Error("Несовпадение API capability и HTTP-метода");
  if(!canAgent(policy,resource,action)){audit(request.actorId,"api."+action,resource,"Действие запрещено политикой доступа","denied",false,id);throw new Error("Агенту не разрешено выполнять это действие");}
  const bodyText=request.body===undefined?"":JSON.stringify(request.body)||"";
  if(bodyText.length>100_000)throw new Error("Тело запроса превышает 100 КБ");
  const summary=request.method==="POST"?"Создание записи через AI API":request.method==="PATCH"?"Изменение записи через AI API":"Удаление записи через AI API";
  const pending:PendingAgentAction={id:crypto.randomUUID(),actorId:request.actorId,resource,method:request.method as PendingAgentAction["method"],recordId:id,body:request.body&&typeof request.body==="object"&&!Array.isArray(request.body)?request.body as Record<string,unknown>:undefined,path:request.path,summary,createdAt:new Date().toISOString(),status:"pending"};
  if(requiresApproval(policy,resource,action)){writePending([pending,...readPendingAgentActions()]);audit(request.actorId,"api."+action,resource,"Действие ожидает подтверждения пользователя","pending_approval",true,id);return respond({status:"pending_approval",requestId:pending.id});}
  try{return respond(execute(pending,policy));}catch(error){audit(request.actorId,"api."+action,resource,String(error),"failed",false,id);throw error;}
 }
}
export async function resolvePendingAgentAction(id:string,approve:boolean):Promise<void>{
 const pending=readPendingAgentActions().find(x=>x.id===id&&x.status==="pending");if(!pending)throw new Error("Запрос больше не ожидает подтверждения");
 const policy=readPolicies().find(p=>p.id===pending.actorId);
 if(!approve){writePending(readPendingAgentActions().map(x=>x.id===id?{...x,status:"rejected",resolvedAt:new Date().toISOString(),result:"Отклонено пользователем"}:x));audit("user","api.approval",pending.resource,"Пользователь отклонил действие агента","denied",true,pending.recordId,"user");return;}
 if(!policy||!policy.enabled||!canAgent(policy,pending.resource,pending.method==="POST"?"create":pending.method==="PATCH"?"update":"delete"))throw new Error("Политика доступа изменилась: действие больше не разрешено");
 try{const result=execute(pending,policy);writePending(readPendingAgentActions().map(x=>x.id===id?{...x,status:"approved",resolvedAt:new Date().toISOString(),result:"Изменение выполнено"}:x));audit("user","api.approval",pending.resource,"Пользователь подтвердил действие агента","success",true,result.recordId,"user");}catch(error){writePending(readPendingAgentActions().map(x=>x.id===id?{...x,status:"failed",resolvedAt:new Date().toISOString(),result:String(error)}:x));throw error;}
}
