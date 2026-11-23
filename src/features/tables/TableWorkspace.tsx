import { readProjects, type Project } from "../projects/data";
import { valueForColumn, relationIds, linkedRows, type TableData } from "./values";
import { GalleryView, KanbanView, CalendarView } from "./ExtraTableViews";
import {downloadXlsx} from "./xlsx";
import {createImportDraft,mergeExcelIntoTable,readExcelSheet,listExcelSheets,splitMultiple,encodedMultiple,type ImportDraft,type ImportType} from "./excelImport";
import {readExcelDropdowns} from "./excelValidation";
import {getItem,uploadFiles} from "../files/storage";
import {Image as ImageIcon, ExternalLink} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Filter, ArrowUpDown, MoreHorizontal, ChevronDown, Table2, FolderKanban, History, FileSpreadsheet,
  CalendarDays, Hash, Type, CheckSquare, UserRound, Tag, Trash2, Download,
  Columns3, Rows3, X, LayoutGrid, List, SlidersHorizontal
} from "lucide-react";

type ColumnType = "image" | "text" | "number" | "date" | "multiselect" | "select" | "checkbox" | "person" | "relation" | "backlink" | "rollup" | "formula" | "project";
type Column = { id: string; name: string; type: ColumnType; options?: string[]; relationTableId?: string; relationMultiple?: boolean; backlinkSourceTableId?:string; backlinkSourceColumnId?:string; rollupRelationId?:string; rollupTargetId?:string; rollupAggregate?:"sum"|"average"|"count"|"min"|"max"; formulaSourceId?: string; formulaSecondSourceId?:string; formulaOperator?: string; formulaFactor?: number; width?: number };
type Cell = string | number | boolean;
type RowData = { id: string; cells: Record<string, Cell> };
type SavedView = { id: string; name: string; filterColumn: string; filterOperator: string; filterValue: string; secondColumn?: string; secondOperator?: string; secondValue?: string; logic?: "and" | "or"; categoryFilter?: string; groupColumn: string; sortColumn: string; sortDirection: "asc" | "desc"; layout?: "table" | "list" | "gallery" | "kanban" | "calendar" };
type TableHistoryEntry={id:string;at:string;summary:string};
type DataTable = { id: string; name: string; columns: Column[]; rows: RowData[]; updatedAt: string; savedViews?: SavedView[]; history?:TableHistoryEntry[] };

const KEY = "fox-tables-v1";
const types: { value: ColumnType; label: string; icon: typeof Type }[] = [
  { value: "text", label: "Текст", icon: Type },
  { value: "image", label: "Изображение", icon: ImageIcon },
  { value: "number", label: "Число", icon: Hash },
  { value: "date", label: "Дата", icon: CalendarDays },
  { value: "select", label: "Выбор", icon: Tag },
  { value: "multiselect", label: "Мультивыбор", icon: Tag },
  { value: "checkbox", label: "Флажок", icon: CheckSquare },
  { value: "person", label: "Пользователь", icon: UserRound },
  { value: "relation", label: "Связанная запись", icon: LayoutGrid },
  { value: "backlink", label: "Обратная связь (автоматическая)", icon: LayoutGrid },
  { value: "rollup", label: "Агрегация связи", icon: Hash },
  { value: "project", label: "Проект", icon: FolderKanban },
  { value: "formula", label: "Формула", icon: Hash },
];

const initialTables: DataTable[] = [];

function loadTables(): DataTable[] {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) as DataTable[] : initialTables; }
  catch { return initialTables; }
}
const id = () => crypto.randomUUID();

