import { isTauri, invoke } from "@tauri-apps/api/core";
export type StoredItem = {
  id: string; parentId: string | null; name: string; kind: "file" | "folder";
  mime: string; size: number; createdAt: string; updatedAt: string; blob?: Blob;
};
const DB = "fox-space-files-v1";
const STORE = "items";
const NATIVE_INDEX_KEY = "fox-native-files-index-v1";
let nativeIndexReady = false;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const store=db.createObjectStore(STORE,{keyPath:"id"});
        store.createIndex("parentId","parentId",{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error??new Error("Не удалось открыть файловое хранилище"));
  });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, done: (value:T)=>void)=>void): Promise<T>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    let result:T;let hasResult=false;
    tx.oncomplete=()=>{db.close();if(hasResult)resolve(result);else reject(new Error("Операция не завершена"));};
    tx.onerror=()=>{db.close();reject(tx.error??new Error("Ошибка записи файла"));};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Операция отменена"));};
    try{action(tx.objectStore(STORE),value=>{result=value;hasResult=true;});}
    catch(error){tx.abort();reject(error);}
  });
}
async function rawItems():Promise<StoredItem[]>{return transaction<StoredItem[]>("readonly",(store,done)=>{const req=store.getAll();req.onsuccess=()=>done(req.result as StoredItem[]);});}
async function storeMetadata(items:StoredItem[]):Promise<void>{await transaction<void>("readwrite",(store,done)=>{store.clear();for(const item of items){const {blob,...metadata}=item;store.put(metadata);}done(undefined);});}
function toBase64(bytes:Uint8Array):string{let result="";const size=0x8000;for(let i=0;i<bytes.length;i+=size)result+=String.fromCharCode(...bytes.subarray(i,i+size));return btoa(result);}
function fromBase64(value:string,mime:string):Blob{const raw=atob(value);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Blob([bytes],{type:mime||"application/octet-stream"});}
async function writeNativeBlob(item:StoredItem):Promise<void>{if(!item.blob)return;if(item.blob.size>60*1024*1024)throw new Error("Файл «"+item.name+"» превышает лимит 60 МБ для локального хранилища");await invoke("write_file_blob",{id:item.id,dataBase64:toBase64(new Uint8Array(await item.blob.arrayBuffer()))});}
async function hydrateNativeBlob(item:StoredItem):Promise<StoredItem>{if(!isTauri()||item.kind!=="file"||item.blob)return item;const encoded=await invoke<string|null>("read_file_blob",{id:item.id});if(encoded===null)throw new Error("Не найдено локальное содержимое файла «"+item.name+"»");return {...item,blob:fromBase64(encoded,item.mime)};}
async function updateNativeIndex():Promise<void>{if(!isTauri())return;const items=await rawItems();const metadata=items.map(({blob,...item})=>item);localStorage.setItem(NATIVE_INDEX_KEY,JSON.stringify(metadata));}
async function ensureNativeIndex():Promise<void>{
  if(!isTauri()||nativeIndexReady)return;
  const savedRaw=localStorage.getItem(NATIVE_INDEX_KEY);
  if(savedRaw!==null){
    try{const saved=JSON.parse(savedRaw) as StoredItem[];if(!Array.isArray(saved))throw new Error("Invalid native file index");await storeMetadata(saved);nativeIndexReady=true;return;}
    catch(error){console.error("Fox Space native file index could not be restored",error);}
  }
  const existing=await rawItems();
  if(existing.length){
    for(const item of existing)if(item.kind==="file"&&item.blob)await writeNativeBlob(item);
    await storeMetadata(existing);
  }
  await updateNativeIndex();
  nativeIndexReady=true;
}
export async function listItems(includeBlobs=false): Promise<StoredItem[]>{
  await ensureNativeIndex();
  const items=await rawItems();
  if(!includeBlobs)return items;
  return Promise.all(items.map(item=>hydrateNativeBlob(item)));
}
export async function getItem(id:string):Promise<StoredItem|undefined>{
  await ensureNativeIndex();
  const item=await transaction<StoredItem|undefined>("readonly",(store,done)=>{const req=store.get(id);req.onsuccess=()=>done(req.result as StoredItem|undefined);});
  return item?hydrateNativeBlob(item):undefined;
}
export async function saveItem(item:StoredItem):Promise<void>{
  await ensureNativeIndex();
  if(isTauri()&&item.kind==="file"&&item.blob)await writeNativeBlob(item);
  const value=isTauri()?(({blob,...metadata})=>metadata)(item):item;
  await transaction<void>("readwrite",(store,done)=>{store.put(value);done(undefined);});
  await updateNativeIndex();
}
export async function replaceItems(items:StoredItem[]):Promise<void>{
  await ensureNativeIndex();
  if(isTauri()){
    const previous=await rawItems();
    const nextIds=new Set(items.filter(x=>x.kind==="file").map(x=>x.id));
    for(const item of items)if(item.kind==="file"&&item.blob)await writeNativeBlob(item);
    await storeMetadata(items);
    await updateNativeIndex();
    for(const old of previous)if(old.kind==="file"&&!nextIds.has(old.id))await invoke("delete_file_blob",{id:old.id});
  }else{
    await transaction<void>("readwrite",(store,done)=>{store.clear();for(const item of items)store.put(item);done(undefined);});
  }
  window.dispatchEvent(new Event("fox-files-updated"));
}
export async function uploadFiles(files:FileList|File[],parentId:string|null=null):Promise<StoredItem[]>{
  const added:StoredItem[]=[];
  for(const file of Array.from(files)){
    const now=new Date().toISOString();
    const item:StoredItem={id:crypto.randomUUID(),parentId,name:file.name,kind:"file",mime:file.type||"application/octet-stream",size:file.size,blob:file,createdAt:now,updatedAt:now};
    await saveItem(item);added.push(item);
  }
  window.dispatchEvent(new Event("fox-files-updated"));return added;
}
export async function createFolder(name:string,parentId:string|null=null):Promise<StoredItem>{
  const now=new Date().toISOString();
  const folder:StoredItem={id:crypto.randomUUID(),parentId,name:name.trim(),kind:"folder",mime:"",size:0,createdAt:now,updatedAt:now};
  if(!folder.name)throw new Error("Нужно название папки");
  await saveItem(folder);window.dispatchEvent(new Event("fox-files-updated"));return folder;
}
export async function editItem(id:string,patch:Pick<Partial<StoredItem>,"name"|"parentId">):Promise<void>{
  const item=await getItem(id);if(!item)throw new Error("Файл не найден");
  if(typeof patch.name==="string"&&!patch.name.trim())throw new Error("Название не может быть пустым");
  await saveItem({...item,...patch,updatedAt:new Date().toISOString()});window.dispatchEvent(new Event("fox-files-updated"));
}
export async function deleteItem(id:string):Promise<void>{
  const all=await listItems();const ids=new Set([id]);let found=true;
  while(found){found=false;for(const item of all)if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);found=true;}}
  await transaction<void>("readwrite",(store,done)=>{for(const entryId of ids)store.delete(entryId);done(undefined);});
  await updateNativeIndex();
  if(isTauri())for(const item of all)if(ids.has(item.id)&&item.kind==="file")await invoke("delete_file_blob",{id:item.id});
  window.dispatchEvent(new Event("fox-files-updated"));
}
export async function downloadItem(item:StoredItem):Promise<void>{
  if(item.kind!=="file")throw new Error("Это не файл");
  const full=item.blob?item:await getItem(item.id);
  if(!full?.blob)throw new Error("Содержимое файла не найдено");
  const url=URL.createObjectURL(full.blob);const link=document.createElement("a");link.href=url;link.download=item.name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function sizeLabel(size:number):string{
  if(size<1024)return size+" Б";
  if(size<1024*1024)return (size/1024).toFixed(1)+" КБ";
  if(size<1024*1024*1024)return (size/(1024*1024)).toFixed(1)+" МБ";
  return (size/(1024*1024*1024)).toFixed(2)+" ГБ";
}
