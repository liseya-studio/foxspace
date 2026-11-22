import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Filter, ArrowUpDown, MoreHorizontal, ChevronDown, Table2, FolderKanban,
  CalendarDays, Hash, Type, CheckSquare, UserRound, Tag, Trash2, Download,
  Columns3, Rows3, X, LayoutGrid, List, SlidersHorizontal
} from "lucide-react";

type ColumnType = "text" | "number" | "date" | "select" | "checkbox" | "person" | "relation" | "formula" | "project";
type Column = { id: string; name: string; type: ColumnType; options?: string[]; relationTableId?: string; formulaSourceId?: string; formulaOperator?: string; formulaFactor?: number; width?: number };
type Cell = string | number | boolean;
type RowData = { id: string; cells: Record<string, Cell> };
type SavedView = { id: string; name: string; filterColumn: string; filterOperator: string; filterValue: string; secondColumn?: string; secondOperator?: string; secondValue?: string; logic?: "and" | "or"; categoryFilter?: string; groupColumn: string; sortColumn: string; sortDirection: "asc" | "desc"; layout?: "table" | "list" };
type DataTable = { id: string; name: string; columns: Column[]; rows: RowData[]; updatedAt: string; savedViews?: SavedView[] };

const KEY = "fox-tables-v1";
const types: { value: ColumnType; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Текст", icon: Type },
  { value: "number", label: "Число", icon: Hash },
  { value: "date", label: "Дата", icon: CalendarDays },
  { value: "select", label: "Выбор", icon: Tag },
  { value: "checkbox", label: "Флажок", icon: CheckSquare },
  { value: "person", label: "Пользователь", icon: UserRound },
  { value: "relation", label: "Связанная запись", icon: LayoutGrid },
  { value: "project", label: "Проект", icon: FolderKanban },
  { value: "formula", label: "Формула", icon: Hash },
];

const initialTables: DataTable[] = [];

function loadTables(): DataTable[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as DataTable[] : initialTables; }
  catch { return initialTables; }
}
const id = () => crypto.randomUUID();


