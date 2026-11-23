import { useEffect, useMemo, useRef, useState } from "react";
import {GRID_KEY,readGridStore,reconcileGrid,reposition,updateGridSettings,nextSlot,type GridLayout,type Rect} from "./gridLayout";
import { aggregateRows, filterRows, formatCell, valueForColumn, type Aggregate, type RowFilter, type TableData } from "../tables/values";
import { readNotesTasks, STATUS_LABELS, dateLabel, type NotesTasksData, type TaskStatus } from "../notes/data";
import WorldTravelMap from "./WorldTravelMap";
import FinanceWidget,{type FinanceKind} from "./FinanceWidget";
import {
  Plus, Settings2, LayoutGrid, Table2, BarChart3, TrendingUp,
  AlignLeft, List, Target, GripVertical, Trash2, X, Database,
  ChevronsRight, PanelRightOpen, Palette, SlidersHorizontal, Download, Upload
} from "lucide-react";

export type EditorTable = TableData;
type WidgetType = "finance" | "recordcards" | "worldmap" | "datecount" | "taskcount" | "tasklist" | "noteslist" | "metric" | "counter" | "progress" | "bars" | "line" | "donut" | "timeline" | "table" | "list" | "text" | "heading" | "divider";
type EditorWidget = {
  id: string; type: WidgetType; title: string; tableId?: string; startDate?: string; financeKind?:FinanceKind; financeRow?:number; financeColumn?:number; financeRowSpan?:number; financeBackground?: "mountains"|"sunset"|"plain";
  columnId?: string; labelColumnId?: string; target?: number;
  body?: string; width: number; height: number; accent?: string;
  aggregate?: Aggregate; filter?: RowFilter; limit?: number; hideTitle?: boolean; taskStatus?: TaskStatus | "all";
};
type WidgetStore = Record<string, EditorWidget[]>;
type SettingsTab = "data" | "appearance" | "behavior";
type LibraryTab = "types" | "templates";
type Props = {
  screenId: string;
  editMode: boolean;
  onDoneEditing: () => void;
  tables: EditorTable[];
  tableId?: string;
  onTableChange: (id: string) => void;
  onOpenTables: () => void;
  onCreateTable: () => void;
};
const STORAGE = "fox-editor-widgets-v1";
const catalog: { type: WidgetType; title: string; description: string; icon: typeof LayoutGrid; needsTable: boolean }[] = [
  { type:"finance",title:"Финансовая карточка",description:"Показатели, категории и списки финансов",icon:Target,needsTable:false },
  { type:"worldmap",title:"Интерактивная карта",description:"Страны мира, флаги и посещённые города",icon:LayoutGrid,needsTable:false },
  { type:"datecount",title:"Дни вместе",description:"Счётчик дней от выбранной даты",icon:Target,needsTable:false },
  { type:"recordcards",title:"Карточки персонажей",description:"Досье, характер и связи персонажей",icon:AlignLeft,needsTable:true },
  { type: "taskcount", title: "Количество задач", description: "Счётчик задач по статусу", icon: Target, needsTable: false },
  { type: "tasklist", title: "Задачи", description: "Список задач с дедлайнами", icon: List, needsTable: false },
  { type: "noteslist", title: "Заметки", description: "Последние сохранённые заметки", icon: AlignLeft, needsTable: false },
  { type: "metric", title: "Показатель", description: "Сумма, среднее, максимум и минимум", icon: TrendingUp, needsTable: true },
  { type: "counter", title: "Счётчик записей", description: "Количество записей по фильтру", icon: Database, needsTable: true },
  { type: "progress", title: "Прогресс", description: "Значение относительно цели", icon: Target, needsTable: true },
  { type: "bars", title: "Столбчатый график", description: "Сравнение записей по числу", icon: BarChart3, needsTable: true },
  { type: "line", title: "Линейный график", description: "Динамика числового поля", icon: TrendingUp, needsTable: true },
  { type: "donut", title: "Круговая диаграмма", description: "Распределение записей по категории", icon: Target, needsTable: true },
  { type: "timeline", title: "Хронология", description: "Единая временная линия событий", icon: LayoutGrid, needsTable: true },
  { type: "table", title: "Таблица", description: "Все записи в компактном виде", icon: Table2, needsTable: true },
  { type: "list", title: "Список", description: "Последние записи из таблицы", icon: List, needsTable: true },
  { type: "text", title: "Текст", description: "Произвольная заметка", icon: AlignLeft, needsTable: false },
  { type: "heading", title: "Заголовок", description: "Крупный заголовок раздела", icon: AlignLeft, needsTable: false },
  { type: "divider", title: "Разделитель", description: "Визуально отделить группы", icon: LayoutGrid, needsTable: false },
];
const templates = [
  { title: "Мои дела", description: "Счётчик и список задач", types: ["taskcount", "tasklist"] as WidgetType[] },
  { title: "Заметки и задачи", description: "Список задач и заметок", types: ["tasklist", "noteslist"] as WidgetType[] },
  { title: "Финансовая сводка", description: "Показатель + график", types: ["metric", "bars", "donut"] as WidgetType[] },
  { title: "Контроль цели", description: "Показатель + прогресс", types: ["metric", "progress"] as WidgetType[] },
  { title: "Реестр проекта", description: "Список + таблица", types: ["list", "table"] as WidgetType[] },
];
const emptyStore = (): WidgetStore => {
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as WidgetStore; }
  catch { return {}; }
};
const newId = () => crypto.randomUUID();
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);

