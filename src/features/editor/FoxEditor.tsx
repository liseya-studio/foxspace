import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Settings2, LayoutGrid, Table2, BarChart3, TrendingUp,
  AlignLeft, List, Target, GripVertical, Trash2, X, Database,
  ChevronsRight, PanelRightOpen, Palette, SlidersHorizontal
} from "lucide-react";

type Cell = string | number | boolean;
export type EditorTable = {
  id: string; name: string;
  columns: { id: string; name: string; type: string }[];
  rows: { id: string; cells: Record<string, Cell> }[];
};
type WidgetType = "metric" | "progress" | "bars" | "table" | "list" | "text";
type EditorWidget = {
  id: string; type: WidgetType; title: string; tableId?: string;
  columnId?: string; labelColumnId?: string; target?: number;
  body?: string; width: number; height: number; accent?: string;
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
  { type: "table", title: "Таблица", description: "Все записи в компактном виде", icon: Table2, needsTable: true },
  { type: "list", title: "Список", description: "Последние записи из таблицы", icon: List, needsTable: true },
  { type: "text", title: "Текст", description: "Заголовок и произвольная заметка", icon: AlignLeft, needsTable: false },
];
const templates = [
  { title: "Финансовая сводка", description: "Показатель + график", types: ["metric", "bars"] as WidgetType[] },
  { title: "Контроль цели", description: "Показатель + прогресс", types: ["metric", "progress"] as WidgetType[] },
  { title: "Реестр проекта", description: "Список + таблица", types: ["list", "table"] as WidgetType[] },
];
const emptyStore = (): WidgetStore => {
  try { return JSON.parse(localStorage.getItem(STORAGE) ?? "{}") as WidgetStore; }
  catch { return {}; }
};
const newId = () => crypto.randomUUID();
const fmt = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n);

function WidgetPreview({ widget, table }: { widget: EditorWidget; table?: EditorTable }) {
  if (widget.type === "text") return <div className="fox-widget-text">{widget.body?.trim() || "Добавьте текст в параметрах виджета."}</div>;
  if (!table) return <div className="fox-widget-empty">Выберите таблицу в разделе «Данные».</div>;
  const numbers = table.columns.filter(c => c.type === "number" || c.type === "formula");
  const numberCol = numbers.find(c => c.id === widget.columnId) ?? numbers[0];
  const textCol = table.columns.find(c => c.id === widget.labelColumnId) ?? table.columns.find(c => c.type === "text") ?? table.columns[0];
  const rows = table.rows;
  if (widget.type === "metric" || widget.type === "progress") {
    const total = numberCol ? rows.reduce((sum, row) => sum + (Number(row.cells[numberCol.id]) || 0), 0) : 0;
    if (!numberCol) return <div className="fox-widget-empty">Для показателя нужна числовая колонка.</div>;
    if (widget.type === "metric") return <div className="fox-widget-kpi"><strong>{fmt(total)}</strong><span>{numberCol.name} · сумма по {rows.length} записям</span></div>;
    const target = Math.max(1, widget.target ?? 100);
    const percent = Math.max(0, Math.min(100, total / target * 100));
    return <div className="fox-widget-progress"><div className="fox-widget-progress-value"><strong>{fmt(total)}</strong><span>из {fmt(target)}</span></div><div className="fox-progress-track"><div style={{width:percent+"%", background: widget.accent || "var(--accent)"}}/></div><small>{fmt(total/target*100)}% от цели</small></div>;
  }
  if (widget.type === "bars") {
    if (!numberCol) return <div className="fox-widget-empty">Для графика нужна числовая колонка.</div>;
    const sample = rows.slice(0, 8);
    if (!sample.length) return <div className="fox-widget-empty">Добавьте записи в таблицу.</div>;
    const vals = sample.map(row => Number(row.cells[numberCol.id]) || 0);
    const max = Math.max(1, ...vals.map(Math.abs));
    return <div className="fox-widget-bars">{sample.map((row, i) => <div className="fox-widget-bar-row" key={row.id}><span title={String(row.cells[textCol?.id] ?? "")}>{String(row.cells[textCol?.id] ?? "Запись "+(i+1))}</span><div className="fox-widget-bar-track"><div style={{width:(Math.abs(vals[i])/max*100)+"%",background:widget.accent||"var(--accent)"}}/></div><b>{fmt(vals[i])}</b></div>)}</div>;
  }
  if (widget.type === "list") return <div className="fox-widget-list">{rows.slice(0, 6).map((row,i) => <div key={row.id}><span>{String(i+1).padStart(2,"0")}</span><strong>{String(row.cells[textCol?.id] ?? "Запись")}</strong>{numberCol && <small>{fmt(Number(row.cells[numberCol.id])||0)}</small>}</div>)}{!rows.length&&<div className="fox-widget-empty">Записей пока нет</div>}</div>;
  return <div className="fox-widget-table-scroll"><table><thead><tr>{table.columns.slice(0,5).map(c=><th key={c.id}>{c.name}</th>)}</tr></thead><tbody>{rows.slice(0,8).map(r=><tr key={r.id}>{table.columns.slice(0,5).map(c=><td key={c.id}>{c.type==="checkbox"?(r.cells[c.id]?"Да":"Нет"):String(r.cells[c.id]??"—")}</td>)}</tr>)}</tbody></table>{!rows.length&&<div className="fox-widget-empty">Записей пока нет</div>}</div>;
}

