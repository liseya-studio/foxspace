import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, List } from "lucide-react";
import { dateLabel, STATUS_LABELS, type Task } from "./data";

type View = "month" | "week" | "day" | "schedule";
type Props = { tasks: Task[]; onOpen: (id:string)=>void; onReschedule: (id:string,date:string)=>void };
const z = (n:number)=>String(n).padStart(2,"0");
const stamp=(date:Date)=>date.getFullYear()+"-"+z(date.getMonth()+1)+"-"+z(date.getDate());
const fromStamp=(value:string)=>new Date(value+"T12:00:00");
const shift=(date:Date,days:number)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d;};
const monday=(date:Date)=>shift(date,-(date.getDay()+6)%7);
const dayLabels=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
export default function TaskCalendar({tasks,onOpen,onReschedule}:Props){
  const [view,setView]=useState<View>("month");
  const [anchor,setAnchor]=useState(()=>stamp(new Date()));
  const date=fromStamp(anchor);
  const dateTasks=useMemo(()=>tasks.filter(t=>t.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)),[tasks]);
  const monthStart=new Date(date.getFullYear(),date.getMonth(),1,12);
  const first=monday(monthStart);
  const cells=Array.from({length:42},(_,index)=>shift(first,index));
  const week=Array.from({length:7},(_,index)=>shift(monday(date),index));
  function navigate(direction:number){
    let d=new Date(date);
    if(view==="month")d=new Date(date.getFullYear(),date.getMonth()+direction,1,12);
    else if(view==="week")d=shift(d,direction*7);
    else if(view==="day")d=shift(d,direction);
    else d=new Date(date.getFullYear(),date.getMonth()+direction,1,12);
    setAnchor(stamp(d));
  }
  function tasksOn(day:Date){return dateTasks.filter(t=>t.dueDate===stamp(day));}
  function event(task:Task){
    return <button key={task.id} draggable onDragStart={e=>{e.dataTransfer.setData("text/fox-task",task.id);e.dataTransfer.effectAllowed="move";}} className={"fox-task-calendar-event"+(task.status==="done"?" complete":"")} onClick={()=>onOpen(task.id)} title={task.title}><span>{task.title}</span></button>;
  }
  function dropTo(event:React.DragEvent<HTMLDivElement>,dateValue:string){
    event.preventDefault();
    const id=event.dataTransfer.getData("text/fox-task");
    if(tasks.some(t=>t.id===id))onReschedule(id,dateValue);
  }
  return <section className="fox-task-cal">
    <div className="fox-task-cal-toolbar">
      <div className="fox-task-cal-nav"><button title="Предыдущий период" onClick={()=>navigate(-1)}><ChevronLeft size={16}/></button><button title="Текущая дата" onClick={()=>setAnchor(stamp(new Date()))}>Сегодня</button><button title="Следующий период" onClick={()=>navigate(1)}><ChevronRight size={16}/></button><strong>{view==="day"?dateLabel(anchor):view==="week"?(dateLabel(stamp(week[0]))+" — "+dateLabel(stamp(week[6]))):date.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</strong></div>
      <div className="fox-task-cal-switch">{(["day","week","month","schedule"] as View[]).map(mode=><button key={mode} className={view===mode?"active":""} onClick={()=>setView(mode)}>{({day:"День",week:"Неделя",month:"Месяц",schedule:"Расписание"} as Record<View,string>)[mode]}</button>)}</div>
    </div>
    {view==="month"&&<div className="fox-task-calendar-grid">{dayLabels.map(day=><div className="fox-task-calendar-weekday" key={day}>{day}</div>)}{cells.map(day=><div key={stamp(day)} onDragOver={e=>e.preventDefault()} onDrop={e=>dropTo(e,stamp(day))} className={"fox-task-calendar-day"+(day.getMonth()!==date.getMonth()?" muted":"")}><span className={stamp(day)===stamp(new Date())?"today":""}>{day.getDate()}</span>{tasksOn(day).slice(0,3).map(event)}{tasksOn(day).length>3&&<small>+{tasksOn(day).length-3}</small>}</div>)}</div>}
    {(view==="week"||view==="day")&&<div className={"fox-task-cal-days "+(view==="day"?"one":"")}>{(view==="day"?[date]:week).map(day=><div key={stamp(day)} className="fox-task-cal-day" onDragOver={e=>e.preventDefault()} onDrop={e=>dropTo(e,stamp(day))}><div className="fox-task-cal-day-label"><b>{dayLabels[(day.getDay()+6)%7]}</b><span>{day.getDate()}</span></div><div className="fox-task-cal-day-events">{tasksOn(day).map(event)}{tasksOn(day).length===0&&<small>Нет задач</small>}</div></div>)}</div>}
    {view==="schedule"&&<div className="fox-task-cal-agenda">{dateTasks.filter(task=>task.dueDate.slice(0,7)===anchor.slice(0,7)).length===0?<div className="fox-task-cal-no-events"><CalendarDays size={25}/><span>На выбранный месяц нет задач со сроками.</span></div>:Array.from(new Set(dateTasks.filter(task=>task.dueDate.slice(0,7)===anchor.slice(0,7)).map(task=>task.dueDate))).map(day=><div className="fox-task-cal-agenda-day" key={day}><strong>{dateLabel(day)}</strong><div>{dateTasks.filter(task=>task.dueDate===day).map(task=><button key={task.id} onClick={()=>onOpen(task.id)}><span>{task.title}</span><small>{STATUS_LABELS[task.status]}</small></button>)}</div></div>)}</div>}
    <div className="fox-task-cal-tip"><List size={14}/> Перетаскивайте задачи между днями, чтобы изменить срок.</div>
  </section>;
}
