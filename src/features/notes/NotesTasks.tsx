import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, StickyNote, CheckSquare, LayoutGrid, List, CalendarDays,
  Clock3, Trash2, X, Pin, PinOff, ChevronRight, Check, Target,
  AlertCircle, Tags, ClipboardList, Rows3, ArrowUpDown
} from "lucide-react";
import {
  dateLabel, newId, PRIORITY_LABELS, readNotesTasks, saveNotesTasks,
  STATUS_LABELS, type NotesTasksData, type Note, type Priority,
  type Task, type TaskStatus
} from "./data";

type Area = "tasks" | "notes";
type TaskView = "board" | "list" | "matrix" | "timeline" | "calendar";
type TaskFilter = "all" | "active" | "done" | "overdue";
const statusOrder:TaskStatus[]=["todo","doing","done"];
const priorityOrder:Priority[]=["low","medium","high"];
const markDate = (value:string) => value && value < new Date().toISOString().slice(0,10);

export default function NotesTasks() {
  const [data,setData] = useState<NotesTasksData>(readNotesTasks);
  const [area,setArea] = useState<Area>("tasks");
  const [view,setView] = useState<TaskView>("board");
  const [filter,setFilter] = useState<TaskFilter>("all");
  const [query,setQuery] = useState("");
  const [selection,setSelection] = useState<{type:Area;id:string}|null>(null);
  const [creating,setCreating] = useState<Area|null>(null);
  const [newTitle,setNewTitle] = useState("");
  const [checklistText,setChecklistText] = useState("");
  const [sort,setSort] = useState<"date"|"priority"|"created">("date");
  const [month,setMonth] = useState(()=>new Date().toISOString().slice(0,7));
  const [notePreview,setNotePreview] = useState(false);
  useEffect(()=>{saveNotesTasks(data);},[data]);

  function updateTask(id:string, patch:Partial<Task>) {
    setData(prev=>({...prev,tasks:prev.tasks.map(task=>task.id===id?{...task,...patch,updatedAt:new Date().toISOString()}:task)}));
  }
  function updateNote(id:string, patch:Partial<Note>) {
    setData(prev=>({...prev,notes:prev.notes.map(note=>note.id===id?{...note,...patch,updatedAt:new Date().toISOString()}:note)}));
  }
  function createItem() {
    const name=newTitle.trim();
    if(!name)return;
    const timestamp=new Date().toISOString();
    if (creating==="tasks") {
      const task:Task={id:newId(),title:name,description:"",status:"todo",priority:"medium",dueDate:"",urgent:false,important:false,tags:[],checklist:[],createdAt:timestamp,updatedAt:timestamp};
      setData(prev=>({...prev,tasks:[...prev.tasks,task]})); setSelection({type:"tasks",id:task.id}); setArea("tasks");
    } else if (creating==="notes") {
      const note:Note={id:newId(),title:name,body:"",pinned:false,tags:[],createdAt:timestamp,updatedAt:timestamp};
      setData(prev=>({...prev,notes:[...prev.notes,note]})); setSelection({type:"notes",id:note.id}); setArea("notes");
    }
    setCreating(null);setNewTitle("");
  }
  function removeTask(task:Task) {
    if(!window.confirm("Удалить задачу «"+task.title+"»?"))return;
    setData(prev=>({...prev,tasks:prev.tasks.filter(t=>t.id!==task.id)}));setSelection(null);
  }
  function removeNote(note:Note) {
    if(!window.confirm("Удалить заметку «"+note.title+"»?"))return;
    setData(prev=>({...prev,notes:prev.notes.filter(n=>n.id!==note.id)}));setSelection(null);
  }
  const selectedTask=selection?.type==="tasks"?data.tasks.find(t=>t.id===selection.id):undefined;
  const selectedNote=selection?.type==="notes"?data.notes.find(n=>n.id===selection.id):undefined;
  const filteredTasks=useMemo(()=>{
    const text=query.toLocaleLowerCase("ru");
    const selected=data.tasks.filter(task=>{
      if(text&&!([task.title,task.description,...task.tags].join(" ").toLocaleLowerCase("ru").includes(text)))return false;
      if(filter==="active")return task.status!=="done";
      if(filter==="done")return task.status==="done";
      if(filter==="overdue")return task.status!=="done"&&markDate(task.dueDate);
      return true;
    });
    return [...selected].sort((a,b)=>{
      if(sort==="priority")return priorityOrder.indexOf(b.priority)-priorityOrder.indexOf(a.priority);
      if(sort==="created")return b.createdAt.localeCompare(a.createdAt);
      return (a.dueDate||"9999").localeCompare(b.dueDate||"9999");
    });
  },[data.tasks,filter,query,sort]);
  const filteredNotes=useMemo(()=>data.notes.filter(n=>(n.title+" "+n.body+" "+n.tags.join(" ")).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt)),[data.notes,query]);
  const openCount=data.tasks.filter(t=>t.status!=="done").length;
  const doneCount=data.tasks.filter(t=>t.status==="done").length;
  const lateCount=data.tasks.filter(t=>t.status!=="done"&&markDate(t.dueDate)).length;

  const card=(task:Task)=><button key={task.id} className={"fox-task-card"+(task.status==="done"?" done":"")} draggable onDragStart={e=>{e.dataTransfer.setData("text/fox-task",task.id);e.dataTransfer.effectAllowed="move";}} onClick={()=>setSelection({type:"tasks",id:task.id})}>
    <span className="fox-task-card-title">{task.title}</span>
    {task.description&&<span className="fox-task-description">{task.description}</span>}
    <div className="fox-task-meta"><span className={"fox-priority "+task.priority}>{PRIORITY_LABELS[task.priority]}</span>{task.dueDate&&<span className={task.status!=="done"&&markDate(task.dueDate)?"late":""}><CalendarDays size={12}/>{dateLabel(task.dueDate)}</span>}{task.checklist?.length>0&&<span><CheckSquare size={12}/>{task.checklist.filter(c=>c.done).length}/{task.checklist.length}</span>}</div>
  </button>;

  return <section className="fox-organizer">
    <div className="fox-organizer-heading">
      <div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h1>Заметки и задачи</h1><p>Все планы, идеи и дела в одном месте.</p></div>
      <button className="primary-button" onClick={()=>{setCreating(area);setNewTitle("");}}><Plus size={16}/> {area==="tasks"?"Новая задача":"Новая заметка"}</button>
    </div>
    <div className="fox-organizer-stats">
      <div><span>В работе и ожидают</span><strong>{openCount}</strong></div>
      <div><span>Завершено</span><strong>{doneCount}</strong></div>
      <div><span>Просрочено</span><strong>{lateCount}</strong></div>
      <div><span>Заметок</span><strong>{data.notes.length}</strong></div>
    </div>
    <div className="fox-organizer-content">
      <div className="fox-organizer-toolbar">
        <div className="fox-organizer-sections"><button className={area==="tasks"?"active":""} onClick={()=>{setArea("tasks");setSelection(null);}}><CheckSquare size={16}/> Задачи</button><button className={area==="notes"?"active":""} onClick={()=>{setArea("notes");setSelection(null);}}><StickyNote size={16}/> Заметки</button></div>
        <label className="fox-organizer-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по содержимому"/></label>
      </div>
      {area==="tasks" ? <>
        <div className="fox-organizer-filters">
          <div className="fox-organizer-views">
            <button className={view==="board"?"active":""} onClick={()=>setView("board")}><LayoutGrid size={15}/> Доска</button>
            <button className={view==="list"?"active":""} onClick={()=>setView("list")}><List size={15}/> Список</button>
            <button className={view==="matrix"?"active":""} onClick={()=>setView("matrix")}><Target size={15}/> Матрица</button>
            <button className={view==="timeline"?"active":""} onClick={()=>setView("timeline")}><Clock3 size={15}/> Хронология</button><button className={view==="calendar"?"active":""} onClick={()=>setView("calendar")}><CalendarDays size={15}/> Календарь</button>
          </div>
          <select aria-label="Фильтр задач" value={filter} onChange={e=>setFilter(e.target.value as TaskFilter)}><option value="all">Все задачи</option><option value="active">Активные</option><option value="done">Завершённые</option><option value="overdue">Просроченные</option></select>
          <select aria-label="Сортировка задач" value={sort} onChange={e=>setSort(e.target.value as "date"|"priority"|"created")}><option value="date">По дате</option><option value="priority">По приоритету</option><option value="created">По созданию</option></select>
        </div>
        {view==="board"&&<div className="fox-kanban">{statusOrder.map(status=><div className="fox-kanban-column" key={status} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/fox-task");if(data.tasks.some(t=>t.id===id))updateTask(id,{status});}}><div className="fox-kanban-title"><span>{STATUS_LABELS[status]}</span><small>{filteredTasks.filter(t=>t.status===status).length}</small></div><div className="fox-kanban-items">{filteredTasks.filter(t=>t.status===status).map(card)}{filteredTasks.filter(t=>t.status===status).length===0&&<div className="fox-kanban-empty">Перетащите задачу сюда</div>}</div></div>)}</div>}
        {view==="list"&&<div className="fox-task-list">{filteredTasks.map(task=><div className="fox-task-list-row" key={task.id}><input type="checkbox" checked={task.status==="done"} aria-label={"Завершить "+task.title} onChange={e=>updateTask(task.id,{status:e.target.checked?"done":"todo"})}/><button onClick={()=>setSelection({type:"tasks",id:task.id})}>{task.title}</button><span className={"fox-priority "+task.priority}>{PRIORITY_LABELS[task.priority]}</span><select value={task.status} onChange={e=>updateTask(task.id,{status:e.target.value as TaskStatus})}>{statusOrder.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select><small>{dateLabel(task.dueDate)}</small></div>)}</div>}
        {view==="matrix"&&<div className="fox-matrix">{[
          {id:"iu",important:true,urgent:true,name:"Важно и срочно",hint:"Сделать сейчас"},
          {id:"in",important:true,urgent:false,name:"Важно, не срочно",hint:"Запланировать"},
          {id:"nu",important:false,urgent:true,name:"Не важно, срочно",hint:"Решить быстрее"},
          {id:"nn",important:false,urgent:false,name:"Не важно, не срочно",hint:"Отложить"}
        ].map(q=><div className="fox-matrix-quadrant" key={q.id} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/fox-task");if(data.tasks.some(t=>t.id===id))updateTask(id,{urgent:q.urgent,important:q.important});}}><div className="fox-matrix-title"><b>{q.name}</b><span>{q.hint}</span></div><div className="fox-matrix-items">{filteredTasks.filter(t=>t.urgent===q.urgent&&t.important===q.important).map(card)}</div></div>)}</div>}
        {view==="calendar"&&<div className="fox-task-calendar">
          <div className="fox-task-calendar-head"><button onClick={()=>setMonth(m=>{const d=new Date(m+"-01T12:00:00");d.setMonth(d.getMonth()-1);return d.toISOString().slice(0,7);})}>←</button><strong>{new Date(month+"-01T12:00:00").toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</strong><button onClick={()=>setMonth(m=>{const d=new Date(m+"-01T12:00:00");d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,7);})}>→</button></div>
          <div className="fox-task-calendar-grid">{["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(day=><div className="fox-task-calendar-weekday" key={day}>{day}</div>)}{(()=>{
            const first=new Date(month+"-01T12:00:00");
            const offset=(first.getDay()+6)%7;
            const length=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
            return Array.from({length:Math.ceil((length+offset)/7)*7},(_,i)=>{
              const day=i-offset+1;
              if(day<1||day>length)return <div className="fox-task-calendar-day muted" key={"blank"+i}/>;
              const date=month+"-"+String(day).padStart(2,"0");
              const dayTasks=filteredTasks.filter(task=>task.dueDate===date);
              return <div className="fox-task-calendar-day" key={date}><span className={date===new Date().toISOString().slice(0,10)?"today":""}>{day}</span>{dayTasks.slice(0,3).map(task=><button key={task.id} className={task.status==="done"?"complete":""} onClick={()=>setSelection({type:"tasks",id:task.id})} title={task.title}>{task.title}</button>)}{dayTasks.length>3&&<small>+{dayTasks.length-3}</small>}</div>;
            });
          })()}</div>
        </div>}
        {view==="timeline"&&<div className="fox-task-chronology"><div className="fox-task-timeline-line"/>{filteredTasks.filter(t=>t.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(task=><button key={task.id} className="fox-task-timeline-event" onClick={()=>setSelection({type:"tasks",id:task.id})}><small>{dateLabel(task.dueDate)}</small><i/><strong>{task.title}</strong><span>{STATUS_LABELS[task.status]}</span></button>)}{!filteredTasks.some(t=>t.dueDate)&&<div className="fox-task-timeline-empty">Укажите сроки задач, чтобы они появились на временной линии.</div>}</div>}
        {!filteredTasks.length&&<div className="fox-organizer-empty"><ClipboardList size={29}/><h3>Задач пока нет</h3><p>Создайте первую задачу или измените условия поиска.</p><button className="outline-button" onClick={()=>{setCreating("tasks");setNewTitle("");}}><Plus size={15}/> Создать задачу</button></div>}
      </> : <div className="fox-notes-grid">{filteredNotes.map(note=><button className="fox-note-card" key={note.id} onClick={()=>setSelection({type:"notes",id:note.id})}><div>{note.pinned&&<Pin size={15}/>}<h3>{note.title}</h3></div><p>{note.body||"Откройте заметку, чтобы добавить текст."}</p><small>Изменена {new Date(note.updatedAt).toLocaleDateString("ru-RU")}</small></button>)}{!filteredNotes.length&&<div className="fox-organizer-empty"><StickyNote size={29}/><h3>Заметок пока нет</h3><p>Создайте заметку для идей, планов или черновиков.</p><button className="outline-button" onClick={()=>{setCreating("notes");setNewTitle("");}}><Plus size={15}/> Создать заметку</button></div>}</div>}
    </div>
    {creating&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setCreating(null)}><div className="dialog"><button className="close-button" onClick={()=>setCreating(null)}><X size={18}/></button><div className="dialog-icon">{creating==="tasks"?<CheckSquare size={21}/>:<StickyNote size={21}/>}</div><h2>{creating==="tasks"?"Новая задача":"Новая заметка"}</h2><p>Запись будет сохранена в этом браузере.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Введите название" value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createItem()}/></label><button className="primary-button full" disabled={!newTitle.trim()} onClick={createItem}><Plus size={16}/> Создать</button></div></div>}
    {(selectedTask||selectedNote)&&<div className="overlay settings-overlay" onMouseDown={e=>e.target===e.currentTarget&&setSelection(null)}><aside className="fox-item-editor"><div className="fox-item-editor-top"><span>{selectedTask?"ЗАДАЧА":"ЗАМЕТКА"}</span><button onClick={()=>setSelection(null)} title="Закрыть"><X size={18}/></button></div>
      {selectedTask&&<div className="fox-item-editor-body">
        <label className="fox-item-title-label">Название<input value={selectedTask.title} onChange={e=>updateTask(selectedTask.id,{title:e.target.value})}/></label>
        <label>Описание<textarea rows={5} value={selectedTask.description} onChange={e=>updateTask(selectedTask.id,{description:e.target.value})} placeholder="Подробности задачи"/></label>
        <div className="fox-item-editor-pair"><label>Статус<select value={selectedTask.status} onChange={e=>updateTask(selectedTask.id,{status:e.target.value as TaskStatus})}>{statusOrder.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label><label>Приоритет<select value={selectedTask.priority} onChange={e=>updateTask(selectedTask.id,{priority:e.target.value as Priority})}>{priorityOrder.map(p=><option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}</select></label></div>
        <label>Срок<input type="date" value={selectedTask.dueDate} onChange={e=>updateTask(selectedTask.id,{dueDate:e.target.value})}/></label>
        <div className="fox-item-editor-pair fox-task-flags"><label><input type="checkbox" checked={selectedTask.important} onChange={e=>updateTask(selectedTask.id,{important:e.target.checked})}/> Важно</label><label><input type="checkbox" checked={selectedTask.urgent} onChange={e=>updateTask(selectedTask.id,{urgent:e.target.checked})}/> Срочно</label></div>
        <label>Теги (через запятую)<input value={selectedTask.tags.join(", ")} onChange={e=>updateTask(selectedTask.id,{tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})} placeholder="Работа, личное"/></label>
        <div className="fox-checklist"><h4>Подзадачи <small>{selectedTask.checklist.filter(c=>c.done).length}/{selectedTask.checklist.length}</small></h4>{selectedTask.checklist.map(sub=><div key={sub.id}><input type="checkbox" checked={sub.done} onChange={e=>updateTask(selectedTask.id,{checklist:selectedTask.checklist.map(s=>s.id===sub.id?{...s,done:e.target.checked}:s)})}/><span>{sub.title}</span><button onClick={()=>updateTask(selectedTask.id,{checklist:selectedTask.checklist.filter(s=>s.id!==sub.id)})}><X size={13}/></button></div>)}<div className="fox-add-subtask"><input placeholder="Новая подзадача" value={checklistText} onChange={e=>setChecklistText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&checklistText.trim()){updateTask(selectedTask.id,{checklist:[...selectedTask.checklist,{id:newId(),title:checklistText.trim(),done:false}]});setChecklistText("");}}}/><button onClick={()=>{if(!checklistText.trim())return;updateTask(selectedTask.id,{checklist:[...selectedTask.checklist,{id:newId(),title:checklistText.trim(),done:false}]});setChecklistText("");}}><Plus size={16}/></button></div></div>
        <button className="fox-remove-item" onClick={()=>removeTask(selectedTask)}><Trash2 size={15}/> Удалить задачу</button>
      </div>}
      {selectedNote&&<div className="fox-item-editor-body">
        <label className="fox-item-title-label">Название<input value={selectedNote.title} onChange={e=>updateNote(selectedNote.id,{title:e.target.value})}/></label>
        <div className="fox-note-tools"><button onClick={()=>updateNote(selectedNote.id,{pinned:!selectedNote.pinned})}>{selectedNote.pinned?<PinOff size={15}/>:<Pin size={15}/>} {selectedNote.pinned?"Открепить":"Закрепить"}</button><span>Автосохранение</span></div>
        <div className="fox-note-edit-controls"><button className={!notePreview?"active":""} onClick={()=>setNotePreview(false)}>Редактировать</button><button className={notePreview?"active":""} onClick={()=>setNotePreview(true)}>Просмотр</button></div>{notePreview?<div className="fox-note-preview">{selectedNote.body.split("\n").map((line,i)=><p key={i}>{line||" "}</p>)}</div>:<label>Текст<textarea className="fox-note-body-input" value={selectedNote.body} onChange={e=>updateNote(selectedNote.id,{body:e.target.value})} placeholder="Начните писать..."/></label>}
        <label>Теги (через запятую)<input value={selectedNote.tags.join(", ")} onChange={e=>updateNote(selectedNote.id,{tags:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>
        <button className="fox-remove-item" onClick={()=>removeNote(selectedNote)}><Trash2 size={15}/> Удалить заметку</button>
      </div>}
    </aside></div>}
  </section>;
}
