import { isTauri } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { appendAudit } from "../agents/data";
import {readNotesTasks} from "../notes/data";
import {readOperations,money} from "../operations/data";
import {readProjects,goalProgress} from "../projects/data";
export const AUTOMATIONS_KEY="fox-automations-v1";
export type Cadence="once"|"daily"|"weekly";
export type AutomationTrigger="schedule"|"task_due"|"goal_deadline"|"budget_exceeded";
export type Automation={id:string;name:string;message:string;trigger?:AutomationTrigger;triggerOffsetDays?:number;cadence:Cadence;date:string;weekday:number;time:string;enabled:boolean;lastRunKey:string|null;lastRunAt:string|null;createdAt:string;updatedAt:string};
export type AutomationRun={id:string;automationId:string;automationName:string;scheduledFor:string;ranAt:string;status:"sent"|"permission_missing"|"failed";detail:string};
export type AutomationData={version:1;items:Automation[];history:AutomationRun[];notificationsEnabled:boolean};
const empty=():AutomationData=>({version:1,items:[],history:[],notificationsEnabled:false});
let schedulerRunning=false;
export function readAutomations():AutomationData{try{const v=JSON.parse(localStorage.getItem(AUTOMATIONS_KEY)||"{}");return {...empty(),...v,items:Array.isArray(v.items)?v.items.map((item:Automation)=>({...item,trigger:item.trigger??"schedule",triggerOffsetDays:item.triggerOffsetDays??1})):[],history:Array.isArray(v.history)?v.history:[]};}catch{return empty();}}
export function saveAutomations(v:AutomationData){localStorage.setItem(AUTOMATIONS_KEY,JSON.stringify(v));window.dispatchEvent(new Event("fox-automations-updated"));}
function dayKey(now:Date){return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");}
function addDays(day:string,count:number){const d=new Date(day+"T12:00:00");d.setDate(d.getDate()+count);return dayKey(d);}
function runKey(a:Automation,now:Date){const day=dayKey(now);return a.cadence==="weekly"?day+"-w"+now.getDay():day;}
function scheduleDue(a:Automation,now:Date){if(!a.enabled)return false;const current=now.getHours()*60+now.getMinutes(),[h,m]=a.time.split(":").map(Number),target=h*60+m;if(current<target)return false;if(a.cadence==="once")return a.date===dayKey(now);if(a.cadence==="weekly"&&a.weekday!==now.getDay())return false;return true;}
type TriggerResult={key:string;message:string;scheduledFor:string};
function evaluateTrigger(a:Automation,now:Date):TriggerResult|null{
 const today=dayKey(now),limit=addDays(today,Math.max(0,Math.min(30,a.triggerOffsetDays??1)));
 if(a.trigger==="task_due"){
  const tasks=readNotesTasks().tasks.filter(t=>t.status!=="done"&&t.dueDate&&t.dueDate<=limit);
  if(!tasks.length)return null;
  return {key:"task_due:"+today,message:a.message+"\n"+tasks.slice(0,8).map(t=>"• "+t.title+" — "+t.dueDate).join("\n"),scheduledFor:today};
 }
 if(a.trigger==="goal_deadline"){
  const goals=readProjects().projects.flatMap(p=>p.goals.filter(g=>g.deadline&&g.deadline<=limit&&(goalProgress(g)??0)<100).map(g=>({name:g.title,deadline:g.deadline,project:p.name})));
  if(!goals.length)return null;
  return {key:"goal_deadline:"+today,message:a.message+"\n"+goals.slice(0,8).map(g=>"• "+g.project+": "+g.name+" — "+g.deadline).join("\n"),scheduledFor:today};
 }
 if(a.trigger==="budget_exceeded"){
  const ops=readOperations(),month=today.slice(0,7);
  const exceeded=ops.budgets.filter(b=>b.month===month).map(b=>{const spent=ops.transactions.filter(t=>t.state==="actual"&&t.kind==="expense"&&t.date.startsWith(month)&&(!b.projectId||t.projectId===b.projectId)&&(!b.category||t.category===b.category)).reduce((sum,t)=>sum+t.amount,0);return {...b,spent};}).filter(b=>b.limit>0&&b.spent>b.limit);
  if(!exceeded.length)return null;
  return {key:"budget_exceeded:"+month,message:a.message+"\n"+exceeded.map(b=>"• "+b.title+": "+money(b.spent)+" / "+money(b.limit)).join("\n"),scheduledFor:month};
 }
 return null;
}
export async function enableAutomationNotifications():Promise<boolean>{let allowed=false;if(isTauri()){allowed=await isPermissionGranted();if(!allowed)allowed=(await requestPermission())==="granted";}else if("Notification" in window){const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();allowed=permission==="granted";}const data=readAutomations();data.notificationsEnabled=allowed;saveAutomations(data);return allowed;}
export async function sendAutomationTest(title:string,body:string,tag:string):Promise<boolean>{try{if(isTauri()){if(!(await isPermissionGranted()))return false;await sendNotification({title,body});return true;}if(!("Notification" in window)||Notification.permission!=="granted")return false;new Notification(title,{body,tag});return true;}catch(error){console.error("Fox Space notification failed",error);return false;}}
export async function runDueAutomations(now=new Date()):Promise<void>{if(schedulerRunning)return;schedulerRunning=true;try{const data=readAutomations();if(!data.notificationsEnabled)return;let allowed=true;if(isTauri())allowed=await isPermissionGranted();else allowed="Notification" in window&&Notification.permission==="granted";if(!allowed)return;let changed=false;for(const a of data.items){if(!a.enabled)continue;const trigger=a.trigger??"schedule";let key:string,message=a.message,scheduledFor:string;if(trigger==="schedule"){if(!scheduleDue(a,now))continue;key=runKey(a,now);scheduledFor=key+"T"+a.time;}else{const condition=evaluateTrigger(a,now);if(!condition)continue;key=condition.key;message=condition.message;scheduledFor=condition.scheduledFor;}if(a.lastRunKey===key)continue;let status:AutomationRun["status"]="sent",detail="Системное уведомление отправлено";try{if(isTauri())await sendNotification({title:a.name,body:message});else new Notification(a.name,{body:message,tag:"fox-automation-"+a.id});}catch{status="failed";detail="Не удалось показать системное уведомление";}data.history.push({id:crypto.randomUUID(),automationId:a.id,automationName:a.name,scheduledFor,ranAt:now.toISOString(),status,detail});appendAudit({actorType:"system",actorId:"scheduler",action:"automation.executed",resource:"notifications",resourceId:a.id,summary:"Автоматизация «"+a.name+"»: "+detail,outcome:status==="sent"?"success":"failed",approvalRequired:false});a.lastRunKey=key;a.lastRunAt=now.toISOString();if(trigger==="schedule"&&a.cadence==="once")a.enabled=false;a.updatedAt=now.toISOString();changed=true;}if(changed){data.history=data.history.slice(-200);saveAutomations(data);}}finally{schedulerRunning=false;}}
