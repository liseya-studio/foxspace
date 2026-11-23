import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, FolderOpen, Image as ImageIcon } from "lucide-react";
import type { TableData, TableRow } from "./values";

type Props = {
  table: TableData;
  rows: TableRow[];
  onOpen: (id:string)=>void;
  onUpdate: (rowId:string,columnId:string,value:string)=>void;
};
const titleFor=(table:TableData,row:TableRow)=>String(row.cells[table.columns[0]?.id??""]??"Запись")||"Без названия";
const statusFor=(value:unknown)=>String(value??"")||"Без статуса";

export function GalleryView({table,rows,onOpen}:Omit<Props,"onUpdate">){
  const description=table.columns.find(column=>column.type==="text"&&column.id!==table.columns[0]?.id);
  const photo=table.columns.find(column=>column.type==="image");
  const statuses=table.columns.filter(column=>column.type==="select").slice(0,2);
  return <div className="fox-db-gallery" aria-label="Галерея записей">
    {rows.map(row=><button type="button" className="fox-db-gallery-card" key={row.id} onClick={()=>onOpen(row.id)}>
      {photo&&<div className="fox-db-photo-placeholder"><ImageIcon size={20}/><span>{row.cells[photo.id]?"Изображение прикреплено":"Без изображения"}</span></div>}
      <strong>{titleFor(table,row)}</strong>
      {description&&<p>{String(row.cells[description.id]??"").slice(0,180)}</p>}
      <div className="fox-db-card-tags">{statuses.map(column=><span key={column.id}>{statusFor(row.cells[column.id])}</span>)}</div>
      <small>Открыть запись</small>
    </button>)}
    {!rows.length&&<div className="table-no-results">Нет записей для галереи</div>}
  </div>;
}

export function KanbanView({table,rows,onOpen,onUpdate}:Props){
  const statusColumn=table.columns.find(column=>column.type==="select");
  if(!statusColumn)return <div className="fox-db-view-empty"><FolderOpen size={25}/><strong>Добавьте поле «Выбор»</strong><p>Статусы карточек берутся из выбранного поля таблицы.</p></div>;
  const buckets=[...new Set([...(statusColumn.options??[]),...rows.map(row=>statusFor(row.cells[statusColumn.id]))])];
  return <div className="fox-db-kanban" aria-label="Канбан-доска">
    {buckets.map(bucket=><section key={bucket} className="fox-db-kanban-lane">
      <header><strong>{bucket}</strong><span>{rows.filter(row=>statusFor(row.cells[statusColumn.id])===bucket).length}</span></header>
      {rows.filter(row=>statusFor(row.cells[statusColumn.id])===bucket).map(row=><div key={row.id} className="fox-db-kanban-card">
        <button type="button" onClick={()=>onOpen(row.id)}>{titleFor(table,row)}</button>
        <select aria-label={"Статус "+titleFor(table,row)} value={statusFor(row.cells[statusColumn.id])} onChange={e=>onUpdate(row.id,statusColumn.id,e.target.value)}>
          {buckets.map(option=><option key={option}>{option}</option>)}
        </select>
      </div>)}
    </section>)}
  </div>;
}

export function CalendarView({table,rows,onOpen}:Omit<Props,"onUpdate">){
  const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const dateColumn=table.columns.find(column=>column.type==="date");
  const byDay=useMemo(()=>{
    const result=new Map<string,TableRow[]>();
    if(!dateColumn)return result;
    rows.forEach(row=>{
      const value=String(row.cells[dateColumn.id]??"").slice(0,10);
      if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return;
      result.set(value,[...(result.get(value)??[]),row]);
    });
    return result;
  },[rows,dateColumn]);
  if(!dateColumn)return <div className="fox-db-view-empty"><CalendarDays size={25}/><strong>Добавьте поле типа «Дата»</strong><p>Календарь показывает записи по дате из таблицы.</p></div>;
  const year=month.getFullYear(),currentMonth=month.getMonth();
  const first=(new Date(year,currentMonth,1).getDay()+6)%7;
  const days=new Date(year,currentMonth+1,0).getDate();
  const monday=new Date(year,currentMonth,1-first);
  const cells=Array.from({length:Math.ceil((first+days)/7)*7},(_,index)=>{
    const date=new Date(monday.getFullYear(),monday.getMonth(),monday.getDate()+index);
    const key=[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
    return {date,key,records:byDay.get(key)??[],inMonth:date.getMonth()===currentMonth};
  });
  return <section className="fox-db-calendar" aria-label="Календарь записей">
    <header><strong>{month.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</strong><div><button title="Предыдущий месяц" onClick={()=>setMonth(new Date(year,currentMonth-1,1))}><ChevronLeft size={17}/></button><button onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Сегодня</button><button title="Следующий месяц" onClick={()=>setMonth(new Date(year,currentMonth+1,1))}><ChevronRight size={17}/></button></div></header>
    <div className="fox-db-calendar-grid">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><div key={day} className="fox-db-weekday">{day}</div>)}
    {cells.map(cell=><div key={cell.key} className={"fox-db-calendar-day"+(!cell.inMonth?" outside":"")}><span>{cell.date.getDate()}</span>{cell.records.slice(0,3).map(row=><button type="button" key={row.id} title={titleFor(table,row)} onClick={()=>onOpen(row.id)}>{titleFor(table,row)}</button>)}{cell.records.length>3&&<small>+{cell.records.length-3}</small>}</div>)}</div>
  </section>;
}