export default function TableWorkspace({openCreate=false,onCreateConsumed}:{openCreate?:boolean;onCreateConsumed?:()=>void}) {
  const [tables, setTables] = useState<DataTable[]>(loadTables);
  const [projectRevision,setProjectRevision]=useState(0);
  const projectOptions=useMemo(()=>readProjects().projects,[projectRevision]);
  const [activeId, setActiveId] = useState<string | null>(() => loadTables()[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnDialog, setColumnDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [relationTableId, setRelationTableId] = useState("");
  const [formulaSourceId, setFormulaSourceId] = useState("");
  const [formulaOperator, setFormulaOperator] = useState("*");
  const [formulaFactor, setFormulaFactor] = useState("1");
  const [tableDialog, setTableDialog] = useState(openCreate);
  const [newTableName, setNewTableName] = useState("");
  const [view, setView] = useState<"table" | "list">("table");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  const [secondColumn, setSecondColumn] = useState("");
  const [secondOperator, setSecondOperator] = useState("contains");
  const [secondValue, setSecondValue] = useState("");
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [groupColumn, setGroupColumn] = useState("");
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);


  useEffect(()=>{if(openCreate)onCreateConsumed?.();},[openCreate]);
  useEffect(()=>{const update=()=>setProjectRevision(value=>value+1);window.addEventListener("fox-projects-updated",update);return ()=>window.removeEventListener("fox-projects-updated",update);},[]);
  void projectRevision;
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(tables)); window.dispatchEvent(new Event("fox-tables-updated")); }, [tables]);
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
    const column: Column = { id: id(), name, type: newColumnType, ...(newColumnType === "select" ? { options: ["Новый", "В работе", "Готово"] } : {}), ...(newColumnType === "relation" ? { relationTableId: relationTableId || tables.find(t => t.id !== activeId)?.id } : {}), ...(newColumnType === "formula" ? { formulaSourceId, formulaOperator, formulaFactor: Number(formulaFactor) } : {}) };
    updateTable(t => ({ ...t, columns: [...t.columns, column], rows: t.rows.map(r => ({ ...r, cells: { ...r.cells, [column.id]: column.type === "checkbox" ? false : column.type === "number" ? 0 : "" } })) }));
    setNewColumnName(""); setNewColumnType("text"); setRelationTableId(""); setFormulaSourceId(""); setFormulaOperator("*"); setFormulaFactor("1"); setColumnDialog(false);
  }
  function updateCell(rowId: string, columnId: string, value: Cell) {
    updateTable(t => ({ ...t, rows: t.rows.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [columnId]: value } } : r) }));
  }
  function deleteColumn(columnId: string) {
    if (!activeTable || activeTable.columns.length <= 1) return;
    updateTable(t => ({ ...t, columns: t.columns.filter(c => c.id !== columnId), rows: t.rows.map(r => { const cells = { ...r.cells }; delete cells[columnId]; return { ...r, cells }; }) }));
  }
  function moveColumn(from: string, to: string) {
    if (from === to) return;
    updateTable(t => { const columns = [...t.columns]; const source = columns.findIndex(col => col.id === from); const destination = columns.findIndex(col => col.id === to); if (source < 0 || destination < 0) return t; columns.splice(destination, 0, columns.splice(source, 1)[0]); return { ...t, columns }; });
  }
  function resizeColumn(columnId: string, width: number) { updateTable(t => ({ ...t, columns: t.columns.map(col => col.id === columnId ? { ...col, width: Math.max(110, Math.min(600, width)) } : col) })); }
  function deleteTable() {
    if (!activeTable || !window.confirm("Удалить таблицу «"+activeTable.name+"» со всеми записями?")) return;
    const next = tables.filter(t => t.id !== activeTable.id);
    setTables(next); setActiveId(next[0]?.id ?? null); setQuery(""); setSort(null); setCategoryFilter("Все"); setFilterColumn(""); setSecondColumn(""); setGroupColumn("");
  }
  function deleteRow(rowId: string) { updateTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) })); }

  const categories = useMemo(() => {
    const col = activeTable?.columns.find(c => c.type === "select");
    return col ? ["Все", ...Array.from(new Set(activeTable!.rows.map(r => String(r.cells[col.id] ?? "")).filter(Boolean)))] : ["Все"];
  }, [activeTable]);
  const visibleRows = useMemo(() => {
    if (!activeTable) return [];
    const evaluate = (row: RowData, columnId: string, operator: string, expected: string) => {
      const column = activeTable.columns.find(item => item.id === columnId);
      if (!column) return true;
      const raw = computedCell(column, row);
      const value = String(raw ?? "").toLocaleLowerCase("ru");
      const target = expected.trim().toLocaleLowerCase("ru");
      if (operator === "empty") return value === "";
      if (operator === "not_empty") return value !== "";
      if (operator === "equals") return value === target;
      if (operator === "not_equals") return value !== target;
      if (operator === "gt" || operator === "lt") {
        const a = Number(raw), b = Number(expected);
        if (!String(raw ?? "").trim() || !expected.trim() || !Number.isFinite(a) || !Number.isFinite(b)) return false;
        return operator === "gt" ? a > b : a < b;
      }
      return value.includes(target);
    };
    const firstActive = Boolean(filterColumn && (filterValue.trim() || ["empty", "not_empty"].includes(filterOperator)));
    const secondActive = Boolean(secondColumn && (secondValue.trim() || ["empty", "not_empty"].includes(secondOperator)));
    const categoryColumn = activeTable.columns.find(col => col.type === "select");
    let rows = activeTable.rows.filter(row => {
      if (categoryColumn && categoryFilter !== "Все" && String(row.cells[categoryColumn.id] ?? "") !== categoryFilter) return false;
      if (query && !activeTable.columns.some(col => String(computedCell(col, row) ?? "").toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")))) return false;
      const one = !firstActive || evaluate(row, filterColumn, filterOperator, filterValue);
      const two = !secondActive || evaluate(row, secondColumn, secondOperator, secondValue);
      return firstActive && secondActive ? logic === "and" ? one && two : one || two : one && two;
    });
    if (sort) {
      const column = activeTable.columns.find(col => col.id === sort.key);
      if (column) rows = [...rows].sort((a, b) => {
        const av = computedCell(column, a) ?? "";
        const bv = computedCell(column, b) ?? "";
        const result = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "ru", { numeric: true });
        return sort.direction === "asc" ? result : -result;
      });
    }
    return rows;
  }, [activeTable, query, categoryFilter, sort, filterColumn, filterOperator, filterValue, secondColumn, secondOperator, secondValue, logic]);

  const groupedRows = useMemo(() => {
    if (!activeTable || !groupColumn) return [{ label: "", rows: visibleRows }];
    const groups = new Map<string, RowData[]>();
    visibleRows.forEach(row => {
      const column = activeTable.columns.find(col => col.id === groupColumn); const label = column ? String(computedCell(column,row) || "Без значения") : "Без значения";
      groups.set(label, [...(groups.get(label) ?? []), row]);
    });
    return Array.from(groups.entries()).map(([label, rows]) => ({ label, rows }));
  }, [activeTable, groupColumn, visibleRows]);

  function exportCsv() {
    if (!activeTable) return;
    const quote = (v: Cell | undefined) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const csv = [activeTable.columns.map(c => quote(c.name)).join(";"), ...activeTable.rows.map(r => activeTable.columns.map(c => quote(computedCell(c,r) ?? "")).join(";"))].join("\n");
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
          <div className="table-title-row"><div><div className="table-breadcrumb">Файлы и таблицы <span>/</span> Таблицы</div><h2>{activeTable.name} <button className="tiny-icon" title="Переименовать" onClick={() => { const n = window.prompt("Название таблицы", activeTable.name); if (n?.trim()) setTables(ts => ts.map(t => t.id === activeId ? {...t,name:n.trim()} : t)); }}><MoreHorizontal size={17}/></button></h2><div className="table-subtitle">{activeTable.rows.length} записей <span>·</span> {activeTable.columns.length} полей <span>·</span> Изменения сохраняются автоматически</div>{(activeTable.savedViews?.length??0)>0 && <div className="saved-views">{activeTable.savedViews?.map(s=><span className="saved-view-chip" key={s.id}><button onClick={()=>{setFilterColumn(s.filterColumn);setFilterOperator(s.filterOperator);setFilterValue(s.filterValue);setSecondColumn(s.secondColumn??"");setSecondOperator(s.secondOperator??"contains");setSecondValue(s.secondValue??"");setLogic(s.logic??"and");setCategoryFilter(s.categoryFilter??"Все");setGroupColumn(s.groupColumn);setSort(s.sortColumn?{key:s.sortColumn,direction:s.sortDirection}:null);setView(s.layout??"table");setShowFilters(true);}}>{s.name}</button><button className="saved-view-delete" title={"Удалить вид "+s.name} onClick={()=>updateTable(t=>({...t,savedViews:(t.savedViews??[]).filter(v=>v.id!==s.id)}))}><X size={12}/></button></span>)}</div>}</div><div className="table-top-actions"><button className="soft-icon" onClick={exportCsv} title="Экспорт CSV"><Download size={17}/></button><button className="soft-icon table-danger" onClick={deleteTable} title="Удалить таблицу"><Trash2 size={16}/></button></div></div>
          <div className="table-toolbar">
            <div className="table-toolbar-left"><div className="table-view-switch"><button className={view==="table"?"chosen":""} onClick={() => setView("table")}><Table2 size={15}/> Таблица</button><button className={view==="list"?"chosen":""} onClick={() => setView("list")}><List size={15}/> Список</button></div><button className={showFilters?"toolbar-button chosen":"toolbar-button"} onClick={() => setShowFilters(v => !v)}><Filter size={15}/> Фильтр {categoryFilter!=="Все" && <i/>}</button><button className="toolbar-button" onClick={() => setSort(sort ? null : {key:activeTable.columns[0].id,direction:"asc"})}><ArrowUpDown size={15}/> Сортировка</button><select className="group-select" value={groupColumn} onChange={e=>setGroupColumn(e.target.value)}><option value="">Без группировки</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>Группировать: {col.name}</option>)}</select><button className="toolbar-button" onClick={()=>{const name=window.prompt("Название представления");if(!name?.trim())return;const saved:SavedView={id:id(),name:name.trim(),filterColumn,filterOperator,filterValue,secondColumn,secondOperator,secondValue,logic,categoryFilter,groupColumn,sortColumn:sort?.key??"",sortDirection:sort?.direction??"asc",layout:view};updateTable(t=>({...t,savedViews:[...(t.savedViews??[]),saved]}));}}><Plus size={14}/> Сохранить вид</button></div>
            <div className="table-toolbar-right"><label className="table-search"><Search size={15}/><input placeholder="Найти в таблице" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="toolbar-button" onClick={() => setColumnDialog(true)}><Columns3 size={15}/> Поля</button><button className="primary-button compact" onClick={addRow}><Plus size={15}/> Добавить запись</button></div>
          </div>
          {showFilters && <div className="filter-bar"><SlidersHorizontal size={15}/><span>Поле</span><select value={filterColumn} onChange={e=>setFilterColumn(e.target.value)}><option value="">Любое</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select><select value={filterOperator} onChange={e=>setFilterOperator(e.target.value)}><option value="contains">содержит</option><option value="equals">равно</option><option value="not_equals">не равно</option><option value="gt">больше</option><option value="lt">меньше</option><option value="empty">пусто</option><option value="not_empty">не пусто</option></select><input className="filter-value" placeholder="Значение" value={filterValue} onChange={e=>setFilterValue(e.target.value)}/><select value={logic} onChange={e=>setLogic(e.target.value as "and"|"or")}><option value="and">И</option><option value="or">ИЛИ</option></select><select value={secondColumn} onChange={e=>setSecondColumn(e.target.value)}><option value="">Второе поле</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select><select value={secondOperator} onChange={e=>setSecondOperator(e.target.value)}><option value="contains">содержит</option><option value="equals">равно</option><option value="not_equals">не равно</option><option value="gt">больше</option><option value="lt">меньше</option><option value="empty">пусто</option><option value="not_empty">не пусто</option></select><input className="filter-value" placeholder="Второе значение" value={secondValue} onChange={e=>setSecondValue(e.target.value)}/><button className="text-button-inline" onClick={()=>{setFilterColumn("");setFilterValue("");setSecondColumn("");setSecondValue("");setSecondOperator("contains");setLogic("and");setCategoryFilter("Все");}}>Сбросить</button></div>}
          {view === "table" ? <div className="data-grid-wrap"><table className="data-grid"><colgroup><col style={{width:35}}/>{activeTable.columns.map(col=><col key={col.id} style={{width:col.width??170}}/>)}<col style={{width:38}}/></colgroup><thead><tr><th className="row-index">#</th>{activeTable.columns.map(col => <th key={col.id} draggable onDragStart={e=>{setDraggedColumn(col.id);e.dataTransfer.setData("text/plain",col.id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();moveColumn(e.dataTransfer.getData("text/plain"),col.id);setDraggedColumn(null);}} onDragEnd={()=>setDraggedColumn(null)} style={{width:col.width??170,minWidth:col.width??170}}><button className="column-head" onClick={() => setSort(s => s?.key===col.id ? {key:col.id,direction:s.direction==="asc"?"desc":"asc"} : {key:col.id,direction:"asc"})}>{col.type==="number"?<Hash size={13}/>:col.type==="date"?<CalendarDays size={13}/>:col.type==="checkbox"?<CheckSquare size={13}/>:col.type==="select"?<Tag size={13}/>:col.type==="project"?<FolderKanban size={13}/>:<Type size={13}/>} {col.name}{sort?.key===col.id && <span>{sort.direction==="asc"?"↑":"↓"}</span>}</button><button className="column-menu" onClick={() => deleteColumn(col.id)} title="Удалить поле"><X size={12}/></button><input className="column-width" type="range" min="110" max="360" step="10" value={col.width??170} onChange={e=>resizeColumn(col.id,Number(e.target.value))} aria-label={"Ширина: "+col.name}/></th>)}<th className="add-col-head"><button onClick={() => setColumnDialog(true)} title="Добавить поле"><Plus size={15}/></button></th></tr></thead><tbody>{groupedRows.map(group=><Fragment key={group.label}>{group.label && <tr className="group-heading" key={"group-"+group.label}><td colSpan={activeTable.columns.length+2}>{group.label}<span>{group.rows.length} записей</span></td></tr>}{group.rows.map((row,index) => <tr key={row.id}><td className="row-index">{index+1}</td>{activeTable.columns.map(col => <td key={col.id}>{renderCell(col,computedCell(col,row),v=>updateCell(row.id,col.id,v),tables,projectOptions)}</td>)}<td className="row-actions"><button onClick={() => deleteRow(row.id)} title="Удалить запись"><Trash2 size={13}/></button></td></tr>)}</Fragment>)}</tbody></table>{visibleRows.length===0 && <div className="table-no-results">Нет записей по выбранным условиям</div>}<button className="add-row-inline" onClick={addRow}><Plus size={14}/> Добавить запись</button></div> : <div className="record-list">{visibleRows.map((row,index)=><div className="record-card" key={row.id}><span className="record-number">{String(index+1).padStart(2,"0")}</span><div className="record-fields">{activeTable.columns.map(c=><div key={c.id}><small>{c.name}</small>{renderCell(c,computedCell(c,row),v=>updateCell(row.id,c.id,v),tables,projectOptions)}</div>)}</div><button onClick={()=>deleteRow(row.id)} className="tiny-icon"><Trash2 size={14}/></button></div>)}</div>}
          <div className="table-footer"><span>Показано {visibleRows.length} из {activeTable.rows.length} записей</span><span><Rows3 size={14}/> Все изменения сохраняются автоматически</span></div>
        </> : <div className="table-empty"><div className="empty-icon"><Table2 size={24}/></div><h2>Создайте первую таблицу</h2><p>Таблицы можно привязывать к пользовательским экранам и использовать как источник данных для виджетов.</p><button className="primary-button" onClick={() => setTableDialog(true)}><Plus size={16}/> Создать таблицу</button></div>}
      </div>
    </div>
    {tableDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setTableDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setTableDialog(false)}><X size={18}/></button><div className="dialog-icon"><Table2 size={21}/></div><h2>Новая таблица</h2><p>Создайте таблицу. Позже к ней можно будет подключать представления и виджеты на пользовательских экранах.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Проекты" value={newTableName} onChange={e=>setNewTableName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTable()}/></label><button className="primary-button full" disabled={!newTableName.trim()} onClick={createTable}><Plus size={16}/> Создать таблицу</button><button className="text-button" onClick={()=>setTableDialog(false)}>Отмена</button></div></div>}
    {columnDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setColumnDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setColumnDialog(false)}><X size={18}/></button><div className="dialog-icon"><Columns3 size={21}/></div><h2>Новое поле</h2><p>Выберите тип данных для новой колонки.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Приоритет" value={newColumnName} onChange={e=>setNewColumnName(e.target.value)}/></label><label className="form-label">Тип поля<select className="form-input" value={newColumnType} onChange={e=>setNewColumnType(e.target.value as ColumnType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>{newColumnType==="relation" && <label className="form-label">Связать с таблицей<select className="form-input" value={relationTableId} onChange={e=>setRelationTableId(e.target.value)}><option value="">Выберите таблицу</option>{tables.filter(t=>t.id!==activeId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}{newColumnType==="formula" && <><label className="form-label">Числовое поле-источник<select className="form-input" value={formulaSourceId} onChange={e=>setFormulaSourceId(e.target.value)}><option value="">Выберите поле</option>{activeTable?.columns.filter(col=>col.type==="number").map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label><label className="form-label">Операция<select className="form-input" value={formulaOperator} onChange={e=>setFormulaOperator(e.target.value)}><option value="*">Умножить</option><option value="/">Разделить</option><option value="+">Прибавить</option><option value="-">Вычесть</option></select></label><label className="form-label">Число<input className="form-input" type="number" value={formulaFactor} onChange={e=>setFormulaFactor(e.target.value)}/></label></>}<button className="primary-button full" disabled={!newColumnName.trim() || (newColumnType==="relation" && !relationTableId) || (newColumnType==="formula" && !formulaSourceId)} onClick={addColumn}><Plus size={16}/> Добавить поле</button><button className="text-button" onClick={()=>setColumnDialog(false)}>Отмена</button></div></div>}
  </section>;
}