function WidgetPreview({ widget, table, tables, organizer, onConfigure, editMode }: { widget: EditorWidget; table?: EditorTable; tables: EditorTable[]; organizer: NotesTasksData; onConfigure: () => void; editMode: boolean }) {
  const maxItems = Math.max(1, Math.min(30, widget.limit ?? 8));
  if(widget.type==="finance")return <FinanceWidget kind={widget.financeKind??"balance"} tables={tables} background={widget.financeBackground??"mountains"}/>;
  if(widget.type==="worldmap")return <WorldTravelMap table={table}/>;
  if(widget.type==="datecount"){
    const start=widget.startDate?new Date(widget.startDate+"T00:00:00"):null;
    const valid=Boolean(start&&!Number.isNaN(start.getTime())&&start.getTime()<=Date.now());
    const today=new Date();
    const days=valid&&start?Math.floor((Date.UTC(today.getFullYear(),today.getMonth(),today.getDate())-Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()))/86400000)+1:null;
    return <div className="fox-widget-kpi fox-widget-datecount"><strong>{days===null?"—":fmt(days)}</strong><span>{days===null?"Выберите дату начала в настройках":"дней вместе · с "+start!.toLocaleDateString("ru-RU")}</span></div>;
  }
  if (widget.type === "taskcount" || widget.type === "tasklist") {
    const tasks = organizer.tasks.filter(task => !widget.taskStatus || widget.taskStatus==="all" || task.status===widget.taskStatus);
    if (widget.type === "taskcount") return <div className="fox-widget-kpi"><strong>{tasks.length}</strong><span>{widget.taskStatus&&widget.taskStatus!=="all"?STATUS_LABELS[widget.taskStatus]:"Всего задач"}</span></div>;
    return <div className="fox-widget-list">{tasks.slice(0,maxItems).map(task=><div key={task.id}><span className={"fox-priority "+task.priority}>{STATUS_LABELS[task.status]}</span><strong>{task.title}</strong><small>{task.dueDate?dateLabel(task.dueDate):"Без срока"}</small></div>)}{!tasks.length&&<div className="fox-widget-empty">Задач пока нет. Добавьте их в «Заметки и задачи».</div>}</div>;
  }
  if (widget.type === "noteslist") {
    const notes=[...organizer.notes].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt));
    return <div className="fox-widget-list">{notes.slice(0,maxItems).map(note=><div key={note.id}><span>✎</span><strong>{note.title}</strong><small>{new Date(note.updatedAt).toLocaleDateString("ru-RU")}</small></div>)}{!notes.length&&<div className="fox-widget-empty">Заметок пока нет.</div>}</div>;
  }
  if (widget.type === "text") return <div className="fox-widget-text">{widget.body?.trim() || "Добавьте текст в параметрах виджета."}</div>;
  if (widget.type === "heading") return <div className="fox-widget-section-title">{widget.body?.trim() || widget.title}</div>;
  if (widget.type === "divider") return <div className="fox-widget-divider"/>;
  if (!table) return <div className="fox-widget-empty fox-widget-connect"><Database size={22}/><strong>Подключите данные</strong><span>Выберите таблицу для «{widget.title}».</span>{editMode&&<button type="button" onClick={event=>{event.stopPropagation();onConfigure();}}>Выбрать источник</button>}</div>;
  const numbers = table.columns.filter(c => c.type === "number" || c.type === "formula");
  const numberCol = numbers.find(c => c.id === widget.columnId) ?? numbers[0];
  const textCol = table.columns.find(c => c.id === widget.labelColumnId) ?? table.columns.find(c => c.type === "text") ?? table.columns[0];
  const rows = filterRows(table.rows, table, tables, widget.filter ?? {});
  const value = (row: EditorTable["rows"][number], col: EditorTable["columns"][number]) => valueForColumn(row, col, tables);
  if(widget.type==="recordcards"){
    const field=(row:EditorTable["rows"][number],...names:string[])=>{
      const column=table.columns.find(c=>names.some(n=>c.name.toLocaleLowerCase("ru")===n.toLocaleLowerCase("ru")));
      return column?String(value(row,column)??"").trim():"";
    };
    return <div className="fox-character-grid">{rows.slice(0,maxItems).map(row=>{
      const name=field(row,"Имя","Имя персонажа","Название")||"Без имени";
      const work=field(row,"Произведение","Фанфик","Работа");
      const role=field(row,"Роль","Амплуа");
      const traits=field(row,"Характер","Описание");
      const motivation=field(row,"Мотивация");
      const relations=field(row,"Связи","Отношения");
      return <article className="fox-character-card" key={row.id}><div className="fox-character-avatar">{name.slice(0,1).toLocaleUpperCase("ru")}</div><div className="fox-character-info"><h4>{name}</h4>{work&&<small>{work}</small>}{role&&<span>{role}</span>}</div>{traits&&<p>{traits}</p>}{motivation&&<p><b>Мотивация:</b> {motivation}</p>}{relations&&<p><b>Связи:</b> {relations}</p>}</article>;
    })}{!rows.length&&<div className="fox-widget-empty">Заполните таблицу «Персонажи», чтобы здесь появились карточки с характерами, ролями и связями.</div>}</div>;
  }
  if (widget.type === "metric" || widget.type === "counter" || widget.type === "progress") {
    const mode = widget.type === "counter" ? "count" : widget.aggregate ?? "sum";
    const total = aggregateRows(rows, numberCol, tables, mode);
    if (!numberCol && mode !== "count") return <div className="fox-widget-empty">Для показателя нужна числовая колонка.</div>;
    if (widget.type === "metric" || widget.type === "counter") return <div className="fox-widget-kpi"><strong>{fmt(total)}</strong><span>{mode === "count" ? "Количество записей" : (numberCol?.name ?? "Данные") + " · " + ({sum:"Сумма",average:"Среднее",min:"Минимум",max:"Максимум"} as Record<string,string>)[mode]}</span></div>;
    const target = Math.max(1, widget.target ?? 100);
    const percent = Math.max(0, Math.min(100, total / target * 100));
    return <div className="fox-widget-progress"><div className="fox-widget-progress-value"><strong>{fmt(total)}</strong><span>из {fmt(target)}</span></div><div className="fox-progress-track"><div style={{width:percent+"%", background: widget.accent || "var(--accent)"}}/></div><small>{fmt(total/target*100)}% от цели</small></div>;
  }
  if (widget.type === "bars") {
    if (!numberCol) return <div className="fox-widget-empty">Для графика нужна числовая колонка.</div>;
    const sample = rows.slice(0, maxItems);
    if (!sample.length) return <div className="fox-widget-empty">Добавьте записи в таблицу.</div>;
    const vals = sample.map(row => Number(value(row, numberCol)) || 0);
    const max = Math.max(1, ...vals.map(Math.abs));
    return <div className="fox-widget-bars">{sample.map((row, i) => <div className="fox-widget-bar-row" key={row.id}><span title={String(textCol ? value(row,textCol) ?? "" : "")}>{String(textCol ? value(row,textCol) ?? "Запись "+(i+1) : "Запись "+(i+1))}</span><div className="fox-widget-bar-track"><div style={{width:(Math.abs(vals[i])/max*100)+"%",background:widget.accent||"var(--accent)"}}/></div><b>{fmt(vals[i])}</b></div>)}</div>;
  }
  if (widget.type === "line") {
    if (!numberCol) return <div className="fox-widget-empty">Выберите числовую колонку.</div>;
    const data = rows.slice(0, maxItems).map(row => Number(value(row,numberCol)) || 0);
    if (!data.length) return <div className="fox-widget-empty">Для графика нужны записи.</div>;
    const min = Math.min(...data), max = Math.max(...data), spread = Math.max(1, max-min);
    const points = data.map((value,i) => (10 + (i/Math.max(1,data.length-1))*280).toFixed(1)+","+(110-(value-min)/spread*90).toFixed(1)).join(" ");
    return <div className="fox-widget-line"><svg viewBox="0 0 300 130" role="img" aria-label="График значений"><path d="M10 20H290M10 65H290M10 110H290" fill="none" stroke="currentColor" strokeOpacity=".1"/><polyline points={points} fill="none" stroke={widget.accent||"var(--accent)"} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>{data.map((value,i)=><circle key={i} cx={10+(i/Math.max(1,data.length-1))*280} cy={110-(value-min)/spread*90} r="3.3" fill={widget.accent||"var(--accent)"}/>)}</svg><div className="fox-widget-line-caption"><span>{fmt(min)} мин.</span><span>{fmt(max)} макс.</span></div></div>;
  }
  if (widget.type === "donut") {
    const groupCol = table.columns.find(col=>col.id===widget.labelColumnId) ?? table.columns.find(col=>col.type==="select"||col.type==="text");
    if (!groupCol) return <div className="fox-widget-empty">Выберите поле для группировки.</div>;
    const counts = new Map<string, number>();
    rows.forEach(row=>{const label=String(value(row,groupCol)??"Без значения")||"Без значения";counts.set(label,(counts.get(label)||0)+1);});
    const palette = ["#f06432","#4779d5","#388b69","#8864c8","#d1a34a","#c96b93"];
    let offset=0;
    const gradient = Array.from(counts.values()).map((count,i)=>{const start=offset;offset+=count/Math.max(1,rows.length)*100;return palette[i%palette.length]+" "+start+"% "+offset+"%";}).join(",");
    return <div className="fox-widget-donut"><div className="fox-donut-ring" style={{background:gradient?"conic-gradient("+gradient+")":"var(--canvas)"}}><div><strong>{rows.length}</strong><small>записей</small></div></div><div className="fox-donut-legend">{Array.from(counts.entries()).slice(0,6).map(([name,count],i)=><div key={name}><i style={{background:palette[i%palette.length]}}/><span title={name}>{name}</span><b>{count}</b></div>)}</div></div>;
  }
  if (widget.type === "timeline") {
    const dateCol = table.columns.find(col=>col.id===widget.columnId&&col.type==="date") ?? table.columns.find(col=>col.type==="date");
    if (!dateCol) return <div className="fox-widget-empty">Для хронологии нужно поле «Дата».</div>;
    const dated = rows.filter(row=>/^\d{4}-\d{2}-\d{2}/.test(String(value(row,dateCol)??""))).sort((a,b)=>String(value(a,dateCol)).localeCompare(String(value(b,dateCol)))).slice(0,maxItems);
    if (!dated.length) return <div className="fox-widget-empty">Пока нет событий с датой.</div>;
    return <div className="fox-widget-timeline"><div className="fox-timeline-line"/>{dated.map((row,i)=><div key={row.id} className="fox-timeline-event"><span className="fox-timeline-date">{new Date(String(value(row,dateCol))+"T00:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</span><i style={{borderColor:widget.accent||"var(--accent)"}}/><strong title={String(row.cells[textCol?.id]??"")}>{String(row.cells[textCol?.id]??"Событие "+(i+1))}</strong></div>)}</div>;
  }
  if (widget.type === "list") return <div className="fox-widget-list">{rows.slice(0, maxItems).map((row,i) => <div key={row.id}><span>{String(i+1).padStart(2,"0")}</span><strong>{String(textCol ? value(row,textCol) ?? "Запись" : "Запись")}</strong>{numberCol && <small>{fmt(Number(value(row,numberCol))||0)}</small>}</div>)}{!rows.length&&<div className="fox-widget-empty">Записей пока нет</div>}</div>;
  return <div className="fox-widget-table-scroll"><table><thead><tr>{table.columns.slice(0,5).map(c=><th key={c.id}>{c.name}</th>)}</tr></thead><tbody>{rows.slice(0,maxItems).map(r=><tr key={r.id}>{table.columns.slice(0,5).map(c=><td key={c.id}>{c.type==="checkbox"?(value(r,c)?"Да":"Нет"):formatCell(value(r,c))}</td>)}</tr>)}</tbody></table>{!rows.length&&<div className="fox-widget-empty">Записей пока нет</div>}</div>;
}

export default function FoxEditor({ screenId, editMode, onDoneEditing, tables, tableId, onTableChange, onOpenTables, onCreateTable }: Props) {
  const [store, setStore] = useState<WidgetStore>(emptyStore);
  const [grids,setGrids]=useState(readGridStore);
  const [gridError,setGridError]=useState("");
  const drag=useRef<{id:string;kind:"move"|"resize";edge:string;x:number;y:number;origin:Rect;preview:Rect;valid:boolean}|null>(null);
  const [preview,setPreview]=useState<{id:string;rect:Rect}|null>(null);
  const [organizer,setOrganizer] = useState<NotesTasksData>(readNotesTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRight, setShowRight] = useState(true);
  const previewMode = !editMode;
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("data");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("types");
  const [rightMode, setRightMode] = useState<"library" | "settings">("library");
  const canvasRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState("");
  const widgets = useMemo(() => store[screenId] ?? [], [store, screenId]);
  const selected = widgets.find(w => w.id === selectedId);
  const defaultTable = tables.find(t => t.id === tableId);
  const grid=useMemo(()=>reconcileGrid(grids[screenId],widgets),[grids,screenId,widgets]);
  const financeLayout=widgets.some(w=>w.type==="finance"&&Boolean(w.financeKind));
  const saveGrid=(layout:GridLayout)=>setGrids(prev=>({...prev,[screenId]:layout}));
  const patchGrid=(patch:Partial<GridLayout["settings"]>)=>{saveGrid(updateGridSettings(grid,widgets,patch));setGridError("");};
  function addPositions(items:EditorWidget[]){const next=reconcileGrid(grid,widgets);for(const item of items){const w=Math.min(next.settings.columns,Math.max(1,item.width));const h=Math.max(1,Math.ceil(item.height/(next.settings.rowHeight+next.settings.gap)));let p=nextSlot(w,h,next.positions,next.settings);while(!p&&next.settings.rows<60){next.settings={...next.settings,rows:Math.min(60,next.settings.rows+4)};p=nextSlot(w,h,next.positions,next.settings);}if(!p){setGridError("Нет места на сетке");return false;}next.positions[item.id]=p;}saveGrid(next);return true;}
  function setPosition(id:string,patch:Partial<Rect>){const current=grid.positions[id];if(!current)return;const changed=reposition(grid,id,{...current,...patch});if(changed){saveGrid(changed);setGridError("");}else setGridError("Место занято или размер выходит за границу сетки");}
  function pointerDown(e:React.PointerEvent<HTMLElement>,id:string,kind:"move"|"resize",edge=""){if(e.button!==0)return;const origin=grid.positions[id];if(!origin)return;e.stopPropagation();e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id,kind,edge,x:e.clientX,y:e.clientY,origin,preview:origin,valid:true};setSelectedId(id);}
  function pointerMove(e:React.PointerEvent<HTMLElement>){const d=drag.current;if(!d||!canvasRef.current)return;const cell=(canvasRef.current.clientWidth-grid.settings.gap*(grid.settings.columns-1))/grid.settings.columns;const dx=Math.round((e.clientX-d.x)/(cell+grid.settings.gap)),dy=Math.round((e.clientY-d.y)/(grid.settings.rowHeight+grid.settings.gap));const r={...d.origin};if(d.kind==="move"){r.x+=dx;r.y+=dy;}else{if(d.edge==="right")r.w+=dx;if(d.edge==="left"){r.x+=dx;r.w-=dx;}if(d.edge==="bottom")r.h+=dy;if(d.edge==="top"){r.y+=dy;r.h-=dy;}}const valid=r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=grid.settings.columns&&r.y+r.h<=grid.settings.rows&&Boolean(reposition(grid,d.id,r));drag.current={...d,preview:r,valid};setPreview(valid?{id:d.id,rect:r}:null);}
  function pointerUp(){const d=drag.current;if(!d)return;if(d.valid){const next=reposition(grid,d.id,d.preview);if(next)saveGrid(next);}else setGridError("Положение недоступно: пересечение или выход за границу");drag.current=null;setPreview(null);}
  function pointerCancel(){drag.current=null;setPreview(null);}
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(store)); }, [store]);
  useEffect(() => { localStorage.setItem(GRID_KEY,JSON.stringify(grids)); }, [grids]);
  useEffect(()=>{const update=()=>setOrganizer(readNotesTasks());window.addEventListener("fox-notes-tasks-updated",update);window.addEventListener("storage",update);return ()=>{window.removeEventListener("fox-notes-tasks-updated",update);window.removeEventListener("storage",update);};},[]);
  useEffect(() => { setSelectedId(null); setRightMode("library"); }, [screenId]);

  function exportLayout() {
    const blob = new Blob([JSON.stringify({format:"fox-space-screen-v2",widgets,grid},null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href=url;link.download="fox-space-screen.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  async function importLayout(file: File | undefined) {
    if (!file) return;
    try {
      const content = JSON.parse(await file.text()) as {format?:string;widgets?:unknown;grid?:GridLayout};
      if (!["fox-space-screen-v1","fox-space-screen-v2"].includes(content.format??"") || !Array.isArray(content.widgets) || content.widgets.length>80) throw Error("Некорректный формат макета");
      const safe = content.widgets.map((entry:unknown)=>{
        if (!entry || typeof entry!=="object") throw Error("Повреждённый виджет");
        const w=entry as Partial<EditorWidget>;
        if (!catalog.some(item=>item.type===w.type)) throw Error("Неизвестный тип виджета");
        return {id:newId(),type:w.type!,title:String(w.title??"Виджет").slice(0,100),
          tableId:typeof w.tableId==="string"?w.tableId:undefined,
          columnId:typeof w.columnId==="string"?w.columnId:undefined,
          labelColumnId:typeof w.labelColumnId==="string"?w.labelColumnId:undefined,
          width:Math.max(3,Math.min(12,Number(w.width)||6)),
          height:Math.max(140,Math.min(600,Number(w.height)||205)),
          target:Number.isFinite(Number(w.target))?Number(w.target):100,
          limit:Math.max(1,Math.min(30,Number(w.limit)||8)),
          aggregate:(["sum","average","min","max","count"].includes(String(w.aggregate))?w.aggregate:"sum") as Aggregate,
          filter: w.filter && typeof w.filter==="object" ? { columnId:String(w.filter.columnId??""), operator:w.filter.operator, value:String(w.filter.value??"") } : {},
          body:typeof w.body==="string"?w.body.slice(0,10000):"",
          startDate:typeof w.startDate==="string"?w.startDate:undefined,
          financeKind:typeof w.financeKind==="string"?w.financeKind as FinanceKind:undefined,
          financeRow:typeof w.financeRow==="number"?w.financeRow:undefined,
          financeColumn:typeof w.financeColumn==="number"?w.financeColumn:undefined,
          financeRowSpan:typeof w.financeRowSpan==="number"?w.financeRowSpan:undefined,
          financeBackground:typeof w.financeBackground==="string"&&["mountains","sunset","plain"].includes(w.financeBackground)?w.financeBackground as EditorWidget["financeBackground"]:undefined,
          accent:typeof w.accent==="string"&&/^#[0-9a-f]{6}$/i.test(w.accent)?w.accent:undefined
        } satisfies EditorWidget;
      });
      updateWidgets(()=>safe);
      saveGrid(reconcileGrid(content.grid,safe));
      setSelectedId(null);setRightMode("library");setImportError("");
    } catch(error) {
      setImportError(error instanceof Error?error.message:"Не удалось импортировать макет");
    } finally {if(importRef.current) importRef.current.value="";}
  }
  function updateWidgets(updater: (w: EditorWidget[]) => EditorWidget[]) {
    setStore(prev => ({ ...prev, [screenId]: updater(prev[screenId] ?? []) }));
  }
  function setWidget(id: string, patch: Partial<EditorWidget>) {
    updateWidgets(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }
  function addWidget(type: WidgetType) {
    const meta = catalog.find(c => c.type === type)!;
    const numeric = defaultTable?.columns.find(c => c.type === "number" || c.type === "formula");
    const text = defaultTable?.columns.find(c => c.type === "text");
    const widget: EditorWidget = {
      id: newId(), type, title: meta.title, tableId: meta.needsTable ? tableId : undefined,
      columnId: numeric?.id, labelColumnId: type==="donut" ? defaultTable?.columns.find(c=>c.type==="select")?.id : text?.id,
      target: 100, aggregate:"sum", filter:{}, limit:8, body: "", width: ["worldmap","table","heading","divider"].includes(type) ? 12 : 6, height: type === "worldmap" ? 480 : type === "table" ? 270 : type === "heading" ? 100 : type === "divider" ? 65 : 205
    };
    if(!addPositions([widget]))return;
    updateWidgets(prev => [...prev, widget]);
    setSelectedId(widget.id); setRightMode("settings"); setSettingsTab("data"); setShowRight(true);
  }
  function addTemplate(types: WidgetType[]) {
    const numeric = defaultTable?.columns.find(c => c.type === "number" || c.type === "formula");
    const text = defaultTable?.columns.find(c => c.type === "text");
    const additions = types.map(type => ({
      id: newId(), type, title: catalog.find(c => c.type === type)!.title,
      tableId: defaultTable?.id, columnId: numeric?.id, labelColumnId: text?.id,
      target: 100, aggregate:"sum" as Aggregate, filter: {} as RowFilter, limit:8, width: ["worldmap","table","heading","divider"].includes(type) ? 12 : 6, height: type === "worldmap" ? 480 : type === "table" ? 270 : 205
    }));
    if(!addPositions(additions))return;
    updateWidgets(prev => [...prev, ...additions]);
    setSelectedId(additions[0].id); setRightMode("settings"); setSettingsTab("data"); setShowRight(true);
  }
  function duplicateWidget(id: string) {
    const widget = widgets.find(w=>w.id===id);
    if (!widget) return;
    const copy = {...widget,id:newId(),title:widget.title+" — копия"};
    if(!addPositions([copy]))return;
    updateWidgets(prev=>[...prev,copy]);
    setSelectedId(copy.id); setRightMode("settings"); setSettingsTab("data");
  }
  const selectedTable = tables.find(t => t.id === selected?.tableId);
  const numericFields = selectedTable?.columns.filter(c => c.type === "number" || c.type === "formula") ?? [];
  const allFields = selectedTable?.columns ?? [];

  return <div className="fox-editor">
    {editMode&&<div className="fox-editor-toolbar"><div><span className="fox-editor-overline">FOX EDITOR</span><h2>Редактор экрана</h2><p>Перемещайте виджеты и изменяйте их размеры перетаскиванием границ.</p></div><div className="fox-editor-toolbar-actions"><button className="primary-button" onClick={()=>{setSelectedId(null);onDoneEditing();}}>Готово</button><button className="outline-button" onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Виджет</button><button className="soft-icon" title="Экспортировать макет" onClick={exportLayout}><Download size={17}/></button><button className="soft-icon" title="Импортировать макет" onClick={()=>importRef.current?.click()}><Upload size={17}/></button><input ref={importRef} className="fox-editor-hidden-file" type="file" accept=".json,application/json" onChange={event=>{void importLayout(event.target.files?.[0]);}}/><button className="soft-icon" title="Показать или скрыть панель" onClick={()=>setShowRight(v=>!v)}><PanelRightOpen size={18}/></button></div></div>}
    {editMode&&gridError&&<div className="fox-editor-import-error" role="alert">{gridError}<button onClick={()=>setGridError("")}><X size={14}/></button></div>}
    {editMode&&importError&&<div className="fox-editor-import-error" role="alert">{importError}<button onClick={()=>setImportError("")}><X size={14}/></button></div>}
    <div className={"fox-editor-layout"+(previewMode?" preview":"")}>
      <div className="fox-editor-workspace">
        {editMode&&<div className="fox-grid-config"><label>Столбцы<input type="number" min={4} max={24} value={grid.settings.columns} onChange={e=>patchGrid({columns:Number(e.target.value)})}/></label><label>Строки<input type="number" min={4} max={60} value={grid.settings.rows} onChange={e=>patchGrid({rows:Number(e.target.value)})}/></label><label>Зазор, px<input type="number" min={0} max={32} value={grid.settings.gap} onChange={e=>patchGrid({gap:Number(e.target.value)})}/></label><label>Высота ячейки, px<input type="number" min={40} max={140} value={grid.settings.rowHeight} onChange={e=>patchGrid({rowHeight:Number(e.target.value)})}/></label></div>}
        {editMode&&<div className="fox-editor-source"><Database size={16}/><span>Основная таблица</span><select value={tableId??""} onChange={e=>onTableChange(e.target.value)}><option value="">Не выбрана</option>{tables.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={onOpenTables}>Управление таблицами <ChevronsRight size={14}/></button></div>}
        <div className={"fox-editor-grid fox-editor-true-grid"+(financeLayout?" finance-dashboard-grid":"")} style={{gridTemplateColumns:`repeat(${grid.settings.columns},minmax(0,1fr))`,gridTemplateRows:`repeat(${grid.settings.rows},${grid.settings.rowHeight}px)`,gap:grid.settings.gap}} ref={canvasRef}>
          {editMode&&<div className="fox-grid-guides" aria-hidden="true">{Array.from({length:grid.settings.columns*grid.settings.rows},(_,i)=><i key={i}/>)}</div>}
          {widgets.map(widget => {
            const table = tables.find(t => t.id === widget.tableId);
            const isSelected = !previewMode && selectedId === widget.id;
            const rect=preview?.id===widget.id?preview.rect:grid.positions[widget.id];
             if(!rect)return null;
             return <div className={"fox-widget fox-grid-widget"+(isSelected?" selected":"")+(widget.type==="finance"?" fox-finance-card fox-finance-"+(widget.financeKind??"balance"):"")} style={{gridColumn:`${rect.x+1} / span ${rect.w}`,gridRow:`${rect.y+1} / span ${rect.h}`,"--fox-col":`${rect.x+1} / span ${rect.w}`,"--fox-row":`${rect.y+1} / span ${rect.h}`,minHeight:0} as React.CSSProperties} key={widget.id}
               onClick={()=>{if(previewMode)return;setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}}>
              {!previewMode&&<div className="fox-grid-drag-handle" title="Перетащить карточку" onPointerDown={e=>pointerDown(e,widget.id,"move")} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}><GripVertical size={16}/></div>}
               {widget.type!=="finance" && <div className="fox-widget-header"><h3>{widget.title}</h3>{!previewMode&&<button onClick={e=>{e.stopPropagation();setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}} title="Параметры"><Settings2 size={16}/></button>}</div>}
              <div className="fox-widget-body"><WidgetPreview widget={widget} table={table} tables={tables} organizer={organizer} editMode={editMode} onConfigure={()=>{setSelectedId(widget.id);setSettingsTab("data");setRightMode("settings");setShowRight(true);}}/></div>
              {!previewMode&&(["right","bottom","left","top"] as const).map(edge=><div key={edge} className={"fox-widget-edge fox-widget-edge-"+edge} onPointerDown={e=>pointerDown(e,widget.id,"resize",edge)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel}/>)}
            </div>;
          })}
          {!widgets.length && <div className="fox-editor-empty"><LayoutGrid size={30}/><h3>Пустой экран</h3><p>Добавьте первый виджет. Показатели, таблицы и графики будут брать данные из выбранного источника.</p>{editMode&&<button className="primary-button" onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Выбрать виджет</button>}</div>}
        </div>
      </div>
      {showRight && !previewMode && <aside className="fox-editor-sidebar">
        <div className="fox-editor-side-head"><div><span>ПАНЕЛЬ FOX EDITOR</span><h3>{rightMode==="settings"&&selected?"Настройки виджета":"Библиотека виджетов"}</h3></div><button onClick={()=>setShowRight(false)} title="Закрыть панель"><X size={17}/></button></div>
        {rightMode==="settings"&&selected ? <>
          <div className="fox-editor-tabs"><button className={settingsTab==="data"?"active":""} onClick={()=>setSettingsTab("data")}><Database size={14}/> Данные</button><button className={settingsTab==="appearance"?"active":""} onClick={()=>setSettingsTab("appearance")}><Palette size={14}/> Вид</button><button className={settingsTab==="behavior"?"active":""} onClick={()=>setSettingsTab("behavior")}><SlidersHorizontal size={14}/> Поведение</button></div>
          <div className="fox-editor-fields">
            {settingsTab==="data" && <>
              <label>Название<input value={selected.title} onChange={e=>setWidget(selected.id,{title:e.target.value})}/></label>
              {!["text","heading","divider","datecount","taskcount","tasklist","noteslist","worldmap"].includes(selected.type) && <div className="fox-editor-filter-options">
                <h4>Фильтрация записей</h4>
                <label>Колонка<select value={selected.filter?.columnId??""} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,columnId:e.target.value}})}><option value="">Без фильтра</option>{allFields.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label>
                <label>Условие<select value={selected.filter?.operator??"contains"} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,operator:e.target.value as RowFilter["operator"]}})}><option value="contains">Содержит</option><option value="equals">Равно</option><option value="not_equals">Не равно</option><option value="gt">Больше</option><option value="lt">Меньше</option><option value="empty">Пусто</option><option value="not_empty">Не пусто</option></select></label>
                {!["empty","not_empty"].includes(selected.filter?.operator??"") && <label>Значение<input value={selected.filter?.value??""} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,value:e.target.value}})} placeholder="Для сравнения"/></label>}
                <label>Максимум записей<input type="number" min={1} max={30} value={selected.limit??8} onChange={e=>setWidget(selected.id,{limit:Math.max(1,Math.min(30,Number(e.target.value)||1))})}/></label>
              </div>}
              {selected.type==="divider" ? <p>Разделитель не требует источника данных.</p> : selected.type==="datecount" ? <label>Дата начала отношений<input type="date" value={selected.startDate??""} onChange={e=>setWidget(selected.id,{startDate:e.target.value})}/></label> : ["taskcount","tasklist","noteslist"].includes(selected.type) ? <><p>Данные берутся из раздела «Заметки и задачи».</p>{selected.type!=="noteslist"&&<label>Статус задач<select value={selected.taskStatus??"all"} onChange={e=>setWidget(selected.id,{taskStatus:e.target.value as TaskStatus|"all"})}><option value="all">Все</option><option value="todo">К выполнению</option><option value="doing">В работе</option><option value="done">Готово</option></select></label>}<label>Максимум записей<input type="number" min={1} max={30} value={selected.limit??8} onChange={e=>setWidget(selected.id,{limit:Math.max(1,Math.min(30,Number(e.target.value)||1))})}/></label></> : ["text","heading"].includes(selected.type) ? <label>Текст<textarea rows={6} value={selected.body??""} onChange={e=>setWidget(selected.id,{body:e.target.value})}/></label> : <>
                {selected.type==="worldmap"&&<p className="fox-editor-source-message">Выберите таблицу поездок со столбцами «ISO A3» или «Страна». Можно менять масштаб и нажимать на страны.</p>}
                <div className="fox-editor-source-picker">
                  <label>Источник данных<select value={selected.tableId??""} onChange={e=>setWidget(selected.id,{tableId:e.target.value||undefined,columnId:undefined,labelColumnId:undefined,filter:{}})}><option value="">Выбрать таблицу…</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                  {!selectedTable&&<p className="fox-editor-source-message">{tables.length?"Выберите таблицу выше. Виджет уже добавлен и сохранится, даже если источник пока не выбран.":"Пока нет таблиц. Создайте первую таблицу, затем вернитесь сюда и подключите её к виджету."}</p>}
                  <button type="button" className="fox-editor-create-source" onClick={onCreateTable}><Plus size={15}/> Создать таблицу</button>
                </div>
                {["metric","progress","bars","line"].includes(selected.type)&&<label>Числовое поле<select value={selected.columnId??""} onChange={e=>setWidget(selected.id,{columnId:e.target.value})}><option value="">Автоматически</option>{numericFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {["bars","list","donut","timeline"].includes(selected.type)&&<label>Подписи<select value={selected.labelColumnId??""} onChange={e=>setWidget(selected.id,{labelColumnId:e.target.value})}><option value="">Автоматически</option>{allFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {["metric","progress"].includes(selected.type)&&<label>Расчёт<select value={selected.aggregate??"sum"} onChange={e=>setWidget(selected.id,{aggregate:e.target.value as Aggregate})}><option value="sum">Сумма</option><option value="average">Среднее</option><option value="min">Минимум</option><option value="max">Максимум</option><option value="count">Количество записей</option></select></label>}{selected.type==="progress"&&<label>Целевое значение<input type="number" value={selected.target??100} onChange={e=>setWidget(selected.id,{target:Number(e.target.value)})}/></label>}
              </>}
            </>}
            {settingsTab==="appearance" && <><label>Ширина, ячеек<input type="number" min={1} max={grid.settings.columns} value={grid.positions[selected.id]?.w??1} onChange={e=>setPosition(selected.id,{w:Number(e.target.value)})}/></label><label>Высота, ячеек<input type="number" min={1} max={grid.settings.rows} value={grid.positions[selected.id]?.h??1} onChange={e=>setPosition(selected.id,{h:Number(e.target.value)})}/></label><label>Колонка<input type="number" min={1} max={grid.settings.columns} value={(grid.positions[selected.id]?.x??0)+1} onChange={e=>setPosition(selected.id,{x:Number(e.target.value)-1})}/></label><label>Строка<input type="number" min={1} max={grid.settings.rows} value={(grid.positions[selected.id]?.y??0)+1} onChange={e=>setPosition(selected.id,{y:Number(e.target.value)-1})}/></label><label>Акцент карточки<select value={selected.accent??""} onChange={e=>setWidget(selected.id,{accent:e.target.value||undefined})}><option value="">Акцент приложения</option><option value="#f06432">Оранжевый</option><option value="#4779d5">Синий</option><option value="#388b69">Зелёный</option><option value="#8864c8">Фиолетовый</option></select></label>{selected.type==="finance"&&selected.financeKind==="balance"&&<label>Фон карточки баланса<select value={selected.financeBackground??"mountains"} onChange={e=>setWidget(selected.id,{financeBackground:e.target.value as EditorWidget["financeBackground"]})}><option value="mountains">Горный пейзаж</option><option value="sunset">Тёплый закат</option><option value="plain">Однотонный</option></select></label>}</>}
            {settingsTab==="behavior" && <><p>Перетаскивайте карточку за ручку в левом верхнем углу, чтобы перемещать по сетке. Размер можно установить во вкладке «Вид» или зажать границу карточки и потянуть: боковые границы меняют ширину, верхняя и нижняя — высоту. В предпросмотре размер менять нельзя.</p><div className="fox-editor-widget-actions"><button onClick={()=>duplicateWidget(selected.id)}>Дублировать</button></div><button className="fox-editor-danger" onClick={()=>{updateWidgets(prev=>prev.filter(w=>w.id!==selected.id));setSelectedId(null);setRightMode("library");}}><Trash2 size={15}/> Удалить виджет</button></>}
          </div>
          <button className="fox-editor-back" onClick={()=>{setSelectedId(null);setRightMode("library");}}>Вернуться в библиотеку</button>
        </> : <>
          <div className="fox-editor-tabs"><button className={libraryTab==="types"?"active":""} onClick={()=>setLibraryTab("types")}><LayoutGrid size={14}/> Типы</button><button className={libraryTab==="templates"?"active":""} onClick={()=>setLibraryTab("templates")}><Table2 size={14}/> Шаблоны</button></div>
          {!defaultTable&&<div className="fox-editor-hint">Добавьте любой виджет сейчас, а источник выберите в его настройках. Все карточки можно сохранить без таблицы.</div>}
          <div className="fox-editor-library">{libraryTab==="types"?catalog.map(item=><button key={item.type} onClick={()=>addWidget(item.type)}><div className="fox-editor-item-icon"><item.icon size={18}/></div><div><b>{item.title}</b><small>{item.description}</small></div><Plus size={16}/></button>):templates.map(item=><button key={item.title} onClick={()=>addTemplate(item.types)}><div className="fox-editor-item-icon"><LayoutGrid size={18}/></div><div><b>{item.title}</b><small>{item.description}</small></div><Plus size={16}/></button>)}</div>
        </>}
      </aside>}
    </div>
  </div>;
}
