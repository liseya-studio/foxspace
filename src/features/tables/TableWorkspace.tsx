import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Filter, ArrowUpDown, MoreHorizontal, ChevronDown, Table2,
  CalendarDays, Hash, Type, CheckSquare, UserRound, Tag, Trash2, Download,
  Columns3, Rows3, X, LayoutGrid, List, SlidersHorizontal
} from "lucide-react";

type ColumnType = "text" | "number" | "date" | "select" | "checkbox" | "person" | "relation" | "formula";
type Column = { id: string; name: string; type: ColumnType; options?: string[]; relationTableId?: string; formulaSourceId?: string };
type Cell = string | number | boolean;
type RowData = { id: string; cells: Record<string, Cell> };
type SavedView = { id: string; name: string; filterColumn: string; filterOperator: string; filterValue: string; groupColumn: string; sortColumn: string; sortDirection: "asc" | "desc" };
type DataTable = { id: string; name: string; columns: Column[]; rows: RowData[]; updatedAt: string; savedViews?: SavedView[] };

const KEY = "fox-tables-v1";
const types: { value: ColumnType; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Текст", icon: Type },
  { value: "number", label: "Число", icon: Hash },
  { value: "date", label: "Дата", icon: CalendarDays },
  { value: "select", label: "Выбор", icon: Tag },
  { value: "checkbox", label: "Флажок", icon: CheckSquare },
  { value: "person", label: "Пользователь", icon: UserRound },
];

const initialTables: DataTable[] = [{
  id: "finance-demo",
  name: "Финансовые операции",
  updatedAt: new Date().toISOString(),
  columns: [
    { id: "title", name: "Операция", type: "text" },
    { id: "category", name: "Категория", type: "select", options: ["Доход", "Расход", "Перевод"] },
    { id: "amount", name: "Сумма", type: "number" },
    { id: "date", name: "Дата", type: "date" },
    { id: "paid", name: "Оплачено", type: "checkbox" },
  ],
  rows: [
    { id: "r1", cells: { title: "Оплата проекта", category: "Доход", amount: 45000, date: "2026-11-12", paid: true } },
    { id: "r2", cells: { title: "Аренда", category: "Расход", amount: 28000, date: "2026-11-10", paid: true } },
    { id: "r3", cells: { title: "Подписки и сервисы", category: "Расход", amount: 2490, date: "2026-11-08", paid: false } },
    { id: "r4", cells: { title: "Монтаж ролика", category: "Доход", amount: 12000, date: "2026-11-06", paid: true } },
    { id: "r5", cells: { title: "Продукты", category: "Расход", amount: 3650, date: "2026-11-04", paid: true } },
  ],
}];