function computedCell(column: Column, row: RowData): Cell | undefined {
  if (column.type !== "formula" || !column.formulaSourceId) return row.cells[column.id];
  const source = Number(row.cells[column.formulaSourceId] ?? 0);
  const factor = Number(column.formulaFactor ?? 1);
  if (column.formulaOperator === "/") return factor === 0 ? "—" : source / factor;
  if (column.formulaOperator === "+") return source + factor;
  if (column.formulaOperator === "-") return source - factor;
  return source * factor;
}

function FolderIcon() { return <span className="folder-mark"><LayoutGrid size={13}/></span>; }

function renderCell(column: Column, value: Cell | undefined, onChange: (v: Cell) => void, tables: DataTable[] = [], projects: Project[] = []) {
  if (column.type === "project") { return <select className="cell-select" value={String(value??"")} onChange={e=>onChange(e.target.value)}><option value="">Без проекта</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select>; }
  if (column.type === "formula") return <span className="formula-value">{value ?? "—"}</span>;
  if (column.type === "relation") { const target = tables.find(t=>t.id===column.relationTableId); return <select className="cell-select" value={String(value ?? "")} onChange={e=>onChange(e.target.value)}><option value="">—</option>{target?.rows.map(row=><option key={row.id} value={row.id}>{String(row.cells[target.columns[0]?.id] ?? "Запись")}</option>)}</select>; }
  if (column.type === "checkbox") return <label className="checkbox-cell"><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/><span>{value?"Да":"Нет"}</span></label>;
  if (column.type === "select") return <select className="cell-select" value={String(value ?? "")} onChange={e=>onChange(e.target.value)}><option value="">—</option>{(column.options ?? ["Новый","В работе","Готово"]).map(o=><option key={o}>{o}</option>)}</select>;
  return <input className="cell-input" type={column.type==="number"?"number":column.type==="date"?"date":"text"} value={String(value ?? "")} onChange={e=>onChange(column.type==="number"?(e.target.value===""?0:Number(e.target.value)):e.target.value)} />;
}
