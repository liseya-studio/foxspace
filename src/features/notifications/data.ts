import { readNotesTasks, type Task } from "../notes/data";

const KEY="fox-notification-state-v1";
type ReadState={read:string[];snoozed:Record<string,string>};
export type LocalNotification={
  id:string;taskId:string;title:string;description:string;
  kind:"overdue"|"today"|"upcoming";date:string;priority:number;
  isRead:boolean;snoozedUntil?:string;
};
function dayString(date:Date):string{
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
  return y+"-"+m+"-"+d;
}
function localDate(raw:string){return new Date(raw+"T12:00:00");}
export function loadNotificationState():ReadState{
  try{
    const parsed=JSON.parse(localStorage.getItem(KEY)??"{}") as Partial<ReadState>;
    return {read:Array.isArray(parsed.read)?parsed.read.filter(x=>typeof x==="string"):[],snoozed:parsed.snoozed&&typeof parsed.snoozed==="object"?parsed.snoozed:{}};
  }catch{return {read:[],snoozed:{}};}
}
function write(state:ReadState){
  localStorage.setItem(KEY,JSON.stringify(state));
  window.dispatchEvent(new Event("fox-notifications-updated"));
}
export function markNotification(id:string,read:boolean){
  const state=loadNotificationState();
  state.read=read?Array.from(new Set([...state.read,id])):state.read.filter(x=>x!==id);
  write(state);
}
export function markAllNotifications(ids:string[]){const state=loadNotificationState();state.read=Array.from(new Set([...state.read,...ids]));write(state);}
export function snoozeNotification(id:string,days:number){
  const state=loadNotificationState();
  const date=new Date();date.setDate(date.getDate()+days);
  state.snoozed[id]=dayString(date);
  write(state);
}
function classify(task:Task,day:string):Omit<LocalNotification,"isRead"|"snoozedUntil">|null{
  if(task.status==="done"||!task.dueDate)return null;
  const start=localDate(day),end=localDate(task.dueDate);
  if(!Number.isFinite(end.getTime()))return null;
  const days=Math.round((end.getTime()-start.getTime())/86400000);
  if(days>3)return null;
  const kind=days<0?"overdue":days===0?"today":"upcoming";
  const description=days<0?"Срок прошёл":days===0?"Срок сегодня":"До срока "+days+" дн.";
  return {id:task.id+":"+task.dueDate,taskId:task.id,title:task.title||"Задача без названия",description,kind,date:task.dueDate,priority:days<0?3:days===0?2:1};
}
export function listNotifications(now=new Date()):LocalNotification[]{
  const day=dayString(now);
  const state=loadNotificationState();
  return readNotesTasks().tasks.map(task=>classify(task,day)).filter((entry):entry is NonNullable<typeof entry>=>Boolean(entry)).map(entry=>({
    ...entry,isRead:state.read.includes(entry.id),
    snoozedUntil:state.snoozed[entry.id]
  })).filter(entry=>!entry.snoozedUntil||entry.snoozedUntil<=day).sort((a,b)=>b.priority-a.priority||a.date.localeCompare(b.date));
}
export function unreadNotificationCount():number{return listNotifications().filter(x=>!x.isRead).length;}
