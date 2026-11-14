import { useEffect, useMemo, useRef, useState } from "react";
import { aggregateRows, filterRows, formatCell, valueForColumn, type Aggregate, type RowFilter, type TableData } from "../tables/values";
import {
  Plus, Settings2, LayoutGrid, Table2, BarChart3, TrendingUp,
  AlignLeft, List, Target, GripVertical, Trash2, X, Database,
  ChevronsRight, PanelRightOpen, Palette, SlidersHorizontal
} from "lucide-react";

export type EditorTable = TableData;
type WidgetType = "metric" | "progress" | "bars" | "line" | "donut" | "timeline" | "table" | "list" | "text";
type EditorWidget = {
  id: string; type: WidgetType; title: string; tableId?: string;
  columnId?: string; labelColumnId?: string; target?: number;
  body?: string; width: number; height: number; accent?: string;
  aggregate?: Aggregate; filter?: RowFilter; limit?: number; hideTitle?: boolean;
};
type WidgetStore = Record<string, EditorWidget[]>;
type SettingsTab = "data" | "appearance" | "behavior";
type LibraryTab = "types" | "templates";
type Props = {
  screenId: string;
  tables: EditorTable[];
  tableId?: string;
  onTableChange: (id: string) => void;
  onOpenTables: () => void;
};
const STORAGE = "fox-editor-widgets-v1";
const catalog: { type: WidgetType; title: string; description: string; icon: typeof LayoutGrid; needsTable: boolean }[] = [
  { type: "metric", title: "Показатель", description: "Сумма значений числовой колонки", icon: TrendingUp, needsTable: true },
  { type: "progress", title: "Прогресс", description: "Значение относительно цели", icon: Target, needsTable: true },
  { type: "bars", title: "Столбчатый график", description: "Сравнение записей по числу", icon: BarChart3, needsTable: true },
  { type: "line", title: "Линейный график", description: "Динамика числового поля", icon: TrendingUp, needsTable: true },
  { type: "donut", title: "Круговая диаграмма", description: "Распределение записей по категории", icon: Target, needsTable: true },
  { type: "timeline", title: "Хронология", description: "Единая временная линия событий", icon: LayoutGrid, needsTable: true },
  { type: "table", title: "Таблица", description: "Все записи в компактном виде", icon: Table2, needsTable: true },
  { type: "list", title: "Список", description: "Последние записи из таблицы", icon: List, needsTable: true },
  { type: "text", title: "Текст", description: "Заголовок и произвольная заметка", icon: AlignLeft, needsTable: false },
];
const templates = [
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

function WidgetPreview({ widget, table, tables }: { widget: EditorWidget; table?: EditorTable; tables: EditorTable[] }) {
  if (widget.type === "text") return <div className="fox-widget-text">{widget.body?.trim() || "Добавьте текст в параметрах виджета."}</div>;
  if (!table) return <div className="fox-widget-empty">Выберите таблицу в разделе «Данные».</div>;
  const numbers = table.columns.filter(c => c.type === "number" || c.type === "formula");
  const numberCol = numbers.find(c => c.id === widget.columnId) ?? numbers[0];
  const textCol = table.columns.find(c => c.id === widget.labelColumnId) ?? table.columns.find(c => c.type === "text") ?? table.columns[0];
  const rows = filterRows(table.rows, table, tables, widget.filter ?? {});
  const value = (row: EditorTable["rows"][number], col: EditorTable["columns"][number]) => valueForColumn(row, col, tables);
  const maxItems = Math.max(1, Math.min(30, widget.limit ?? 8));
  if (widget.type === "metric" || widget.type === "progress") {
    const mode = widget.aggregate ?? "sum";
    const total = aggregateRows(rows, numberCol, tables, mode);
    if (!numberCol && (widget.aggregate ?? "sum") !== "count") return <div className="fox-widget-empty">Для показателя нужна числовая колонка.</div>;
    if (widget.type === "metric") return <div className="fox-widget-kpi"><strong>{fmt(total)}</strong><span>{mode === "count" ? "Количество записей" : (numberCol?.name ?? "Данные") + " · " + ({sum:"Сумма",average:"Среднее",min:"Минимум",max:"Максимум"} as Record<string,string>)[mode]}</span></div>;
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

export default function FoxEditor({ screenId, tables, tableId, onTableChange, onOpenTables }: Props) {
  const [store, setStore] = useState<WidgetStore>(emptyStore);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRight, setShowRight] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("data");
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("types");
  const [rightMode, setRightMode] = useState<"library" | "settings">("library");
  const canvasRef = useRef<HTMLDivElement>(null);
  const widgets = useMemo(() => store[screenId] ?? [], [store, screenId]);
  const selected = widgets.find(w => w.id === selectedId);
  const defaultTable = tables.find(t => t.id === tableId);
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(store)); }, [store]);
  useEffect(() => { setSelectedId(null); setRightMode("library"); }, [screenId]);

  function updateWidgets(updater: (w: EditorWidget[]) => EditorWidget[]) {
    setStore(prev => ({ ...prev, [screenId]: updater(prev[screenId] ?? []) }));
  }
  function setWidget(id: string, patch: Partial<EditorWidget>) {
    updateWidgets(prev => prev.map(w => w.id === id ? { ...w, ...patch } : w));
  }
  function addWidget(type: WidgetType) {
    const meta = catalog.find(c => c.type === type)!;
    if (meta.needsTable && !defaultTable) return;
    const numeric = defaultTable?.columns.find(c => c.type === "number" || c.type === "formula");
    const text = defaultTable?.columns.find(c => c.type === "text");
    const widget: EditorWidget = {
      id: newId(), type, title: meta.title, tableId: meta.needsTable ? tableId : undefined,
      columnId: numeric?.id, labelColumnId: type==="donut" ? defaultTable?.columns.find(c=>c.type==="select")?.id : text?.id,
      target: 100, aggregate:"sum", filter:{}, limit:8, body: "", width: type === "table" ? 12 : type === "text" ? 6 : 6, height: type === "table" ? 270 : 205
    };
    updateWidgets(prev => [...prev, widget]);
    setSelectedId(widget.id); setRightMode("settings"); setSettingsTab("data");
  }
  function addTemplate(types: WidgetType[]) {
    if (!defaultTable) return;
    const numeric = defaultTable.columns.find(c => c.type === "number" || c.type === "formula");
    const text = defaultTable.columns.find(c => c.type === "text");
    const additions = types.map(type => ({
      id: newId(), type, title: catalog.find(c => c.type === type)!.title,
      tableId, columnId: numeric?.id, labelColumnId: text?.id,
      target: 100, aggregate:"sum" as Aggregate, filter: {} as RowFilter, limit:8, width: type === "table" ? 12 : 6, height: type === "table" ? 270 : 205
    }));
    updateWidgets(prev => [...prev, ...additions]);
    setSelectedId(additions[0].id); setRightMode("settings");
  }
  function duplicateWidget(id: string) {
    const widget = widgets.find(w=>w.id===id);
    if (!widget) return;
    const copy = {...widget,id:newId(),title:widget.title+" — копия"};
    updateWidgets(prev=>[...prev,copy]);
    setSelectedId(copy.id); setRightMode("settings"); setSettingsTab("data");
  }
  function moveWidget(id: string, direction: -1 | 1) {
    updateWidgets(prev=>{const index=prev.findIndex(w=>w.id===id);const nextIndex=index+direction;if(index<0||nextIndex<0||nextIndex>=prev.length)return prev;const next=[...prev];[next[index],next[nextIndex]]=[next[nextIndex],next[index]];return next;});
  }
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    updateWidgets(prev => {
      const next = [...prev], from = next.findIndex(w => w.id === fromId), to = next.findIndex(w => w.id === toId);
      if (from < 0 || to < 0) return prev;
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  }
  function resize(widget: EditorWidget, delta: number) {
    const canvasWidth = canvasRef.current?.clientWidth ?? 1000;
    const colPx = Math.max(40, (canvasWidth - 11 * 12) / 12);
    setWidget(widget.id, { width: Math.min(12, Math.max(3, Math.round(widget.width + delta / colPx))) });
  }

  const selectedTable = tables.find(t => t.id === selected?.tableId);
  const numericFields = selectedTable?.columns.filter(c => c.type === "number" || c.type === "formula") ?? [];
  const allFields = selectedTable?.columns ?? [];

  return <div className="fox-editor">
    <div className="fox-editor-toolbar"><div><span className="fox-editor-overline">FOX EDITOR</span><h2>Редактор экрана</h2><p>Размещайте виджеты на сетке. Они используют данные подключённых таблиц.</p></div><div className="fox-editor-toolbar-actions"><button className="outline-button" onClick={()=>{setPreviewMode(value=>!value);setSelectedId(null);}}>{previewMode?"Редактировать":"Предпросмотр"}</button><button className="outline-button" disabled={previewMode} onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Виджет</button><button className="soft-icon" title="Показать или скрыть панель" onClick={()=>setShowRight(v=>!v)}><PanelRightOpen size={18}/></button></div></div>
    <div className={"fox-editor-layout"+(previewMode?" preview":"")}>
      <div className="fox-editor-workspace">
        <div className="fox-editor-source"><Database size={16}/><span>Основная таблица</span><select value={tableId??""} onChange={e=>onTableChange(e.target.value)}><option value="">Не выбрана</option>{tables.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={onOpenTables}>Управление таблицами <ChevronsRight size={14}/></button></div>
        <div className="fox-editor-grid" ref={canvasRef}>
          {widgets.map(widget => {
            const table = tables.find(t => t.id === widget.tableId);
            const isSelected = !previewMode && selectedId === widget.id;
            return <div className={"fox-widget"+(isSelected?" selected":"")} style={{gridColumn:"span "+widget.width,minHeight:widget.height}} key={widget.id}
              draggable={!previewMode} onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",widget.id);}}
              onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorder(e.dataTransfer.getData("text/plain"),widget.id);}}
              onClick={()=>{if(previewMode)return;setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}}>
              <div className="fox-widget-header">{!previewMode&&<GripVertical size={14} className="fox-widget-grip"/>}<h3>{widget.title}</h3>{!previewMode&&<button onClick={e=>{e.stopPropagation();setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}} title="Параметры"><Settings2 size={16}/></button>}</div>
              <div className="fox-widget-body"><WidgetPreview widget={widget} table={table} tables={tables}/></div>
              {!previewMode&&<div className="fox-widget-resize" title="Перетащите для изменения ширины" onPointerDown={event=>{
                event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.dataset.startX=String(event.clientX);
              }} onPointerUp={event=>{
                const origin=Number(event.currentTarget.dataset.startX??event.clientX);
                resize(widget,event.clientX-origin); event.currentTarget.releasePointerCapture(event.pointerId);
              }}><LayoutGrid size={13}/></div>}
            </div>;
          })}
          {!widgets.length && <div className="fox-editor-empty"><LayoutGrid size={30}/><h3>Пустой экран</h3><p>Добавьте первый виджет. Показатели, таблицы и графики будут брать данные из выбранного источника.</p><button className="primary-button" onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Выбрать виджет</button></div>}
        </div>
      </div>
      {showRight && !previewMode && <aside className="fox-editor-sidebar">
        <div className="fox-editor-side-head"><div><span>ПАНЕЛЬ FOX EDITOR</span><h3>{rightMode==="settings"&&selected?"Настройки виджета":"Библиотека виджетов"}</h3></div><button onClick={()=>setShowRight(false)} title="Закрыть панель"><X size={17}/></button></div>
        {rightMode==="settings"&&selected ? <>
          <div className="fox-editor-tabs"><button className={settingsTab==="data"?"active":""} onClick={()=>setSettingsTab("data")}><Database size={14}/> Данные</button><button className={settingsTab==="appearance"?"active":""} onClick={()=>setSettingsTab("appearance")}><Palette size={14}/> Вид</button><button className={settingsTab==="behavior"?"active":""} onClick={()=>setSettingsTab("behavior")}><SlidersHorizontal size={14}/> Поведение</button></div>
          <div className="fox-editor-fields">
            {settingsTab==="data" && <>
              <label>Название<input value={selected.title} onChange={e=>setWidget(selected.id,{title:e.target.value})}/></label>
              {selected.type!=="text" && <div className="fox-editor-filter-options">
                <h4>Фильтрация записей</h4>
                <label>Колонка<select value={selected.filter?.columnId??""} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,columnId:e.target.value}})}><option value="">Без фильтра</option>{allFields.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label>
                <label>Условие<select value={selected.filter?.operator??"contains"} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,operator:e.target.value as RowFilter["operator"]}})}><option value="contains">Содержит</option><option value="equals">Равно</option><option value="not_equals">Не равно</option><option value="gt">Больше</option><option value="lt">Меньше</option><option value="empty">Пусто</option><option value="not_empty">Не пусто</option></select></label>
                {!["empty","not_empty"].includes(selected.filter?.operator??"") && <label>Значение<input value={selected.filter?.value??""} onChange={e=>setWidget(selected.id,{filter:{...selected.filter,value:e.target.value}})} placeholder="Для сравнения"/></label>}
                <label>Максимум записей<input type="number" min={1} max={30} value={selected.limit??8} onChange={e=>setWidget(selected.id,{limit:Math.max(1,Math.min(30,Number(e.target.value)||1))})}/></label>
              </div>}
              {selected.type==="text" ? <label>Текст<textarea rows={6} value={selected.body??""} onChange={e=>setWidget(selected.id,{body:e.target.value})}/></label> : <>
                <label>Источник<select value={selected.tableId??""} onChange={e=>setWidget(selected.id,{tableId:e.target.value,columnId:undefined,labelColumnId:undefined})}><option value="">Не выбрана</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                {["metric","progress","bars","line"].includes(selected.type)&&<label>Числовое поле<select value={selected.columnId??""} onChange={e=>setWidget(selected.id,{columnId:e.target.value})}><option value="">Автоматически</option>{numericFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {["bars","list","donut","timeline"].includes(selected.type)&&<label>Подписи<select value={selected.labelColumnId??""} onChange={e=>setWidget(selected.id,{labelColumnId:e.target.value})}><option value="">Автоматически</option>{allFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {["metric","progress"].includes(selected.type)&&<label>Расчёт<select value={selected.aggregate??"sum"} onChange={e=>setWidget(selected.id,{aggregate:e.target.value as Aggregate})}><option value="sum">Сумма</option><option value="average">Среднее</option><option value="min">Минимум</option><option value="max">Максимум</option><option value="count">Количество записей</option></select></label>}{selected.type==="progress"&&<label>Целевое значение<input type="number" value={selected.target??100} onChange={e=>setWidget(selected.id,{target:Number(e.target.value)})}/></label>}
              </>}
            </>}
            {settingsTab==="appearance" && <><label>Ширина на сетке<select value={selected.width} onChange={e=>setWidget(selected.id,{width:Number(e.target.value)})}>{[3,4,6,8,9,12].map(n=><option key={n} value={n}>{n} / 12</option>)}</select></label><label>Высота карточки<input type="number" min={140} max={600} step={10} value={selected.height} onChange={e=>setWidget(selected.id,{height:Math.max(140,Math.min(600,Number(e.target.value)||140))})}/></label><label>Акцент карточки<select value={selected.accent??""} onChange={e=>setWidget(selected.id,{accent:e.target.value||undefined})}><option value="">Акцент приложения</option><option value="#f06432">Оранжевый</option><option value="#4779d5">Синий</option><option value="#388b69">Зелёный</option><option value="#8864c8">Фиолетовый</option></select></label></>}
            {settingsTab==="behavior" && <><p>Перетаскивайте карточку за заголовок, чтобы менять порядок. Размер можно установить во вкладке «Вид» или потянуть за нижний правый угол.</p><div className="fox-editor-widget-actions"><button onClick={()=>moveWidget(selected.id,-1)}>Назад</button><button onClick={()=>moveWidget(selected.id,1)}>Вперёд</button><button onClick={()=>duplicateWidget(selected.id)}>Дублировать</button></div><button className="fox-editor-danger" onClick={()=>{updateWidgets(prev=>prev.filter(w=>w.id!==selected.id));setSelectedId(null);setRightMode("library");}}><Trash2 size={15}/> Удалить виджет</button></>}
          </div>
          <button className="fox-editor-back" onClick={()=>{setSelectedId(null);setRightMode("library");}}>Вернуться в библиотеку</button>
        </> : <>
          <div className="fox-editor-tabs"><button className={libraryTab==="types"?"active":""} onClick={()=>setLibraryTab("types")}><LayoutGrid size={14}/> Типы</button><button className={libraryTab==="templates"?"active":""} onClick={()=>setLibraryTab("templates")}><Table2 size={14}/> Шаблоны</button></div>
          {!defaultTable&&<div className="fox-editor-hint">Выберите основную таблицу, чтобы использовать виджеты с данными. Текст доступен сразу.</div>}
          <div className="fox-editor-library">{libraryTab==="types"?catalog.map(item=><button key={item.type} disabled={item.needsTable&&!defaultTable} onClick={()=>addWidget(item.type)}><div className="fox-editor-item-icon"><item.icon size={18}/></div><div><b>{item.title}</b><small>{item.description}</small></div><Plus size={16}/></button>):templates.map(item=><button key={item.title} disabled={!defaultTable} onClick={()=>addTemplate(item.types)}><div className="fox-editor-item-icon"><LayoutGrid size={18}/></div><div><b>{item.title}</b><small>{item.description}</small></div><Plus size={16}/></button>)}</div>
        </>}
      </aside>}
    </div>
  </div>;
}
