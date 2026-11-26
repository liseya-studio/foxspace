import {useMemo,useState} from "react";
import {CalendarDays, Columns3, LayoutList, Plus, Search} from "lucide-react";
import {platforms,type Publication,type PublicationTemplate} from "../data";
import {publicationDates,publicationStatuses} from "./model";
import "./content.css";

type Period={start:string;end:string};
type CalendarDay={date:string;inPeriod:boolean};
type View="list"|"calendar"|"board";
type Props={
  publications:Publication[];
  templates:PublicationTemplate[];
  period:Period;
  days:CalendarDay[];
  onCreate:(day?:string,template?:PublicationTemplate)=>void;
  onEdit:(post:Publication)=>void;
  onRemove:(id:string)=>void;
  onRemoveTemplate:(id:string)=>void;
};
type CalendarEntry={post:Publication;timestamp:string;platforms:string[]};
const stages=Object.entries(publicationStatuses) as [Publication["status"],string][];
const views=[{id:"list",label:"Список",icon:LayoutList},{id:"calendar",label:"Календарь",icon:CalendarDays},{id:"board",label:"По статусам",icon:Columns3}] as const;

function PostCard({post,onEdit,onRemove}:{post:Publication;onEdit:()=>void;onRemove?:()=>void}){
  const targetNames=[...new Set(post.variants.map(variant=>variant.platform))];
  return <article className={"fox-plan-post status-"+post.status}>
    <button type="button" className="fox-plan-post-title" onClick={onEdit}>{post.title}</button>
    <div className="fox-plan-meta">
      {[post.series,post.rubric,post.format].filter(Boolean).map((value,index)=><span key={index}>{value}</span>)}
      {post.audience==="restricted"&&<span>{post.tier?.trim()||"По подписке"}</span>}
    </div>
    {targetNames.length>0&&<div className="fox-plan-platforms">{targetNames.map(name=><span key={name}>{name}</span>)}</div>}
    {onRemove&&<div className="fox-plan-post-actions"><button type="button" onClick={onEdit}>Изменить</button><button type="button" onClick={onRemove}>Удалить</button></div>}
  </article>;
}