export default function FoxEditor({ screenId, tables, tableId, onTableChange, onOpenTables }: Props) {
  const [store, setStore] = useState<WidgetStore>(emptyStore);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRight, setShowRight] = useState(true);
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
    const numeric = defaultTable?.columns.find(c => c.type === "number");
    const text = defaultTable?.columns.find(c => c.type === "text");
    const widget: EditorWidget = {
      id: newId(), type, title: meta.title, tableId: meta.needsTable ? tableId : undefined,
      columnId: numeric?.id, labelColumnId: text?.id,
      target: 100, body: "", width: type === "table" ? 12 : type === "text" ? 6 : 6, height: type === "table" ? 270 : 205
    };
    updateWidgets(prev => [...prev, widget]);
    setSelectedId(widget.id); setRightMode("settings"); setSettingsTab("data");
  }
  function addTemplate(types: WidgetType[]) {
    if (!defaultTable) return;
    const numeric = defaultTable.columns.find(c => c.type === "number");
    const text = defaultTable.columns.find(c => c.type === "text");
    const additions = types.map(type => ({
      id: newId(), type, title: catalog.find(c => c.type === type)!.title,
      tableId, columnId: numeric?.id, labelColumnId: text?.id,
      target: 100, width: type === "table" ? 12 : 6, height: type === "table" ? 270 : 205
    }));
    updateWidgets(prev => [...prev, ...additions]);
    setSelectedId(additions[0].id); setRightMode("settings");
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
  const numericFields = selectedTable?.columns.filter(c => c.type === "number") ?? [];
  const allFields = selectedTable?.columns ?? [];

  return <div className="fox-editor">
    <div className="fox-editor-toolbar"><div><span className="fox-editor-overline">FOX EDITOR</span><h2>Редактор экрана</h2><p>Размещайте виджеты на сетке. Они используют данные подключённых таблиц.</p></div><div className="fox-editor-toolbar-actions"><button className="outline-button" onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Виджет</button><button className="soft-icon" title="Показать или скрыть панель" onClick={()=>setShowRight(v=>!v)}><PanelRightOpen size={18}/></button></div></div>
    <div className="fox-editor-layout">
      <div className="fox-editor-workspace">
        <div className="fox-editor-source"><Database size={16}/><span>Основная таблица</span><select value={tableId??""} onChange={e=>onTableChange(e.target.value)}><option value="">Не выбрана</option>{tables.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={onOpenTables}>Управление таблицами <ChevronsRight size={14}/></button></div>
        <div className="fox-editor-grid" ref={canvasRef}>
          {widgets.map(widget => {
            const table = tables.find(t => t.id === widget.tableId);
            const isSelected = selectedId === widget.id;
            return <div className={"fox-widget"+(isSelected?" selected":"")} style={{gridColumn:"span "+widget.width,minHeight:widget.height}} key={widget.id}
              draggable onDragStart={e=>{e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",widget.id);}}
              onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorder(e.dataTransfer.getData("text/plain"),widget.id);}}
              onClick={()=>{setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}}>
              <div className="fox-widget-header"><GripVertical size={14} className="fox-widget-grip"/><h3>{widget.title}</h3><button onClick={e=>{e.stopPropagation();setSelectedId(widget.id);setRightMode("settings");setShowRight(true);}} title="Параметры"><Settings2 size={16}/></button></div>
              <div className="fox-widget-body"><WidgetPreview widget={widget} table={table}/></div>
              <div className="fox-widget-resize" title="Перетащите для изменения ширины" onPointerDown={event=>{
                event.stopPropagation(); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
                event.currentTarget.dataset.startX=String(event.clientX);
              }} onPointerUp={event=>{
                const origin=Number(event.currentTarget.dataset.startX??event.clientX);
                resize(widget,event.clientX-origin); event.currentTarget.releasePointerCapture(event.pointerId);
              }}><LayoutGrid size={13}/></div>
            </div>;
          })}
          {!widgets.length && <div className="fox-editor-empty"><LayoutGrid size={30}/><h3>Пустой экран</h3><p>Добавьте первый виджет. Показатели, таблицы и графики будут брать данные из выбранного источника.</p><button className="primary-button" onClick={()=>{setShowRight(true);setRightMode("library");}}><Plus size={16}/> Выбрать виджет</button></div>}
        </div>
      </div>
      {showRight && <aside className="fox-editor-sidebar">
        <div className="fox-editor-side-head"><div><span>ПАНЕЛЬ FOX EDITOR</span><h3>{rightMode==="settings"&&selected?"Настройки виджета":"Библиотека виджетов"}</h3></div><button onClick={()=>setShowRight(false)} title="Закрыть панель"><X size={17}/></button></div>
        {rightMode==="settings"&&selected ? <>
          <div className="fox-editor-tabs"><button className={settingsTab==="data"?"active":""} onClick={()=>setSettingsTab("data")}><Database size={14}/> Данные</button><button className={settingsTab==="appearance"?"active":""} onClick={()=>setSettingsTab("appearance")}><Palette size={14}/> Вид</button><button className={settingsTab==="behavior"?"active":""} onClick={()=>setSettingsTab("behavior")}><SlidersHorizontal size={14}/> Поведение</button></div>
          <div className="fox-editor-fields">
            {settingsTab==="data" && <>
              <label>Название<input value={selected.title} onChange={e=>setWidget(selected.id,{title:e.target.value})}/></label>
              {selected.type==="text" ? <label>Текст<textarea rows={6} value={selected.body??""} onChange={e=>setWidget(selected.id,{body:e.target.value})}/></label> : <>
                <label>Источник<select value={selected.tableId??""} onChange={e=>setWidget(selected.id,{tableId:e.target.value,columnId:undefined,labelColumnId:undefined})}><option value="">Не выбрана</option>{tables.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                {["metric","progress","bars"].includes(selected.type)&&<label>Числовое поле<select value={selected.columnId??""} onChange={e=>setWidget(selected.id,{columnId:e.target.value})}><option value="">Автоматически</option>{numericFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {["bars","list"].includes(selected.type)&&<label>Подписи<select value={selected.labelColumnId??""} onChange={e=>setWidget(selected.id,{labelColumnId:e.target.value})}><option value="">Автоматически</option>{allFields.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                {selected.type==="progress"&&<label>Целевое значение<input type="number" value={selected.target??100} onChange={e=>setWidget(selected.id,{target:Number(e.target.value)})}/></label>}
              </>}
            </>}
            {settingsTab==="appearance" && <><label>Ширина на сетке<select value={selected.width} onChange={e=>setWidget(selected.id,{width:Number(e.target.value)})}>{[3,4,6,8,9,12].map(n=><option key={n} value={n}>{n} / 12</option>)}</select></label><label>Высота карточки<input type="number" min={140} max={600} step={10} value={selected.height} onChange={e=>setWidget(selected.id,{height:Math.max(140,Math.min(600,Number(e.target.value)||140))})}/></label><label>Акцент карточки<select value={selected.accent??""} onChange={e=>setWidget(selected.id,{accent:e.target.value||undefined})}><option value="">Акцент приложения</option><option value="#f06432">Оранжевый</option><option value="#4779d5">Синий</option><option value="#388b69">Зелёный</option><option value="#8864c8">Фиолетовый</option></select></label></>}
            {settingsTab==="behavior" && <><p>Перетаскивайте карточку за заголовок, чтобы менять порядок. Размер можно установить во вкладке «Вид» или потянуть за нижний правый угол.</p><button className="fox-editor-danger" onClick={()=>{updateWidgets(prev=>prev.filter(w=>w.id!==selected.id));setSelectedId(null);setRightMode("library");}}><Trash2 size={15}/> Удалить виджет</button></>}
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