function loadTables(): DataTable[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as DataTable[] : initialTables; }
  catch { return initialTables; }
}
const id = () => crypto.randomUUID();
const formatDate = (value: string) => value ? new Date(value + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function TableWorkspace() {
  const [tables, setTables] = useState<DataTable[]>(loadTables);
  const [activeId, setActiveId] = useState<string | null>(() => loadTables()[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnDialog, setColumnDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [tableDialog, setTableDialog] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [view, setView] = useState<"table" | "list">("table");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  const [groupColumn, setGroupColumn] = useState("");

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(tables)); }, [tables]);
  const activeTable = tables.find(t => t.id === activeId) ?? null;

  function updateTable(updater: (table: DataTable) => DataTable) {
    setTables(current => current.map(t => t.id === activeId ? updater({ ...t, updatedAt: new Date().toISOString() }) : t));
  }
  function createTable() {
    const name = newTableName.trim();
    if (!name) return;
    const table: DataTable = {
      id: id(), name, updatedAt: new Date().toISOString(),
      columns: [
        { id: "name", name: "Название", type: "text" },
        { id: "status", name: "Статус", type: "select", options: ["Не начато", "В работе", "Готово"] },
        { id: "date", name: "Дата", type: "date" },
      ], rows: []
    };
    setTables(current => [...current, table]); setActiveId(table.id); setNewTableName(""); setTableDialog(false); setQuery(""); setCategoryFilter("Все");
  }
  function addRow() {
    if (!activeTable) return;
    const cells: Record<string, Cell> = {};
    activeTable.columns.forEach(c => { cells[c.id] = c.type === "checkbox" ? false : c.type === "number" ? 0 : ""; });
    updateTable(t => ({ ...t, rows: [...t.rows, { id: id(), cells }] }));
  }
  function addColumn() {
    const name = newColumnName.trim();
    if (!name || !activeTable) return;
    const column: Column = { id: id(), name, type: newColumnType, ...(newColumnType === "select" ? { options: ["Новый", "В работе", "Готово"] } : {}) };
    updateTable(t => ({ ...t, columns: [...t.columns, column], rows: t.rows.map(r => ({ ...r, cells: { ...r.cells, [column.id]: column.type === "checkbox" ? false : column.type === "number" ? 0 : "" } })) }));
    setNewColumnName(""); setNewColumnType("text"); setColumnDialog(false);
  }
  function updateCell(rowId: string, columnId: string, value: Cell) {
    updateTable(t => ({ ...t, rows: t.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: value } } : r) }));
  }
  function deleteColumn(columnId: string) {
    if (!activeTable || activeTable.columns.length <= 1) return;
    updateTable(t => ({ ...t, columns: t.columns.filter(c => c.id !== columnId), rows: t.rows.map(r => { const cells = { ...r.cells }; delete cells[columnId]; return { ...r, cells }; }) }));
  }
  function deleteRow(rowId: string) { updateTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) })); }

  const categories = useMemo(() => {
    const col = activeTable?.columns.find(c => c.type === "select");
    return col ? ["Все", ...Array.from(new Set(activeTable!.rows.map(r => String(r.cells[col.id] ?? "")).filter(Boolean)))] : ["Все"];
  }, [activeTable]);
  const visibleRows = useMemo(() => {
    if (!activeTable) return [];
    let rows = activeTable.rows.filter(row => activeTable.columns.some(col => String(row.cells[col.id] ?? "").toLowerCase().includes(query.toLowerCase())));
    const selectCol = activeTable.columns.find(c => c.type === "select");
    if (categoryFilter !== "Все" && selectCol) rows = rows.filter(r => r.cells[selectCol.id] === categoryFilter);
    if (filterColumn && filterValue.trim()) rows = rows.filter(r => { const value = String(r.cells[filterColumn] ?? "").toLowerCase(); const target = filterValue.toLowerCase(); if (filterOperator === "equals") return value === target; if (filterOperator === "not_equals") return value !== target; if (filterOperator === "gt") return Number(value) > Number(target); if (filterOperator === "lt") return Number(value) < Number(target); if (filterOperator === "empty") return !value; return value.includes(target); });
    if (sort) rows = [...rows].sort((a,b) => {
      const av = a.cells[sort.key] ?? ""; const bv = b.cells[sort.key] ?? "";
      const result = typeof av === "number" && typeof bv === "number" ? av-bv : String(av).localeCompare(String(bv), "ru");
      return sort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [activeTable, query, categoryFilter, sort, filterColumn, filterOperator, filterValue]);

  function exportCsv() {
    if (!activeTable) return;
    const quote = (v: Cell) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const csv = [activeTable.columns.map(c => quote(c.name)).join(";"), ...activeTable.rows.map(r => activeTable.columns.map(c => quote(r.cells[c.id] ?? "")).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = activeTable.name + ".csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="table-workspace">
    <div className="table-page-heading">
      <div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h1>Файлы и таблицы</h1><p>Создавайте таблицы, настраивайте поля и управляйте данными.</p></div>
      <button className="primary-button" onClick={() => setTableDialog(true)}><Plus size={16}/> Новая таблица</button>
    </div>
    <div className="table-layout">
      <aside className="table-library">
        <div className="table-library-head"><span>ТАБЛИЦЫ</span><button className="tiny-icon" onClick={() => setTableDialog(true)} title="Новая таблица"><Plus size={16}/></button></div>
        {tables.map(t => <button key={t.id} className={activeId === t.id ? "table-library-item selected" : "table-library-item"} onClick={() => { setActiveId(t.id); setQuery(""); setCategoryFilter("Все"); setSort(null); }}><Table2 size={16}/><span>{t.name}</span><small>{t.rows.length}</small></button>)}
        <div className="table-library-foot"><FolderIcon/><span>Локальные таблицы</span></div>
      </aside>
      <div className="table-main">
        {activeTable ? <>
          <div className="table-title-row"><div><div className="table-breadcrumb">Файлы и таблицы <span>/</span> Таблицы</div><h2>{activeTable.name} <button className="tiny-icon" title="Переименовать" onClick={() => { const n = window.prompt("Название таблицы", activeTable.name); if (n?.trim()) setTables(ts => ts.map(t => t.id === activeId ? {...t,name:n.trim()} : t)); }}><MoreHorizontal size={17}/></button></h2><div className="table-subtitle">{activeTable.rows.length} записей <span>·</span> {activeTable.columns.length} полей <span>·</span> Изменения сохраняются автоматически</div></div><button className="soft-icon" onClick={exportCsv} title="Экспорт CSV"><Download size={17}/></button></div>
          <div className="table-toolbar">
            <div className="table-toolbar-left"><div className="table-view-switch"><button className={view==="table"?"chosen":""} onClick={() => setView("table")}><Table2 size={15}/> Таблица</button><button className={view==="list"?"chosen":""} onClick={() => setView("list")}><List size={15}/> Список</button></div><button className={showFilters?"toolbar-button chosen":"toolbar-button"} onClick={() => setShowFilters(v => !v)}><Filter size={15}/> Фильтр {categoryFilter!=="Все" && <i/>}</button><button className="toolbar-button" onClick={() => setSort(sort ? null : {key:activeTable.columns[0].id,direction:"asc"})}><ArrowUpDown size={15}/> Сортировка</button></div>
            <div className="table-toolbar-right"><label className="table-search"><Search size={15}/><input placeholder="Найти в таблице" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="toolbar-button" onClick={() => setColumnDialog(true)}><Columns3 size={15}/> Поля</button><button className="primary-button compact" onClick={addRow}><Plus size={15}/> Добавить запись</button></div>
          </div>
          {showFilters && <div className="filter-bar"><SlidersHorizontal size={15}/><span>Поле</span><select value={filterColumn} onChange={e=>setFilterColumn(e.target.value)}><option value="">Любое</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select><select value={filterOperator} onChange={e=>setFilterOperator(e.target.value)}><option value="contains">содержит</option><option value="equals">равно</option><option value="not_equals">не равно</option><option value="gt">больше</option><option value="lt">меньше</option><option value="empty">пусто</option></select><input className="filter-value" placeholder="Значение" value={filterValue} onChange={e=>setFilterValue(e.target.value)}/><button className="text-button-inline" onClick={()=>{setFilterColumn("");setFilterValue("");setCategoryFilter("Все");}}>Сбросить</button></div>}
          {view === "table" ? <div className="data-grid-wrap"><table className="data-grid"><thead><tr><th className="row-index">#</th>{activeTable.columns.map(col => <th key={col.id}><button className="column-head" onClick={() => setSort(s => s?.key===col.id ? {key:col.id,direction:s.direction==="asc"?"desc":"asc"} : {key:col.id,direction:"asc"})}>{col.type==="number"?<Hash size={13}/>:col.type==="date"?<CalendarDays size={13}/>:col.type==="checkbox"?<CheckSquare size={13}/>:col.type==="select"?<Tag size={13}/>:<Type size={13}/>} {col.name}{sort?.key===col.id && <span>{sort.direction==="asc"?"↑":"↓"}</span>}</button><button className="column-menu" onClick={() => deleteColumn(col.id)} title="Удалить поле"><X size={12}/></button></th>)}<th className="add-col-head"><button onClick={() => setColumnDialog(true)} title="Добавить поле"><Plus size={15}/></button></th></tr></thead><tbody>{visibleRows.map((row,index) => <tr key={row.id}><td className="row-index">{index+1}</td>{activeTable.columns.map(col => <td key={col.id}>{renderCell(col,row.cells[col.id],v=>updateCell(row.id,col.id,v))}</td>)}<td className="row-actions"><button onClick={() => deleteRow(row.id)} title="Удалить запись"><Trash2 size={13}/></button></td></tr>)}</tbody></table>{visibleRows.length===0 && <div className="table-no-results">Нет записей по выбранным условиям</div>}<button className="add-row-inline" onClick={addRow}><Plus size={14}/> Добавить запись</button></div> : <div className="record-list">{visibleRows.map((row,index)=><div className="record-card" key={row.id}><span className="record-number">{String(index+1).padStart(2,"0")}</span><div className="record-fields">{activeTable.columns.map(c=><div key={c.id}><small>{c.name}</small>{renderCell(c,row.cells[c.id],v=>updateCell(row.id,c.id,v))}</div>)}</div><button onClick={()=>deleteRow(row.id)} className="tiny-icon"><Trash2 size={14}/></button></div>)}</div>}
          <div className="table-footer"><span>Показано {visibleRows.length} из {activeTable.rows.length} записей</span><span><Rows3 size={14}/> Все изменения сохраняются автоматически</span></div>
        </> : <div className="table-empty"><div className="empty-icon"><Table2 size={24}/></div><h2>Создайте первую таблицу</h2><p>Таблицы можно привязывать к пользовательским экранам и использовать как источник данных для виджетов.</p><button className="primary-button" onClick={() => setTableDialog(true)}><Plus size={16}/> Создать таблицу</button></div>}
      </div>
    </div>
    {tableDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setTableDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setTableDialog(false)}><X size={18}/></button><div className="dialog-icon"><Table2 size={21}/></div><h2>Новая таблица</h2><p>Создайте таблицу. Позже к ней можно будет подключать представления и виджеты на пользовательских экранах.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Проекты" value={newTableName} onChange={e=>setNewTableName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTable()}/></label><button className="primary-button full" disabled={!newTableName.trim()} onClick={createTable}><Plus size={16}/> Создать таблицу</button><button className="text-button" onClick={()=>setTableDialog(false)}>Отмена</button></div></div>}
    {columnDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setColumnDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setColumnDialog(false)}><X size={18}/></button><div className="dialog-icon"><Columns3 size={21}/></div><h2>Новое поле</h2><p>Выберите тип данных для новой колонки.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Приоритет" value={newColumnName} onChange={e=>setNewColumnName(e.target.value)}/></label><label className="form-label">Тип поля<select className="form-input" value={newColumnType} onChange={e=>setNewColumnType(e.target.value as ColumnType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label><button className="primary-button full" disabled={!newColumnName.trim()} onClick={addColumn}><Plus size={16}/> Добавить поле</button><button className="text-button" onClick={()=>setColumnDialog(false)}>Отмена</button></div></div>}
  </section>;
}

function FolderIcon() { return <span className="folder-mark"><LayoutGrid size={13}/></span>; }

function renderCell(column: Column, value: Cell | undefined, onChange: (v: Cell) => void) {
  if (column.type === "checkbox") return <label className="checkbox-cell"><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/><span>{value?"Да":"Нет"}</span></label>;
  if (column.type === "select") return <select className="cell-select" value={String(value ?? "")} onChange={e=>onChange(e.target.value)}><option value="">—</option>{(column.options ?? ["Новый","В работе","Готово"]).map(o=><option key={o}>{o}</option>)}</select>;
  return <input className="cell-input" type={column.type==="number"?"number":column.type==="date"?"date":"text"} value={String(value ?? "")} onChange={e=>onChange(column.type==="number"?(e.target.value===""?0:Number(e.target.value)):e.target.value)} />;
}
