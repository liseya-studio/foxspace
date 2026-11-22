import { listItems, replaceItems, type StoredItem } from "../files/storage";

const KEYS = ["fox-screens","fox-theme","fox-accent","fox-tables-v1","fox-notes-tasks-v1","fox-editor-widgets-v1","fox-projects-v1","fox-operations-v1","fox-trackers-v1"] as const;
const FORMAT = "fox-space-backup-v1";
type SerializedFile = Omit<StoredItem,"blob"> & {blobBase64?:string};
type Backup = {format:string;createdAt:string;records:Record<string,unknown>;files:SerializedFile[]};
const MAX_IMPORT=150*1024*1024;
const MAX_FILE=60*1024*1024;

function toBase64(bytes:Uint8Array):string{
  let result="";
  const size=0x8000;
  for(let i=0;i<bytes.length;i+=size)result+=String.fromCharCode(...bytes.subarray(i,i+size));
  return btoa(result);
}
function fromBase64(input:string):Blob{
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(input)||input.length%4!==0)throw Error("Неверная кодировка файла");
  const raw=atob(input);
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return new Blob([bytes]);
}
function validateRecords(records:unknown):Record<string,unknown>{
  if(!records||typeof records!=="object"||Array.isArray(records))throw Error("Повреждены настройки рабочего пространства");
  const values=records as Record<string,unknown>;
  if(!("fox-projects-v1" in values))values["fox-projects-v1"]={version:1,projects:[]};
  if(!("fox-operations-v1" in values))values["fox-operations-v1"]={version:1,transactions:[],publications:[],budgets:[],ledger:[]};
  if(!("fox-trackers-v1" in values))values["fox-trackers-v1"]={version:1,trackers:[]};
  const trackers=values["fox-trackers-v1"] as {version?:number;trackers?:unknown[]};
  if(!trackers||trackers.version!==1||!Array.isArray(trackers.trackers))throw Error("Повреждены данные личных трекеров");
  const ops=values["fox-operations-v1"] as Record<string,unknown>;
  if(!ops||ops.version!==1||!["transactions","publications","budgets","ledger"].every(k=>Array.isArray(ops[k])))throw Error("Повреждён финансовый или контентный учёт");
  const projects=values["fox-projects-v1"];
  if(!projects||typeof projects!=="object"||!Array.isArray((projects as {projects?:unknown}).projects))throw Error("Повреждены проекты и цели");
  if(!Array.isArray(values["fox-screens"]))throw Error("Не найден список экранов");
  if(!Array.isArray(values["fox-tables-v1"]))throw Error("Не найдены таблицы");
  const data=values["fox-notes-tasks-v1"];
  if(!data||typeof data!=="object"||!Array.isArray((data as {notes?:unknown}).notes)||!Array.isArray((data as {tasks?:unknown}).tasks))throw Error("Не найдены заметки и задачи");
  if(!values["fox-editor-widgets-v1"]||typeof values["fox-editor-widgets-v1"]!=="object"||Array.isArray(values["fox-editor-widgets-v1"]))throw Error("Повреждены виджеты");
  for(const key of KEYS)if(!(key in values))throw Error("В архиве отсутствует "+key);
  return values;
}

