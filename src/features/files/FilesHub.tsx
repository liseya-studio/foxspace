import { useEffect, useState } from "react";
import { FolderOpen, Table2, LayoutGrid } from "lucide-react";
import FileBrowser from "./FileBrowser";
import TableWorkspace from "../tables/TableWorkspace";

type Tab = "all" | "files" | "tables";
type TableSummary = {id:string;name:string;rows:unknown[]};
function localTables():TableSummary[]{
  try{
    const parsed=JSON.parse(localStorage.getItem("fox-tables-v1")??"[]") as TableSummary[];
    return Array.isArray(parsed)?parsed:[];
  }catch{return [];}
}
export default function FilesHub({createAction,onCreateConsumed}:{createAction?:{type:"table"|"folder";id:number}|null;onCreateConsumed?:()=>void}){
  const [tab,setTab]=useState<Tab>("all");
  const [createRequest,setCreateRequest]=useState(0);
  const [folderRequest,setFolderRequest]=useState<number|undefined>(undefined);
  const [openTableDialog,setOpenTableDialog]=useState(false);
  useEffect(()=>{if(createAction?.type==="table"){setCreateRequest(value=>value+1);setOpenTableDialog(true);setTab("tables");onCreateConsumed?.();}if(createAction?.type==="folder"){setFolderRequest(createAction.id);setTab("files");onCreateConsumed?.();}},[createAction]);
  const tables=localTables();
  function openTables(){setTab("tables");}
  function createTable(){setCreateRequest(x=>x+1);setOpenTableDialog(true);setTab("tables");}
  return <section className="fox-files-hub">
    <div className="fox-files-tabs"><button className={tab==="all"?"active":""} onClick={()=>setTab("all")}><LayoutGrid size={16}/> Все</button><button className={tab==="files"?"active":""} onClick={()=>setTab("files")}><FolderOpen size={16}/> Файлы</button><button className={tab==="tables"?"active":""} onClick={()=>setTab("tables")}><Table2 size={16}/> Таблицы</button></div>
    {tab==="tables"?<TableWorkspace key={"tables-"+createRequest} openCreate={openTableDialog} onCreateConsumed={()=>setOpenTableDialog(false)}/>:<FileBrowser mode={tab} tables={tables} onOpenTables={openTables} onCreateTable={createTable} createFolderRequest={folderRequest} onCreateFolderConsumed={()=>setFolderRequest(undefined)}/>}
  </section>;
}