export default function TableWorkspace({openCreate=false,onCreateConsumed,openRecord,onRecordOpened}:{openCreate?:boolean;onCreateConsumed?:()=>void;openRecord?:{tableId:string;rowId:string;id:number}|null;onRecordOpened?:()=>void}) {
  const [tables, setTables] = useState<DataTable[]>(loadTables);
  const [projectRevision,setProjectRevision]=useState(0);
  const projectOptions=useMemo(()=>readProjects().projects,[projectRevision]);
  const [activeId, setActiveId] = useState<string | null>(() => loadTables()[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Все");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnDialog, setColumnDialog] = useState(false);
  const [newOptionsText,setNewOptionsText]=useState("Новый\nВ работе\nГотово");
  const [optionsColumnId,setOptionsColumnId]=useState<string|null>(null);
  const [editOptionsText,setEditOptionsText]=useState("");
  const [excelDialog,setExcelDialog]=useState(false);
  const [excelFile,setExcelFile]=useState<File|null>(null);
  const [excelSheets,setExcelSheets]=useState<string[]>([]);
  const [excelSheet,setExcelSheet]=useState("");
  const [excelDraft,setExcelDraft]=useState<ImportDraft|null>(null);
  const [excelTarget,setExcelTarget]=useState<"new"|"append">("new");
  const [excelBusy,setExcelBusy]=useState(false);
  const [excelError,setExcelError]=useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [relationTableId, setRelationTableId] = useState("");
  const [relationMultiple,setRelationMultiple]=useState(false);
  const [backlinkSourceTableId,setBacklinkSourceTableId]=useState("");
  const [backlinkSourceColumnId,setBacklinkSourceColumnId]=useState("");
  const [rollupRelationId,setRollupRelationId]=useState("");
  const [rollupTargetId,setRollupTargetId]=useState("");
  const [rollupAggregate,setRollupAggregate]=useState<"sum"|"average"|"count"|"min"|"max">("sum");
  const [formulaSourceId, setFormulaSourceId] = useState("");
  const [formulaSecondSourceId,setFormulaSecondSourceId]=useState("");
  const [formulaOperator, setFormulaOperator] = useState("*");
  const [formulaFactor, setFormulaFactor] = useState("1");
  const [tableDialog, setTableDialog] = useState(openCreate);
  const [newTableName, setNewTableName] = useState("");
  const [view, setView] = useState<"table" | "list" | "gallery" | "kanban" | "calendar">("table");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");
  const [secondColumn, setSecondColumn] = useState("");
  const [secondOperator, setSecondOperator] = useState("contains");
  const [secondValue, setSecondValue] = useState("");
  const [logic, setLogic] = useState<"and" | "or">("and");
  const [groupColumn, setGroupColumn] = useState("");
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [openedRowId,setOpenedRowId]=useState<string|null>(null);
  const [linkedRowToOpen,setLinkedRowToOpen]=useState<{tableId:string;rowId:string}|null>(null);
  const [imageLoading,setImageLoading]=useState(false);
  const [imageError,setImageError]=useState("");


  useEffect(()=>{if(openCreate)onCreateConsumed?.();},[openCreate]);
  useEffect(()=>{const update=()=>setProjectRevision(value=>value+1);window.addEventListener("fox-projects-updated",update);return ()=>window.removeEventListener("fox-projects-updated",update);},[]);
  void projectRevision;
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(tables)); window.dispatchEvent(new Event("fox-tables-updated")); }, [tables]);
  const activeTable = tables.find(t => t.id === activeId) ?? null;
  const openedRow=activeTable?.rows.find(r=>r.id===openedRowId);
  useEffect(()=>{setOpenedRowId(null);},[activeId]);
  useEffect(()=>{if(linkedRowToOpen?.tableId===activeId){setOpenedRowId(linkedRowToOpen.rowId);setLinkedRowToOpen(null);}},[linkedRowToOpen,activeId]);
  useEffect(()=>{
    if(!openRecord)return;
    if(activeId!==openRecord.tableId){setActiveId(openRecord.tableId);return;}
    if(tables.some(t=>t.id===openRecord.tableId&&t.rows.some(row=>row.id===openRecord.rowId))){setOpenedRowId(openRecord.rowId);onRecordOpened?.();}
  },[openRecord,activeId,tables,onRecordOpened]);

  function updateTable(updater: (table: DataTable) => DataTable) {
    setTables(current => current.map(table => {
      if(table.id!==activeId)return table;
      const next=updater({...table,updatedAt:new Date().toISOString()});
      const summary=summarizeTableChange(table,next);
      if(!summary)return next;
      const history=[...(table.history??[]),{id:id(),at:new Date().toISOString(),summary}].slice(-300);
      return {...next,history};
    }));
  }
  function parseOptionText(text:string){return [...new Set(text.split(/[\n;]+/).map(value=>value.trim()).filter(Boolean))].slice(0,200);}
  async function loadExcel(file:File,sheet?:string){
    setExcelBusy(true);setExcelError("");setExcelDraft(null);
    try{
      if(!/\.xlsx$/i.test(file.name))throw Error("Поддерживается формат Excel .xlsx");
      if(file.size>25*1024*1024)throw Error("Файл Excel превышает 25 МБ.");
      const available=sheet?excelSheets:await listExcelSheets(file);
      const selected=sheet??available[0];
      if(!selected)throw Error("В книге нет листов.");
      const [rows,choices]=await Promise.all([
        readExcelSheet(file,selected),
        readExcelDropdowns(file,selected).catch(()=>({} as Record<number,string[]>))
      ]);
      setExcelSheets(available);setExcelSheet(selected);
      setExcelDraft(createImportDraft(selected,rows,choices));
    }catch(error){setExcelError(error instanceof Error?error.message:"Не удалось прочитать Excel");}
    finally{setExcelBusy(false);}
  }
  function importExcel(){
    if(!excelDraft)return;
    try{
      const current=excelTarget==="append"?(activeTable??undefined):undefined;
      const imported=mergeExcelIntoTable(excelDraft,current,id);
      const result=imported as DataTable;
      setTables(old=>current?old.map(table=>table.id===current.id?result:table):[...old,result]);
      setActiveId(result.id);setView("table");setQuery("");setCategoryFilter("Все");
      setExcelDialog(false);setExcelFile(null);setExcelDraft(null);setExcelError("");
    }catch(error){setExcelError(error instanceof Error?error.message:"Не удалось импортировать Excel");}
  }
  function editColumnOptions(){
    if(!optionsColumnId)return;
    const options=parseOptionText(editOptionsText);
    updateTable(table=>({...table,columns:table.columns.map(col=>col.id===optionsColumnId?{...col,options}:col)}));
    setOptionsColumnId(null);
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
      ], rows: [],history:[{id:id(),at:new Date().toISOString(),summary:"Создана таблица"}]
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
    const column: Column = { id: id(), name, type: newColumnType, ...(["select","multiselect"].includes(newColumnType) ? { options: parseOptionText(newOptionsText) } : {}), ...(newColumnType === "relation" ? { relationTableId: relationTableId || tables.find(t => t.id !== activeId)?.id,relationMultiple } : {}), ...(newColumnType==="backlink"?{backlinkSourceTableId,backlinkSourceColumnId}:{}), ...(newColumnType === "rollup" ? {rollupRelationId,rollupTargetId,rollupAggregate}:{}), ...(newColumnType === "formula" ? { formulaSourceId,formulaSecondSourceId:formulaSecondSourceId||undefined,formulaOperator, formulaFactor: Number(formulaFactor) } : {}) };
    updateTable(t => ({ ...t, columns: [...t.columns, column], rows: t.rows.map(r => ({ ...r, cells: { ...r.cells, [column.id]: column.type === "checkbox" ? false : column.type === "number" ? 0 : "" } })) }));
    setNewColumnName(""); setNewColumnType("text"); setNewOptionsText("Новый\nВ работе\nГотово"); setRelationTableId(""); setRelationMultiple(false); setBacklinkSourceTableId(""); setBacklinkSourceColumnId(""); setRollupRelationId(""); setRollupTargetId(""); setRollupAggregate("sum"); setFormulaSourceId(""); setFormulaSecondSourceId(""); setFormulaOperator("*"); setFormulaFactor("1"); setColumnDialog(false);
  }
  function openLinkedRow(tableId:string,rowId:string){
    if(activeId===tableId){setOpenedRowId(rowId);return;}
    setLinkedRowToOpen({tableId,rowId});setActiveId(tableId);
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
  function deleteRow(rowId: string) { updateTable(t => ({ ...t, rows: t.rows.filter(r => r.id !== rowId) }));if(openedRowId===rowId)setOpenedRowId(null); }
  async function uploadImage(rowId:string,columnId:string,file:File|undefined){if(!file)return;setImageError("");if(!file.type.startsWith("image/")){setImageError("Нужен файл изображения");return;}if(file.size>60*1024*1024){setImageError("Изображение превышает 60 МБ");return;}setImageLoading(true);try{const [item]=await uploadFiles([file]);updateCell(rowId,columnId,item.id);}catch(error){setImageError(error instanceof Error?error.message:"Не удалось загрузить изображение");}finally{setImageLoading(false);}}
  function imageCell(row:RowData,col:Column){const value=String(row.cells[col.id]??"");return <div className="table-image-cell"><ImageIcon size={14}/><span>{value?"Фото":"Нет фото"}</span><label title="Загрузить изображение">Загрузить<input type="file" accept="image/*" disabled={imageLoading} onChange={e=>{void uploadImage(row.id,col.id,e.target.files?.[0]);e.target.value="";}}/></label></div>;}

  const categories = useMemo(() => {
    const col = activeTable?.columns.find(c => c.type === "select");
    return col ? ["Все", ...Array.from(new Set(activeTable!.rows.map(r => String(r.cells[col.id] ?? "")).filter(Boolean)))] : ["Все"];
  }, [activeTable]);
  const visibleRows = useMemo(() => {
    if (!activeTable) return [];
    const evaluate = (row: RowData, columnId: string, operator: string, expected: string) => {
      const column = activeTable.columns.find(item => item.id === columnId);
      if (!column) return true;
      const raw = computedCell(column, row,tables);
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
      if (query && !activeTable.columns.some(col => String(computedCell(col, row,tables) ?? "").toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")))) return false;
      const one = !firstActive || evaluate(row, filterColumn, filterOperator, filterValue);
      const two = !secondActive || evaluate(row, secondColumn, secondOperator, secondValue);
      return firstActive && secondActive ? logic === "and" ? one && two : one || two : one && two;
    });
    if (sort) {
      const column = activeTable.columns.find(col => col.id === sort.key);
      if (column) rows = [...rows].sort((a, b) => {
        const av = computedCell(column, a,tables) ?? "";
        const bv = computedCell(column, b,tables) ?? "";
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
      const column = activeTable.columns.find(col => col.id === groupColumn); const label = column ? String(computedCell(column,row,tables) || "Без значения") : "Без значения";
      groups.set(label, [...(groups.get(label) ?? []), row]);
    });
    return Array.from(groups.entries()).map(([label, rows]) => ({ label, rows }));
  }, [activeTable, groupColumn, visibleRows]);

  function exportXlsx(){
    if(!activeTable)return;
    downloadXlsx(activeTable.name,activeTable.columns.map(column=>column.name),activeTable.rows.map(row=>activeTable.columns.map(column=>computedCell(column,row,tables))));
  }
  function exportCsv() {
    if (!activeTable) return;
    const quote = (v: Cell | undefined) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const csv = [activeTable.columns.map(c => quote(c.name)).join(";"), ...activeTable.rows.map(r => activeTable.columns.map(c => quote(computedCell(c,r,tables) ?? "")).join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = activeTable.name + ".csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <section className="table-workspace">
    <div className="table-page-heading">
      <div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h1>Файлы и таблицы</h1><p>Создавайте таблицы, настраивайте поля и управляйте данными.</p></div>
      <div className="fox-excel-actions"><button className="outline-button" onClick={()=>{setExcelDialog(true);setExcelTarget("new");setExcelError("");}}><FileSpreadsheet size={16}/> Импорт Excel</button><button className="primary-button" onClick={() => setTableDialog(true)}><Plus size={16}/> Новая таблица</button></div>
    </div>
    <div className="table-layout">
      <aside className="table-library">
        <div className="table-library-head"><span>ТАБЛИЦЫ</span><button className="tiny-icon" onClick={() => setTableDialog(true)} title="Новая таблица"><Plus size={16}/></button></div>
        {tables.map(t => <button key={t.id} className={activeId === t.id ? "table-library-item selected" : "table-library-item"} onClick={() => { setActiveId(t.id);setOpenedRowId(null); setQuery(""); setCategoryFilter("Все"); setSort(null); }}><Table2 size={16}/><span>{t.name}</span><small>{t.rows.length}</small></button>)}
        <div className="table-library-foot"><FolderIcon/><span>Локальные таблицы</span></div>
      </aside>
      <div className="table-main">
        {activeTable ? <>
          <div className="table-title-row"><div><div className="table-breadcrumb">Файлы и таблицы <span>/</span> Таблицы</div><h2>{activeTable.name} <button className="tiny-icon" title="Переименовать" onClick={() => { const n = window.prompt("Название таблицы", activeTable.name); if (n?.trim()) updateTable(t=>({...t,name:n.trim()})); }}><MoreHorizontal size={17}/></button></h2><div className="table-subtitle">{activeTable.rows.length} записей <span>·</span> {activeTable.columns.length} полей <span>·</span> Изменения сохраняются автоматически</div>{(activeTable.savedViews?.length??0)>0 && <div className="saved-views">{activeTable.savedViews?.map(s=><span className="saved-view-chip" key={s.id}><button onClick={()=>{setFilterColumn(s.filterColumn);setFilterOperator(s.filterOperator);setFilterValue(s.filterValue);setSecondColumn(s.secondColumn??"");setSecondOperator(s.secondOperator??"contains");setSecondValue(s.secondValue??"");setLogic(s.logic??"and");setCategoryFilter(s.categoryFilter??"Все");setGroupColumn(s.groupColumn);setSort(s.sortColumn?{key:s.sortColumn,direction:s.sortDirection}:null);setView(s.layout??"table");setShowFilters(true);}}>{s.name}</button><button className="saved-view-delete" title={"Удалить вид "+s.name} onClick={()=>updateTable(t=>({...t,savedViews:(t.savedViews??[]).filter(v=>v.id!==s.id)}))}><X size={12}/></button></span>)}</div>}</div><div className="table-top-actions"><button className="soft-icon" onClick={exportCsv} title="Экспорт CSV"><Download size={17}/></button><button className="soft-icon" onClick={exportXlsx} title="Экспорт Excel"><FileSpreadsheet size={17}/></button><button className="soft-icon" onClick={()=>{setExcelDialog(true);setExcelTarget("append");setExcelError("");}} title="Добавить строки из Excel"><Plus size={16}/><FileSpreadsheet size={13}/></button><button className="soft-icon table-danger" onClick={deleteTable} title="Удалить таблицу"><Trash2 size={16}/></button></div></div>
          <div className="table-toolbar">
            <div className="table-toolbar-left"><div className="table-view-switch"><button className={view==="table"?"chosen":""} onClick={() => setView("table")}><Table2 size={15}/> Таблица</button><button className={view==="list"?"chosen":""} onClick={() => setView("list")}><List size={15}/> Список</button><button className={view==="gallery"?"chosen":""} onClick={()=>setView("gallery")}><LayoutGrid size={15}/> Галерея</button><button className={view==="kanban"?"chosen":""} onClick={()=>setView("kanban")}><Columns3 size={15}/> Канбан</button><button className={view==="calendar"?"chosen":""} onClick={()=>setView("calendar")}><CalendarDays size={15}/> Календарь</button></div><button className={showFilters?"toolbar-button chosen":"toolbar-button"} onClick={() => setShowFilters(v => !v)}><Filter size={15}/> Фильтр {categoryFilter!=="Все" && <i/>}</button><button className="toolbar-button" onClick={() => setSort(sort ? null : {key:activeTable.columns[0].id,direction:"asc"})}><ArrowUpDown size={15}/> Сортировка</button><select className="group-select" value={groupColumn} onChange={e=>setGroupColumn(e.target.value)}><option value="">Без группировки</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>Группировать: {col.name}</option>)}</select><button className="toolbar-button" onClick={()=>setHistoryOpen(true)}><History size={15}/> История</button><button className="toolbar-button" onClick={()=>{const name=window.prompt("Название представления");if(!name?.trim())return;const saved:SavedView={id:id(),name:name.trim(),filterColumn,filterOperator,filterValue,secondColumn,secondOperator,secondValue,logic,categoryFilter,groupColumn,sortColumn:sort?.key??"",sortDirection:sort?.direction??"asc",layout:view};updateTable(t=>({...t,savedViews:[...(t.savedViews??[]),saved]}));}}><Plus size={14}/> Сохранить вид</button></div>
            <div className="table-toolbar-right"><label className="table-search"><Search size={15}/><input placeholder="Найти в таблице" value={query} onChange={e => setQuery(e.target.value)}/></label><button className="toolbar-button" onClick={() => setColumnDialog(true)}><Columns3 size={15}/> Поля</button><button className="primary-button compact" onClick={addRow}><Plus size={15}/> Добавить запись</button></div>
          </div>
          {showFilters && <div className="filter-bar"><SlidersHorizontal size={15}/><span>Поле</span><select value={filterColumn} onChange={e=>setFilterColumn(e.target.value)}><option value="">Любое</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select><select value={filterOperator} onChange={e=>setFilterOperator(e.target.value)}><option value="contains">содержит</option><option value="equals">равно</option><option value="not_equals">не равно</option><option value="gt">больше</option><option value="lt">меньше</option><option value="empty">пусто</option><option value="not_empty">не пусто</option></select><input className="filter-value" placeholder="Значение" value={filterValue} onChange={e=>setFilterValue(e.target.value)}/><select value={logic} onChange={e=>setLogic(e.target.value as "and"|"or")}><option value="and">И</option><option value="or">ИЛИ</option></select><select value={secondColumn} onChange={e=>setSecondColumn(e.target.value)}><option value="">Второе поле</option>{activeTable.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select><select value={secondOperator} onChange={e=>setSecondOperator(e.target.value)}><option value="contains">содержит</option><option value="equals">равно</option><option value="not_equals">не равно</option><option value="gt">больше</option><option value="lt">меньше</option><option value="empty">пусто</option><option value="not_empty">не пусто</option></select><input className="filter-value" placeholder="Второе значение" value={secondValue} onChange={e=>setSecondValue(e.target.value)}/><button className="text-button-inline" onClick={()=>{setFilterColumn("");setFilterValue("");setSecondColumn("");setSecondValue("");setSecondOperator("contains");setLogic("and");setCategoryFilter("Все");}}>Сбросить</button></div>}
          {view === "gallery" ? <GalleryView table={activeTable} rows={visibleRows} onOpen={setOpenedRowId}/> : view==="kanban"?<KanbanView table={activeTable} rows={visibleRows} onOpen={setOpenedRowId} onUpdate={updateCell}/> : view==="calendar"?<CalendarView table={activeTable} rows={visibleRows} onOpen={setOpenedRowId}/> : view === "table" ? <div className="data-grid-wrap"><table className="data-grid"><colgroup><col style={{width:58}}/>{activeTable.columns.map(col=><col key={col.id} style={{width:col.width??170}}/>)}<col style={{width:38}}/></colgroup><thead><tr><th className="row-index">#</th>{activeTable.columns.map(col => <th key={col.id} draggable onDragStart={e=>{setDraggedColumn(col.id);e.dataTransfer.setData("text/plain",col.id);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();moveColumn(e.dataTransfer.getData("text/plain"),col.id);setDraggedColumn(null);}} onDragEnd={()=>setDraggedColumn(null)} style={{width:col.width??170,minWidth:col.width??170}}><button className="column-head" onClick={() => setSort(s => s?.key===col.id ? {key:col.id,direction:s.direction==="asc"?"desc":"asc"} : {key:col.id,direction:"asc"})}>{col.type==="image"?<ImageIcon size={13}/>:col.type==="number"?<Hash size={13}/>:col.type==="date"?<CalendarDays size={13}/>:col.type==="checkbox"?<CheckSquare size={13}/>:["select","multiselect"].includes(col.type)?<Tag size={13}/>:col.type==="project"?<FolderKanban size={13}/>:<Type size={13}/>} {col.name}{sort?.key===col.id && <span>{sort.direction==="asc"?"↑":"↓"}</span>}</button>{(col.type==="select"||col.type==="multiselect")&&<button className="column-menu fox-options-action" onClick={()=>{setOptionsColumnId(col.id);setEditOptionsText((col.options??[]).join("\n"));}} title={"Настроить варианты: "+col.name}><Tag size={12}/></button>}<button className="column-menu" onClick={() => deleteColumn(col.id)} title="Удалить поле"><X size={12}/></button><input className="column-width" type="range" min="110" max="360" step="10" value={col.width??170} onChange={e=>resizeColumn(col.id,Number(e.target.value))} aria-label={"Ширина: "+col.name}/></th>)}<th className="add-col-head"><button onClick={() => setColumnDialog(true)} title="Добавить поле"><Plus size={15}/></button></th></tr></thead><tbody>{groupedRows.map(group=><Fragment key={group.label}>{group.label && <tr className="group-heading" key={"group-"+group.label}><td colSpan={activeTable.columns.length+2}>{group.label}<span>{group.rows.length} записей</span></td></tr>}{group.rows.map((row,index) => <tr key={row.id}><td className="row-index"><button className="table-open-record" onClick={()=>setOpenedRowId(row.id)} title="Открыть запись"><MoreHorizontal size={16}/></button><span>{index+1}</span></td>{activeTable.columns.map(col => <td key={col.id}>{col.type==="image"?imageCell(row,col):renderCell(col,computedCell(col,row),v=>updateCell(row.id,col.id,v),tables,projectOptions)}</td>)}<td className="row-actions"><button onClick={() => deleteRow(row.id)} title="Удалить запись"><Trash2 size={13}/></button></td></tr>)}</Fragment>)}</tbody></table>{visibleRows.length===0 && <div className="table-no-results">Нет записей по выбранным условиям</div>}<button className="add-row-inline" onClick={addRow}><Plus size={14}/> Добавить строку</button></div> : <div className="record-list">{visibleRows.map((row,index)=><div className="record-card" key={row.id}><span className="record-number">{String(index+1).padStart(2,"0")}</span><div className="record-fields">{activeTable.columns.map(c=><div key={c.id}><small>{c.name}</small>{c.type==="image"?imageCell(row,c):renderCell(c,computedCell(c,row),v=>updateCell(row.id,c.id,v),tables,projectOptions)}</div>)}</div><button onClick={()=>setOpenedRowId(row.id)} className="tiny-icon" title="Открыть запись"><ExternalLink size={15}/></button><button onClick={()=>deleteRow(row.id)} className="tiny-icon"><Trash2 size={14}/></button></div>)}</div>}
          <div className="table-footer"><span>Показано {visibleRows.length} из {activeTable.rows.length} записей</span><span><Rows3 size={14}/> Все изменения сохраняются автоматически</span></div>
        </> : <div className="table-empty"><div className="empty-icon"><Table2 size={24}/></div><h2>Создайте первую таблицу</h2><p>Таблицы можно привязывать к пользовательским экранам и использовать как источник данных для виджетов.</p><button className="primary-button" onClick={() => setTableDialog(true)}><Plus size={16}/> Создать таблицу</button><button className="outline-button" onClick={()=>{setExcelDialog(true);setExcelTarget("new");}}>Импортировать Excel</button></div>}
      </div>
    </div>
    {openedRow&&activeTable&&<div className="table-record-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpenedRowId(null);}}><aside className="table-record-panel" role="dialog" aria-modal="true" aria-label="Карточка записи"><header><div><small>{activeTable.name}</small><h2>{String(openedRow.cells[activeTable.columns[0]?.id]||"Запись")}</h2></div><button aria-label="Закрыть карточку" onClick={()=>setOpenedRowId(null)}><X size={20}/></button></header><div className="table-record-content">{activeTable.columns.map(col=><div className="table-record-field" key={col.id}><label>{col.name}</label>{col.type==="image"?<div className="table-record-image-field">{openedRow.cells[col.id]?<>{<RecordImage fileId={String(openedRow.cells[col.id])}/>}<button onClick={()=>updateCell(openedRow.id,col.id,"")}>Убрать из записи</button></>:<p>Изображение не добавлено</p>}<label className="table-record-upload"><ImageIcon size={16}/> {openedRow.cells[col.id]?"Заменить изображение":"Загрузить изображение"}<input type="file" accept="image/*" disabled={imageLoading} onChange={e=>{void uploadImage(openedRow.id,col.id,e.target.files?.[0]);e.target.value="";}}/></label></div>:col.type==="text"?<textarea value={String(openedRow.cells[col.id]??"")} onChange={e=>updateCell(openedRow.id,col.id,e.target.value)} rows={Math.max(3,Math.min(12,Math.ceil(String(openedRow.cells[col.id]??"").length/70)))}/>:renderCell(col,computedCell(col,openedRow,tables),v=>updateCell(openedRow.id,col.id,v),tables,projectOptions)}{(col.type==="relation"||col.type==="backlink")&&(()=>{
  const linked=linkedRows(openedRow,col,tables);
  return linked?.rows.length?<div className="fox-related-records">{linked.rows.map(item=><button key={item.id} type="button" onClick={()=>openLinkedRow(linked.table.id,item.id)} title={"Открыть: "+String(item.cells[linked.table.columns[0]?.id??""]??"Запись")}><ExternalLink size={12}/>{String(item.cells[linked.table.columns[0]?.id??""]??"Запись")}</button>)}</div>:null;
})()}</div>)}{imageError&&<p className="table-record-error" role="alert">{imageError}</p>}</div></aside></div>}
    {excelDialog&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setExcelDialog(false)}><div className="dialog fox-excel-dialog" role="dialog" aria-label="Импорт Excel"><button className="close-button" onClick={()=>setExcelDialog(false)}><X size={18}/></button><div className="dialog-icon"><FileSpreadsheet size={21}/></div><h2>Импорт Excel</h2><p>Столбцы и записи сохраняются. Варианты выпадающих списков Excel по возможности извлекаются из файла. Перед импортом можно изменить типы и варианты.</p>
      <label className="form-label">Книга Excel (.xlsx)<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e=>{const file=e.target.files?.[0];if(file){setExcelFile(file);setExcelSheets([]);void loadExcel(file);}e.target.value="";}}/></label>
      {excelFile&&excelSheets.length>1&&<label className="form-label">Лист<select className="form-input" value={excelSheet} onChange={e=>{setExcelSheet(e.target.value);void loadExcel(excelFile,e.target.value);}}>{excelSheets.map(sheet=><option key={sheet}>{sheet}</option>)}</select></label>}
      {excelDraft&&<><label className="form-label">Режим загрузки<select className="form-input" value={excelTarget} onChange={e=>setExcelTarget(e.target.value as "new"|"append")}><option value="new">Новая таблица — {excelDraft.sheet}</option>{activeTable&&<option value="append">Добавить строки в «{activeTable.name}»</option>}</select></label><div className="fox-excel-summary">{excelDraft.rows.length} строк · {excelDraft.fields.length} колонок · {excelDraft.fields.filter(field=>field.type==="select"||field.type==="multiselect").length} полей с вариантами</div><div className="fox-excel-field-map">{excelDraft.fields.map(field=><div className="fox-excel-field" key={field.id}><strong title={field.name}>{field.name}</strong><select aria-label={"Тип поля "+field.name} value={field.type} onChange={e=>setExcelDraft(current=>current?{...current,fields:current.fields.map(x=>x.id===field.id?{...x,type:e.target.value as ImportType,source:"manual"}:x)}:current)}>{[["text","Текст"],["number","Число"],["date","Дата"],["checkbox","Флажок"],["select","Выбор"],["multiselect","Мультивыбор"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>{(field.type==="select"||field.type==="multiselect")&&<textarea aria-label={"Варианты "+field.name} rows={2} value={field.options.join("\n")} onChange={e=>setExcelDraft(current=>current?{...current,fields:current.fields.map(x=>x.id===field.id?{...x,options:parseOptionText(e.target.value),source:"manual"}:x)}:current)}/>}</div>)}</div><p className="fox-excel-footnote">При добавлении в существующую таблицу колонки сопоставляются по названиям. Существующие записи и варианты сохраняются.</p></>}
      {excelBusy&&<p role="status">Чтение Excel…</p>}{excelError&&<p role="alert" className="table-record-error">{excelError}</p>}
      <button className="primary-button full" disabled={!excelDraft||excelBusy} onClick={importExcel}><FileSpreadsheet size={16}/> Импортировать {excelDraft?.rows.length??0} строк</button>
      <button className="text-button" onClick={()=>setExcelDialog(false)}>Отмена</button>
    </div></div>}
    {optionsColumnId&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setOptionsColumnId(null)}><div className="dialog" role="dialog" aria-label="Настройка вариантов"><button className="close-button" onClick={()=>setOptionsColumnId(null)}><X size={18}/></button><h2>Варианты поля</h2><p>Один вариант на строку. Существующие значения записей не изменяются.</p><textarea className="form-input" rows={9} aria-label="Список вариантов" value={editOptionsText} onChange={e=>setEditOptionsText(e.target.value)}/><button className="primary-button full" onClick={editColumnOptions}>Сохранить варианты</button></div></div>}
    {tableDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setTableDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setTableDialog(false)}><X size={18}/></button><div className="dialog-icon"><Table2 size={21}/></div><h2>Новая таблица</h2><p>Создайте таблицу. Позже к ней можно будет подключать представления и виджеты на пользовательских экранах.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Проекты" value={newTableName} onChange={e=>setNewTableName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTable()}/></label><button className="primary-button full" disabled={!newTableName.trim()} onClick={createTable}><Plus size={16}/> Создать таблицу</button><button className="text-button" onClick={()=>setTableDialog(false)}>Отмена</button></div></div>}
    {historyOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setHistoryOpen(false)}><div className="dialog table-history-dialog"><button className="close-button" onClick={()=>setHistoryOpen(false)}><X size={18}/></button><div className="dialog-icon"><History size={20}/></div><h2>История таблицы</h2><p>Последние 300 изменений структуры и записей.</p><div className="table-history-list">{[...(activeTable?.history??[])].reverse().map(item=><article key={item.id}><strong>{item.summary}</strong><small>{new Date(item.at).toLocaleString("ru-RU")}</small></article>)}{!activeTable?.history?.length&&<p>История пока пуста.</p>}</div><button className="primary-button full" onClick={()=>setHistoryOpen(false)}>Закрыть</button></div></div>}
    {columnDialog && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setColumnDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setColumnDialog(false)}><X size={18}/></button><div className="dialog-icon"><Columns3 size={21}/></div><h2>Новое поле</h2><p>Выберите тип данных для новой колонки.</p><label className="form-label">Название<input className="form-input" autoFocus placeholder="Например, Приоритет" value={newColumnName} onChange={e=>setNewColumnName(e.target.value)}/></label><label className="form-label">Тип поля<select className="form-input" value={newColumnType} onChange={e=>setNewColumnType(e.target.value as ColumnType)}>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>{(newColumnType==="select"||newColumnType==="multiselect")&&<label className="form-label">Варианты (каждый с новой строки)<textarea className="form-input" rows={5} value={newOptionsText} onChange={e=>setNewOptionsText(e.target.value)} placeholder="В работе&#10;Готово"/></label>}{newColumnType==="relation" && <><label className="form-label">Связать с таблицей<select className="form-input" value={relationTableId} onChange={e=>setRelationTableId(e.target.value)}><option value="">Выберите таблицу</option>{tables.filter(t=>t.id!==activeId).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="form-label fox-relation-switch"><input type="checkbox" checked={relationMultiple} onChange={e=>setRelationMultiple(e.target.checked)}/>Несколько записей (многие ко многим)</label></>}
{newColumnType==="backlink"&&<><label className="form-label">Таблица, ссылающаяся на текущую<select className="form-input" value={backlinkSourceTableId} onChange={e=>{setBacklinkSourceTableId(e.target.value);setBacklinkSourceColumnId("");}}><option value="">Выберите таблицу</option>{tables.filter(t=>t.columns.some(col=>col.type==="relation"&&col.relationTableId===activeId)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="form-label">Поле связи<select className="form-input" value={backlinkSourceColumnId} onChange={e=>setBacklinkSourceColumnId(e.target.value)}><option value="">Выберите поле</option>{tables.find(t=>t.id===backlinkSourceTableId)?.columns.filter(col=>col.type==="relation"&&col.relationTableId===activeId).map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label></>}{newColumnType==="rollup" && <><label className="form-label">Поле связи<select className="form-input" value={rollupRelationId} onChange={e=>{setRollupRelationId(e.target.value);setRollupTargetId("");}}><option value="">Выберите связь</option>{activeTable?.columns.filter(col=>col.type==="relation"||col.type==="backlink").map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label><label className="form-label">Поле в связанной таблице<select className="form-input" value={rollupTargetId} onChange={e=>setRollupTargetId(e.target.value)}><option value="">Выберите числовое поле</option>{tables.find(t=>t.id===(activeTable?.columns.find(col=>col.id===rollupRelationId)?.relationTableId??activeTable?.columns.find(col=>col.id===rollupRelationId)?.backlinkSourceTableId))?.columns.filter(col=>col.type==="number"||col.type==="formula").map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label><label className="form-label">Вычисление<select className="form-input" value={rollupAggregate} onChange={e=>setRollupAggregate(e.target.value as typeof rollupAggregate)}>{[["sum","Сумма"],["average","Среднее"],["count","Количество"],["min","Минимум"],["max","Максимум"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></>}{newColumnType==="formula" && <><label className="form-label">Числовое поле-источник<select className="form-input" value={formulaSourceId} onChange={e=>setFormulaSourceId(e.target.value)}><option value="">Выберите поле</option>{activeTable?.columns.filter(col=>col.type==="number").map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label><label className="form-label">Операция<select className="form-input" value={formulaOperator} onChange={e=>setFormulaOperator(e.target.value)}><option value="*">Умножить</option><option value="/">Разделить</option><option value="+">Прибавить</option><option value="-">Вычесть</option></select></label><label className="form-label">Второй операнд<select className="form-input" value={formulaSecondSourceId} onChange={e=>setFormulaSecondSourceId(e.target.value)}><option value="">Указанное число</option>{activeTable?.columns.filter(col=>col.type==="number"&&col.id!==formulaSourceId).map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select></label>{!formulaSecondSourceId&&<label className="form-label">Число<input className="form-input" type="number" value={formulaFactor} onChange={e=>setFormulaFactor(e.target.value)}/></label>}</>}<button className="primary-button full" disabled={!newColumnName.trim() || (newColumnType==="relation" && !relationTableId) || (newColumnType==="backlink" && (!backlinkSourceTableId||!backlinkSourceColumnId)) || (newColumnType==="formula" && !formulaSourceId) || (newColumnType==="rollup" && (!rollupRelationId || (rollupAggregate!=="count" && !rollupTargetId)))} onClick={addColumn}><Plus size={16}/> Добавить поле</button><button className="text-button" onClick={()=>setColumnDialog(false)}>Отмена</button></div></div>}
  </section>;
}

function computedCell(column: Column, row: RowData, tables: DataTable[] = []): Cell | undefined {
  if(["rollup","backlink","formula"].includes(column.type))return valueForColumn(row,column,tables as TableData[]);
  return row.cells[column.id];
}

function RecordImage({fileId}:{fileId:string}){
 const [preview,setPreview]=useState<{url:string;name:string}|null>(null);
 const [error,setError]=useState("");
 useEffect(()=>{let disposed=false;let uri:string|undefined;setPreview(null);setError("");void getItem(fileId).then(item=>{if(!item?.blob||item.kind!=="file"||!item.mime.startsWith("image/"))throw Error("Фотография не найдена в хранилище");if(disposed)return;uri=URL.createObjectURL(item.blob);setPreview({url:uri,name:item.name});}).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:"Ошибка изображения");});return()=>{disposed=true;if(uri)URL.revokeObjectURL(uri);};},[fileId]);
 return preview?<div className="table-image-preview"><img src={preview.url} alt={preview.name}/><small>{preview.name}</small></div>:<p className="table-record-error">{error||"Загрузка изображения…"}</p>;
}
function FolderIcon() { return <span className="folder-mark"><LayoutGrid size={13}/></span>; }

function renderCell(column: Column, value: Cell | undefined, onChange: (v: Cell) => void, tables: DataTable[] = [], projects: Project[] = []) {
  if (column.type === "project") { return <select className="cell-select" value={String(value??"")} onChange={e=>onChange(e.target.value)}><option value="">Без проекта</option>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select>; }
  if (column.type === "formula" || column.type==="rollup"||column.type==="backlink") return <span className="formula-value">{value ?? "—"}</span>;
  if (column.type === "relation") {
    const target=tables.find(t=>t.id===column.relationTableId);
    if(!column.relationMultiple)return <select className="cell-select" value={String(value??"")} onChange={e=>onChange(e.target.value)}><option value="">—</option>{target?.rows.map(row=><option key={row.id} value={row.id}>{String(row.cells[target.columns[0]?.id]??"Запись")}</option>)}</select>;
    const ids=relationIds(value);
    const names=target?.rows.filter(row=>ids.includes(row.id)).map(row=>String(row.cells[target.columns[0]?.id]??"Запись"))??[];
    return <details className="fox-relation-picker"><summary title={names.join(", ")}>{names.length?names.join(", "):"Выбрать записи"} <span>{names.length}</span></summary><div className="fox-relation-options">{target?.rows.map(row=><label key={row.id}><input type="checkbox" checked={ids.includes(row.id)} onChange={e=>onChange(e.target.checked?[...ids,row.id].join(","):ids.filter(id=>id!==row.id).join(","))}/><span>{String(row.cells[target.columns[0]?.id]??"Запись")}</span></label>)}{!target?.rows.length&&<small>В связанной таблице нет записей</small>}</div></details>;
  }
  if (column.type === "checkbox") return <label className="checkbox-cell"><input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)}/><span>{value?"Да":"Нет"}</span></label>;
  if(column.type==="multiselect"){
    const selected=splitMultiple(value);
    return <details className="fox-relation-picker fox-multi-choice"><summary title={selected.join(", ")}>{selected.length?<span className="fox-multi-pills">{selected.map(option=><b key={option}>{option}</b>)}</span>:"Выбрать варианты"} <small>{selected.length}</small></summary><div className="fox-relation-options">{(column.options??[]).map(option=><label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={e=>onChange(encodedMultiple(e.target.checked?[...selected,option]:selected.filter(item=>item!==option)))}/><span>{option}</span></label>)}{!column.options?.length&&<small>Добавьте варианты в настройках поля</small>}</div></details>;
  }
  if (column.type === "select") return <select className="cell-select" value={String(value ?? "")} onChange={e=>onChange(e.target.value)}><option value="">—</option>{(column.options ?? ["Новый","В работе","Готово"]).map(o=><option key={o}>{o}</option>)}</select>;
  return <input title={String(value??"")} className="cell-input" type={column.type==="number"?"number":column.type==="date"?"date":"text"} value={String(value ?? "")} onChange={e=>onChange(column.type==="number"?(e.target.value===""?0:Number(e.target.value)):e.target.value)} />;
}

function summarizeTableChange(before:DataTable,after:DataTable):string{
 const changes:string[]=[];
 if(before.name!==after.name)changes.push("Переименована таблица");
 const signature=(columns:Column[])=>JSON.stringify(columns.map(({width,...column})=>column));
 if(signature(before.columns)!==signature(after.columns))changes.push("Изменена структура полей");
 if(before.rows.length!==after.rows.length)changes.push("Количество записей: "+before.rows.length+" → "+after.rows.length);
 else{
  let changed=0;
  const previous=new Map(before.rows.map(row=>[row.id,row]));
  for(const row of after.rows){const old=previous.get(row.id);if(!old)continue;for(const column of after.columns)if(JSON.stringify(old.cells[column.id])!==JSON.stringify(row.cells[column.id]))changed++;}
  if(changed)changes.push("Изменено значений: "+changed);
 }
 if(JSON.stringify(before.savedViews??[])!==JSON.stringify(after.savedViews??[]))changes.push("Изменены сохранённые представления");
 return changes.join(" · ");
}