export async function exportBackup():Promise<{fileCount:number;totalBytes:number}>{
  const records:Record<string,unknown>={};
  for(const key of KEYS){
    const raw=localStorage.getItem(key);
    records[key]=raw?JSON.parse(raw):key==="fox-screens"||key==="fox-tables-v1"?[]:key==="fox-notes-tasks-v1"?{tasks:[],notes:[]}:key==="fox-editor-widgets-v1"?{}:key==="fox-projects-v1"?{version:1,projects:[]}:key==="fox-operations-v1"?{version:1,transactions:[],publications:[],budgets:[],ledger:[]}:key==="fox-trackers-v1"?{version:1,trackers:[]}:key==="fox-theme"?"light":"#f06432";
  }
  const items=await listItems();
  let totalBytes=0;
  const files:SerializedFile[]=[];
  for(const item of items){
    const {blob,...metadata}=item;
    if(item.kind==="file"&&!blob)throw Error("Файл «"+item.name+"» недоступен. Резервная копия не создана");
    if(blob&&blob.size>MAX_FILE)throw Error("Файл «"+item.name+"» больше 60 МБ. Требуется файловая копия другого формата");
    totalBytes+=blob?.size??0;
    if(totalBytes>MAX_IMPORT*0.70)throw Error("Размер файлов превышает лимит JSON-копии");
    files.push({...metadata,...(blob?{blobBase64:toBase64(new Uint8Array(await blob.arrayBuffer()))}:{})});
  }
  const backup:Backup={format:FORMAT,createdAt:new Date().toISOString(),records,files};
  const bytes=new Blob([JSON.stringify(backup)],{type:"application/json"});
  if(bytes.size>MAX_IMPORT)throw Error("Объём архива превышает лимит 150 МБ");
  const url=URL.createObjectURL(bytes);
  const link=document.createElement("a");
  link.href=url;link.download="fox-space-backup-"+backup.createdAt.slice(0,10)+".json";
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  return {fileCount:items.filter(item=>item.kind==="file").length,totalBytes};
}

export async function inspectBackup(file:File):Promise<{backup:Backup;items:StoredItem[];summary:string}>{
  if(file.size>MAX_IMPORT)throw Error("Архив больше 150 МБ");
  const raw=JSON.parse(await file.text()) as Backup;
  if(raw?.format!==FORMAT)throw Error("Неподдерживаемая версия резервной копии");
  const records=validateRecords(raw.records);
  if(!Array.isArray(raw.files)||raw.files.length>10000)throw Error("Повреждён список файлов");
  const ids=new Set<string>();
  const items:StoredItem[]=[];
  let total=0;
  for(const entry of raw.files){
    if(!entry||typeof entry.id!=="string"||!entry.id||ids.has(entry.id))throw Error("Некорректный ID файла");
    if(entry.kind!=="file"&&entry.kind!=="folder")throw Error("Некорректный тип элемента");
    if(typeof entry.name!=="string"||!entry.name.trim()||typeof entry.size!=="number"||entry.size<0)throw Error("Некорректные метаданные");
    ids.add(entry.id);
    let blob:Blob|undefined;
    if(entry.kind==="file"){
      if(typeof entry.blobBase64!=="string")throw Error("Нет данных файла «"+entry.name+"»");
      blob=fromBase64(entry.blobBase64);
      total+=blob.size;
      if(blob.size!==entry.size||total>MAX_IMPORT)throw Error("Размер файла не совпадает с данными");
    }
    const {blobBase64,...metadata}=entry;
    items.push({...metadata,blob:blob?new Blob([blob],{type:entry.mime||"application/octet-stream"}):undefined});
  }
  for(const item of items)if(item.parentId!==null&&!ids.has(item.parentId))throw Error("Найдена папка с отсутствующим родителем");
  const summary=`${(records["fox-screens"] as unknown[]).length} экранов · ${(records["fox-tables-v1"] as unknown[]).length} таблиц · ${((records["fox-projects-v1"] as {projects:unknown[]}).projects).length} проектов · ${items.filter(x=>x.kind==="file").length} файлов`;
  return {backup:raw,items,summary};
}
export async function restoreBackup(backup:Backup,items:StoredItem[]):Promise<void>{
  const records=validateRecords(backup.records);
  const existing=await listItems();
  const old=new Map<string,string|null>();
  for(const key of KEYS)old.set(key,localStorage.getItem(key));
  try{
    await replaceItems(items);
    for(const key of KEYS)localStorage.setItem(key,JSON.stringify(records[key]));
  }catch(error){
    await replaceItems(existing).catch(()=>{});
    for(const [key,value] of old){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* quota failure */}}
    throw error;
  }
  window.dispatchEvent(new Event("fox-space-restored"));
}
