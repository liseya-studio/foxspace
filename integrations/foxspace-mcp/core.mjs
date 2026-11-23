import {readFile,writeFile,rename,open,unlink,stat,mkdir} from "node:fs/promises";
import {dirname,join} from "node:path";
import {homedir} from "node:os";
import {randomUUID} from "node:crypto";

const KEYS={projects:"fox-projects-v1",tasks:"fox-notes-tasks-v1",finance:"fox-operations-v1",trackers:"fox-trackers-v1"};
export const DEFAULT_PATH=join(homedir(),"Library","Application Support","studio.liseya.foxspace","workspace.json");
export const FILE=process.env.FOXSPACE_WORKSPACE_PATH||DEFAULT_PATH;
export const MAX_SIZE=30*1024*1024;

export function decodeSnapshot(content){
 const stored=JSON.parse(content);
 if(!stored||typeof stored!=="object"||Array.isArray(stored))throw Error("Invalid workspace snapshot");
 return stored;
}
export function decodeRecord(snapshot,key,fallback){
 const raw=snapshot[key];
 if(raw===undefined)return structuredClone(fallback);
 if(typeof raw!=="string")throw Error("Invalid workspace record: "+key);
 const value=JSON.parse(raw);
 if(!value||typeof value!=="object")throw Error("Invalid workspace record: "+key);
 return value;
}
export async function readWorkspace(file=FILE){
 const metadata=await stat(file);
 if(metadata.size>MAX_SIZE)throw Error("Workspace exceeds safety size limit");
 return decodeSnapshot(await readFile(file,"utf8"));
}
export async function listCollection(collection,file=FILE){
 const snapshot=await readWorkspace(file);
 switch(collection){
 case "projects": return decodeRecord(snapshot,KEYS.projects,{version:1,projects:[]}).projects;
 case "tasks": return decodeRecord(snapshot,KEYS.tasks,{tasks:[],notes:[]}).tasks;
 case "goals":return decodeRecord(snapshot,KEYS.projects,{version:1,projects:[]}).projects.flatMap(p=>(p.goals||[]).map(g=>({...g,projectId:p.id})));
 case "transactions":return decodeRecord(snapshot,KEYS.finance,{version:1,transactions:[]}).transactions;
 case "publications":return decodeRecord(snapshot,KEYS.finance,{version:1,publications:[]}).publications;
 case "trackers":return decodeRecord(snapshot,KEYS.trackers,{version:1,trackers:[]}).trackers;
 default: throw Error("Unsupported collection");
 }
}
async function lock(file){
 let handle;
 for(let attempt=0;attempt<8;attempt++){
  try{handle=await open(file+".mcp-lock","wx",0o600);return async()=>{await handle.close();await unlink(file+".mcp-lock").catch(()=>{});};}
  catch(e){if(e.code!=="EEXIST")throw e;const lockStat=await stat(file+".mcp-lock").catch(()=>null);if(lockStat&&Date.now()-lockStat.mtimeMs>30_000)throw Error("Stale lock: manual inspection required");await new Promise(resolve=>setTimeout(resolve,100));}
 }
 throw Error("Workspace is busy");
}
export async function updateWorkspace(mutator,file=FILE){
 if(process.env.FOXSPACE_ALLOW_WRITES!=="1")throw Error("Writes disabled. Set FOXSPACE_ALLOW_WRITES=1 only after reviewing access.");
 const release=await lock(file);let temp;
 try{
  const snapshot=await readWorkspace(file);
  const newSnapshot=await mutator(snapshot);
  const content=JSON.stringify(newSnapshot);
  if(Buffer.byteLength(content,"utf8")>MAX_SIZE)throw Error("Workspace exceeds safety size limit");
  await mkdir(dirname(file),{recursive:true});
  temp=file+".mcp-"+randomUUID()+".tmp";
  await writeFile(temp,content,{mode:0o600,flag:"wx"});
  await rename(temp,file);temp=undefined;
  return newSnapshot;
 }finally{if(temp)await unlink(temp).catch(()=>{});await release();}
}
function validateText(text,max=5000){if(typeof text!=="string"||!text.trim()||text.length>max)throw Error("Invalid text");return text.trim();}
function validateId(id){if(typeof id!=="string"||!id||id.length>128)throw Error("Invalid identifier");return id;}
function updateLog(snapshot,action,resource,id){
 const key="fox-audit-log-v1",raw=snapshot[key];
 const log=raw?JSON.parse(raw):[];
 if(!Array.isArray(log))throw Error("Invalid audit log");
 log.push({id:randomUUID(),at:new Date().toISOString(),actorType:"agent",actorId:"foxspace-local-mcp",action,resource,resourceId:id,summary:action+" via local MCP",outcome:"success",approvalRequired:false});
 snapshot[key]=JSON.stringify(log.slice(-1000));
}
export async function createTask({title,description="",dueDate="",projectId=""},file=FILE){
 const taskTitle=validateText(title,300);
 if(typeof description!=="string"||description.length>20000)throw Error("Invalid description");
 if(typeof projectId!=="string"||projectId.length>128)throw Error("Invalid project");
 if(dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))throw Error("Invalid date");
 let task;
 await updateWorkspace(snapshot=>{
  const data=decodeRecord(snapshot,KEYS.tasks,{tasks:[],notes:[]});
  if(!Array.isArray(data.tasks))throw Error("Invalid tasks collection");
  if(projectId){const projects=decodeRecord(snapshot,KEYS.projects,{projects:[]}).projects;if(!projects.some(p=>p.id===projectId))throw Error("Project does not exist");}
  const now=new Date().toISOString();
  task={id:randomUUID(),title:taskTitle,description,dueDate,projectId,goalId:"",status:"todo",priority:"medium",important:false,urgent:false,tags:[],checklist:[],createdAt:now,updatedAt:now,history:[],repeat:"none"};
  data.tasks.unshift(task);snapshot[KEYS.tasks]=JSON.stringify(data);
  updateLog(snapshot,"task.created","tasks",task.id);
  return snapshot;
 },file);
 return task;
}
export async function updateTaskStatus({taskId,status},file=FILE){
 validateId(taskId);
 if(!["todo","doing","done"].includes(status))throw Error("Invalid task status");
 let result;
 await updateWorkspace(snapshot=>{
  const data=decodeRecord(snapshot,KEYS.tasks,{tasks:[],notes:[]});
  if(!Array.isArray(data.tasks))throw Error("Invalid tasks collection");
  const task=data.tasks.find(t=>t.id===taskId);
  if(!task)throw Error("Task not found");
  task.status=status;task.updatedAt=new Date().toISOString();
  snapshot[KEYS.tasks]=JSON.stringify(data);updateLog(snapshot,"task.status.updated","tasks",task.id);
  result=task;return snapshot;
 },file);
 return result;
}