export default function ContentPlan({publications,templates,period,days,onCreate,onEdit,onRemove,onRemoveTemplate}:Props){
  const [view,setView]=useState<View>("list");
  const [search,setSearch]=useState("");
  const [platform,setPlatform]=useState("");
  const [status,setStatus]=useState("");
  const [rubric,setRubric]=useState("");
  const [allDates,setAllDates]=useState(false);
  const rubrics=[...new Set(publications.map(item=>item.rubric?.trim()).filter((value):value is string=>Boolean(value)))].sort((a,b)=>a.localeCompare(b,"ru"));
  const inPeriod=(value:string)=>value.slice(0,10)>=period.start&&value.slice(0,10)<=period.end;

  const matches=useMemo(()=>{
    const term=search.trim().toLocaleLowerCase("ru");
    return publications.filter(post=>(!status||post.status===status)&&(!rubric||post.rubric?.trim()===rubric)&&(!platform||post.variants.some(variant=>variant.platform===platform))
      &&(!term||[post.title,post.text,post.series,post.rubric,post.format,...(post.tags??[]),...post.variants.map(variant=>variant.text)]
        .join(" ").toLocaleLowerCase("ru").includes(term)));
  },[publications,platform,rubric,search,status]);

  const scheduled=matches.flatMap(post=>publicationDates(post,platform).map(entry=>({...entry,post})))
    .sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const visible=allDates&&view!=="calendar"?matches:[...new Map(scheduled.filter(entry=>inPeriod(entry.timestamp)).map(entry=>[entry.post.id,entry.post])).values()];
  const byDay=new Map<string,CalendarEntry[]>();
  for(const item of scheduled){
    const day=item.timestamp.slice(0,10);
    const entries=byDay.get(day)??[];
    entries.push(item);
    byDay.set(day,entries);
  }
  return <div className="ops-panel fox-content-plan">
    <header>
      <div><h2>Контент-календарь</h2><small>{visible.length} публикаций {allDates&&view!=="calendar"?"за всё время":"за период"}</small></div>
      <button type="button" className="primary-button compact" onClick={()=>onCreate()}><Plus size={15}/> Новая публикация</button>
    </header>
    <div className="fox-plan-toolbar">
      <div className="fox-plan-views" aria-label="Вид контент-плана">{views.map(item=><button type="button" key={item.id} aria-pressed={view===item.id} onClick={()=>setView(item.id)}><item.icon size={15}/>{item.label}</button>)}</div>
      {templates.length>0&&<details className="fox-plan-templates"><summary>Шаблоны</summary><ul>{templates.map(template=><li key={template.id}>
        <button type="button" onClick={()=>onCreate(undefined,template)}>{template.name}</button>
        <button type="button" aria-label={"Удалить шаблон "+template.name} onClick={()=>onRemoveTemplate(template.id)}>Удалить</button>
      </li>)}</ul></details>}
    </div>
    <div className="fox-plan-filters">
      <label><Search size={14}/> Поиск по контенту<input type="search" value={search} placeholder="Серия, рубрика, текст или тег" onChange={event=>setSearch(event.target.value)}/></label>
      <label>Площадка<select value={platform} onChange={event=>setPlatform(event.target.value)}><option value="">Все площадки</option>{platforms.map(name=><option key={name}>{name}</option>)}</select></label>
      <label>Статус<select value={status} onChange={event=>setStatus(event.target.value)}><option value="">Все статусы</option>{stages.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
      {rubrics.length>0&&<label>Рубрика<select value={rubric} onChange={event=>setRubric(event.target.value)}><option value="">Все рубрики</option>{rubrics.map(name=><option key={name}>{name}</option>)}</select></label>}
      {view!=="calendar"&&<label className="fox-plan-all-dates"><input type="checkbox" checked={allDates} onChange={event=>setAllDates(event.target.checked)}/> Все даты</label>}
    </div>
    {view==="list"&&<div className="fox-plan-list">
      {visible.map(post=><div key={post.id} className="fox-plan-list-row">
        <div><time>{(publicationDates(post,platform).find(entry=>allDates||inPeriod(entry.timestamp))?.timestamp??post.date).replace("T"," ")}</time><small>{publicationStatuses[post.status]}</small></div>
        <PostCard post={post} onEdit={()=>onEdit(post)} onRemove={()=>onRemove(post.id)}/>
      </div>)}
    </div>}
    {view==="calendar"&&<div className="ops-calendar"><div className="ops-calendar-weekdays">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><span key={day}>{day}</span>)}</div>
      <div className="ops-calendar-grid">{days.map(day=><div className={"ops-calendar-day"+(!day.inPeriod?" outside":"")} key={day.date}>
        <div className="fox-plan-calendar-heading"><span className="ops-calendar-date">{Number(day.date.slice(-2))}</span><button type="button" aria-label={"Добавить публикацию "+day.date} onClick={()=>onCreate(day.date)}><Plus size={14}/></button></div>
        {(byDay.get(day.date)??[]).map(({post,timestamp,platforms})=><button type="button" key={post.id+":"+timestamp} className={"ops-calendar-post status-"+post.status} onClick={()=>onEdit(post)}><b>{timestamp.slice(11,16)}</b><span>{post.title}{platforms.length?" · "+platforms.join(", "):""}</span></button>)}
      </div>)}</div></div>}
    {view==="board"&&<div className="fox-plan-board">
      {stages.filter(([id])=>!status||status===id).map(([id,label])=>{
        const cards=visible.filter(post=>post.status===id);
        return <section key={id} className="fox-plan-column"><h3>{label} <small>{cards.length}</small></h3>
          {cards.map(post=><PostCard key={post.id} post={post} onEdit={()=>onEdit(post)}/>)}
        </section>;
      })}
    </div>}
    {!visible.length&&view!=="calendar"&&<p className="fox-plan-empty">Публикаций по этим условиям нет.</p>}
  </div>;
}
