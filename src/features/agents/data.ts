export const AGENT_POLICIES_KEY="fox-agent-policies-v1";
export const AUDIT_LOG_KEY="fox-audit-log-v1";
export type Resource="projects"|"goals"|"tasks"|"tables"|"files"|"finance"|"content"|"trackers"|"notifications"|"integrations";
export type Permission={read:boolean;create:boolean;update:boolean;delete:boolean;approvalRequired:boolean};
export type AgentPolicy={id:string;name:string;description:string;enabled:boolean;permissions:Record<Resource,Permission>;createdAt:string;updatedAt:string};
export type AuditEvent={id:string;at:string;actorType:"user"|"agent"|"system";actorId:string;action:string;resource:Resource|"system";resourceId?:string;summary:string;outcome:"success"|"denied"|"failed"|"pending_approval";approvalRequired:boolean};
export type ApiCapability="read"|"write"|"delete"|"execute";
export type ApiRequest={method:"GET"|"POST"|"PATCH"|"DELETE";path:string;body?:unknown;requestId:string;actorId:string;capability:ApiCapability};
export type ApiResponse<T>={data:T;requestId:string;version:string};
export const RESOURCES:Resource[]=["projects","goals","tasks","tables","files","finance","content","trackers","notifications","integrations"];
export const RESOURCE_LABELS:Record<Resource,string>={projects:"Проекты",goals:"Цели и KPI",tasks:"Задачи",tables:"Таблицы",files:"Файлы",finance:"Финансы",content:"Контент",trackers:"Личные трекеры",notifications:"Уведомления",integrations:"Интеграции"};
export function blankPermissions():Record<Resource,Permission>{return Object.fromEntries(RESOURCES.map(r=>[r,{read:false,create:false,update:false,delete:false,approvalRequired:true}])) as Record<Resource,Permission>;}
export function readPolicies():AgentPolicy[]{try{const v=JSON.parse(localStorage.getItem(AGENT_POLICIES_KEY)||"[]");return Array.isArray(v)?v:[];}catch{return [];}}
export function savePolicies(v:AgentPolicy[]){localStorage.setItem(AGENT_POLICIES_KEY,JSON.stringify(v));window.dispatchEvent(new Event("fox-agent-policies-updated"));}
export function readAudit():AuditEvent[]{try{const v=JSON.parse(localStorage.getItem(AUDIT_LOG_KEY)||"[]");return Array.isArray(v)?v:[];}catch{return [];}}
export function appendAudit(event:Omit<AuditEvent,"id"|"at">){const all=readAudit();all.push({...event,id:crypto.randomUUID(),at:new Date().toISOString()});localStorage.setItem(AUDIT_LOG_KEY,JSON.stringify(all.slice(-1000)));window.dispatchEvent(new Event("fox-audit-updated"));}
export function canAgent(policy:AgentPolicy,resource:Resource,action:"read"|"create"|"update"|"delete"){if(!policy.enabled)return false;return policy.permissions[resource]?.[action]===true;}
export function requiresApproval(policy:AgentPolicy,resource:Resource,action:"create"|"update"|"delete"){return policy.permissions[resource]?.approvalRequired!==false;}