/** Structured table values keep image references as opaque file IDs. */
/** Keep raw values for compatibility, while exposing choice metadata to agents. */
function parsedChoiceValues(value){
 if(value===null||value===undefined||value==="")return [];
 if(Array.isArray(value))return value.map(v=>String(v));
 const raw=String(value);
 try{const array=JSON.parse(raw);if(Array.isArray(array))return array.map(v=>String(v));}catch{/* legacy text */}
 return raw.split(/[;,|\n]/).map(v=>v.trim()).filter(Boolean);
}
function structuredField(column,raw){
 const value=raw??null;
 const isChoice=column.type==="select"||column.type==="multiselect";
 return {type:column.type,value,
   ...(isChoice?{options:Array.isArray(column.options)?column.options:[]}:{}),
   ...(column.type==="multiselect"?{selectedOptions:parsedChoiceValues(value)}:{})
 };
}
export async function listTables(file=FILE){
 const snapshot=await readWorkspace(file);
 const tables=decodeRecord(snapshot,"fox-tables-v1",[]);
 if(!Array.isArray(tables))throw Error("Invalid tables collection");
 return tables.map(t=>({id:t.id,name:t.name,updatedAt:t.updatedAt,rowCount:t.rows?.length??0,columns:t.columns?.map(c=>({id:c.id,name:c.name,type:c.type,...((c.type==="select"||c.type==="multiselect")?{options:c.options??[]}:{} )}))??[]}));
}
export async function getTableRecord({tableId,rowId},file=FILE){
 validateId(tableId);validateId(rowId);
 const snapshot=await readWorkspace(file);
 const tables=decodeRecord(snapshot,"fox-tables-v1",[]);
 if(!Array.isArray(tables))throw Error("Invalid tables collection");
 const table=tables.find(t=>t.id===tableId);if(!table)throw Error("Table not found");
 const row=table.rows?.find(r=>r.id===rowId);if(!row)throw Error("Record not found");
 return {tableId,tableName:table.name,id:row.id,fields:(table.columns||[]).map(c=>({columnId:c.id,name:c.name,...structuredField(c,row.cells?.[c.id]),...(c.type==="image"?{imageFileId:row.cells?.[c.id]||null}:{} )}))};
}
export async function listTableRecords({tableId,offset=0,limit=30},file=FILE){
 validateId(tableId);
 const snapshot=await readWorkspace(file);
 const tables=decodeRecord(snapshot,"fox-tables-v1",[]);
 if(!Array.isArray(tables))throw Error("Invalid tables collection");
 const table=tables.find(t=>t.id===tableId);if(!table)throw Error("Table not found");
 const rows=table.rows||[];
 return {tableId,tableName:table.name,total:rows.length,rows:rows.slice(offset,offset+limit).map(row=>({id:row.id,fields:Object.fromEntries((table.columns||[]).map(c=>[c.name,structuredField(c,row.cells?.[c.id])]))}))};
}
/** Read image bytes only when the ID is referenced from an image-typed table column. */
export async function getTableImage({tableId,rowId,columnId},file=FILE){
 validateId(tableId);validateId(rowId);validateId(columnId);
 const snapshot=await readWorkspace(file);
 const tables=decodeRecord(snapshot,"fox-tables-v1",[]);
 if(!Array.isArray(tables))throw Error("Invalid tables collection");
 const table=tables.find(t=>t.id===tableId);if(!table)throw Error("Table not found");
 const col=table.columns?.find(c=>c.id===columnId&&c.type==="image");
 if(!col)throw Error("Image column not found");
 const row=table.rows?.find(r=>r.id===rowId);if(!row)throw Error("Record not found");
 const fileId=row.cells?.[columnId];
 if(typeof fileId!=="string"||!/^[A-Za-z0-9-]{1,128}$/.test(fileId))throw Error("Image reference is missing or invalid");
 const index=decodeRecord(snapshot,"fox-native-files-index-v1",[]);
 if(!Array.isArray(index))throw Error("Invalid native file index");
 const item=index.find(i=>i.id===fileId&&i.kind==="file");
 if(!item||!["image/png","image/jpeg","image/webp","image/gif"].includes(item.mime))throw Error("Image is unavailable or format unsupported");
 const nativeFile=join(dirname(file),"files",fileId+".bin");
 const st=await stat(nativeFile);
 if(st.size>8*1024*1024)throw Error("Image exceeds 8 MB MCP transfer limit");
 const data=await readFile(nativeFile);
 return {fileId,name:item.name,mime:item.mime,dataBase64:data.toString("base64")};
}
