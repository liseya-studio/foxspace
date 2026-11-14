import { useEffect, useMemo, useRef, useState } from "react";
import { Folder, File, FileText, Image, Video, Music2, Archive, FolderPlus, Upload, Download, Trash2, Pencil, Search, ChevronRight, HardDrive, FolderOpen, MoveRight, X, Plus } from "lucide-react";
import { createFolder, deleteItem, downloadItem, editItem, listItems, sizeLabel, uploadFiles, type StoredItem } from "./storage";
import { importDelimitedFile } from "./importDelimited";

type Mode = "all" | "files" | "tables";
type Props={mode:Mode;onOpenTables:()=>void;onCreateTable:()=>void;tables:{id:string;name:string;rows:unknown[]}[]};
function fileIcon(item:StoredItem){
  if(item.kind==="folder")return <Folder size={19}/>;
  if(item.mime.startsWith("image/"))return <Image size={19}/>;
  if(item.mime.startsWith("video/"))return <Video size={19}/>;
  if(item.mime.startsWith("audio/"))return <Music2 size={19}/>;
  if(item.mime.includes("zip"))return <Archive size={19}/>;
  if(item.mime.startsWith("text/"))return <FileText size={19}/>;
  return <File size={19}/>;
}
export default function FileBrowser({mode,onOpenTables,onCreateTable,tables}:Props){
  const [items,setItems]=useState<StoredItem[]>([]);
  const [folderId,setFolderId]=useState<string|null>(null);
  const [query,setQuery]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [folderDialog,setFolderDialog]=useState(false);
  const [folderName,setFolderName]=useState("");
  const [moving,setMoving]=useState<StoredItem|null>(null);
  const uploadRef=useRef<HTMLInputElement>(null);
  const refresh=async()=>{try{setItems(await listItems());setError("");}catch(e){setError(e instanceof Error?e.message:"Не удалось прочитать файлы");}};
  useEffect(()=>{void refresh();const handler=()=>{void refresh();};window.addEventListener("fox-files-updated",handler);return()=>window.removeEventListener("fox-files-updated",handler);},[]);
  const folder=items.find(item=>item.id===folderId);
  const crumbs:StoredItem[]=[];
  let current=folder;
  while(current){crumbs.unshift(current);current=items.find(item=>item.id===current?.parentId);}
  const filtered=useMemo(()=>items.filter(item=>(query.trim()?item.name.toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru")):item.parentId===folderId)).sort((a,b)=>Number(b.kind==="folder")-Number(a.kind==="folder")||a.name.localeCompare(b.name,"ru")),[items,folderId,query]);
  const fileCount=items.filter(item=>item.kind==="file").length;
  const fileBytes=items.filter(item=>item.kind==="file").reduce((sum,item)=>sum+item.size,0);
  async function run(action:()=>Promise<unknown>){
    setBusy(true);setError("");
    try{await action();await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить операцию");}
    finally{setBusy(false);}
  }
  async function upload(files:FileList|null){
    if(!files||files.length===0)return;
    await run(()=>uploadFiles(files,folderId));
    if(uploadRef.current)uploadRef.current.value="";
  }
  function rename(item:StoredItem){
    const name=window.prompt("Новое название",item.name)?.trim();
    if(name&&name!==item.name)void run(()=>editItem(item.id,{name}));
  }
  function remove(item:StoredItem){
    if(!window.confirm("Удалить "+(item.kind==="folder"?"папку со всем содержимым":"файл")+" «"+item.name+"»?"))return;
    void run(async()=>{await deleteItem(item.id);if(folderId===item.id)setFolderId(null);});
  }
  async function create(){
    if(!folderName.trim())return;
    await run(()=>createFolder(folderName,folderId));
    setFolderName("");setFolderDialog(false);
  }
  const moveCandidates=items.filter(item=>item.kind==="folder"&&item.id!==moving?.id);
  function isDescendant(parentId:string|null, ancestorId:string):boolean{
    let currentId=parentId;
    while(currentId){if(currentId===ancestorId)return true;currentId=items.find(item=>item.id===currentId)?.parentId??null;}
    return false;
  }
  const validDestinations=moveCandidates.filter(item=>!moving||!isDescendant(item.id,moving.id));
  const tableTile=(t:{id:string;name:string;rows:unknown[]})=><button key={t.id} className="fox-file-tile" onClick={onOpenTables}><div className="fox-file-tile-icon table"><FileText size={23}/></div><strong>{t.name}</strong><small>Таблица · {t.rows.length} записей</small></button>;
  const fileTile=(item:StoredItem)=><div key={item.id} className="fox-file-tile">
    <button className="fox-file-open" onClick={()=>item.kind==="folder"?setFolderId(item.id):void run(()=>downloadItem(item))}>
      <div className={"fox-file-tile-icon "+item.kind}>{fileIcon(item)}</div><strong title={item.name}>{item.name}</strong><small>{item.kind==="folder"?"Папка":sizeLabel(item.size)}</small>
    </button>
    <div className="fox-file-actions">
      {item.kind==="file"&&<button onClick={()=>void run(()=>downloadItem(item))} title="Скачать"><Download size={14}/></button>}
      {item.kind==="file"&&/\.(csv|tsv)$/i.test(item.name)&&<button onClick={()=>void run(async()=>{await importDelimitedFile(item);onOpenTables();})} title="Импортировать как таблицу"><FileText size={14}/></button>}
      <button onClick={()=>rename(item)} title="Переименовать"><Pencil size={14}/></button>
      <button onClick={()=>setMoving(item)} title="Переместить"><MoveRight size={14}/></button>
      <button onClick={()=>remove(item)} title="Удалить"><Trash2 size={14}/></button>
    </div>
  </div>;
  return <section className="fox-file-browser" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload(e.dataTransfer.files);}}>
    <div className="fox-file-header"><div><div className="eyebrow">ЛОКАЛЬНОЕ ХРАНИЛИЩЕ</div><h2>{mode==="all"?"Мои файлы и таблицы":mode==="tables"?"Таблицы":"Файлы"}</h2><p>Файлы сохраняются в IndexedDB этого браузера, без загрузки на сервер.</p></div>
      <div className="fox-file-header-actions"><input ref={uploadRef} type="file" multiple hidden onChange={e=>void upload(e.target.files)}/><button className="outline-button" onClick={()=>{setFolderDialog(true);setFolderName("");}} disabled={busy}><FolderPlus size={16}/> Папка</button><button className="primary-button" onClick={()=>uploadRef.current?.click()} disabled={busy}><Upload size={16}/> Загрузить файл</button></div></div>
    <div className="fox-file-stats"><span><HardDrive size={16}/> {fileCount} файлов · {sizeLabel(fileBytes)} фактических данных</span><span>{items.filter(item=>item.kind==="folder").length} папок · {tables.length} таблиц</span></div>
    <div className="fox-file-navigation"><div className="fox-file-breadcrumb"><button onClick={()=>setFolderId(null)}><FolderOpen size={16}/> Все файлы</button>{crumbs.map(c=><span key={c.id}><ChevronRight size={14}/><button onClick={()=>setFolderId(c.id)}>{c.name}</button></span>)}</div><label className="fox-file-search"><Search size={16}/><input placeholder="Поиск по файлам" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    {error&&<div className="fox-file-error" role="alert">{error}<button onClick={()=>setError("")}><X size={15}/></button></div>}
    {(mode==="all"||mode==="tables")&& !folderId && !query && <div className="fox-file-table-section"><div className="fox-file-section-heading"><h3>Таблицы</h3><button onClick={onOpenTables}>Открыть редактор <ChevronRight size={15}/></button></div><div className="fox-file-grid">{tables.map(tableTile)}<button className="fox-file-tile create" onClick={onCreateTable}><div className="fox-file-tile-icon"><Plus size={23}/></div><strong>Создать таблицу</strong><small>Новый источник данных</small></button></div></div>}
    {(mode==="all"||mode==="files")&&<div className="fox-file-library"><div className="fox-file-section-heading"><h3>{folder?.name??"Файлы и папки"}</h3><small>{filtered.length} элементов</small></div>{filtered.length>0?<div className="fox-file-grid">{filtered.map(fileTile)}</div>:<div className="fox-file-blank"><FolderOpen size={29}/><h3>{query?"Ничего не найдено":"Папка пуста"}</h3><p>Загрузите файлы или создайте папку. Также можно перетащить файлы сюда.</p><button className="outline-button" onClick={()=>uploadRef.current?.click()}><Upload size={15}/> Выбрать файлы</button></div>}</div>}
    {folderDialog&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setFolderDialog(false)}><div className="dialog"><button className="close-button" onClick={()=>setFolderDialog(false)}><X size={18}/></button><div className="dialog-icon"><FolderPlus size={21}/></div><h2>Новая папка</h2><label className="form-label">Название<input autoFocus className="form-input" value={folderName} onChange={e=>setFolderName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void create()}/></label><button className="primary-button full" disabled={!folderName.trim()||busy} onClick={()=>void create()}>Создать</button></div></div>}
    {moving&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setMoving(null)}><div className="dialog"><button className="close-button" onClick={()=>setMoving(null)}><X size={18}/></button><div className="dialog-icon"><MoveRight size={21}/></div><h2>Переместить «{moving.name}»</h2><p>Выберите папку назначения.</p><div className="fox-file-move-list"><button onClick={()=>{void run(()=>editItem(moving.id,{parentId:null}));setMoving(null);}}>Корневая папка</button>{validDestinations.map(item=><button key={item.id} onClick={()=>{void run(()=>editItem(moving.id,{parentId:item.id}));setMoving(null);}}><Folder size={14}/>{item.name}</button>)}</div></div></div>}
  </section>;
}
