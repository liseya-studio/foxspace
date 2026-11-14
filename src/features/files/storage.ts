export type StoredItem = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "file" | "folder";
  mime: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  blob?: Blob;
};
const DB = "fox-space-files-v1";
const STORE = "items";

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
    let result:T;
    let hasResult=false;
    tx.oncomplete=()=>{db.close();if(hasResult)resolve(result);else reject(new Error("Операция не завершена"));};
    tx.onerror=()=>{db.close();reject(tx.error??new Error("Ошибка записи файла"));};
    tx.onabort=()=>{db.close();reject(tx.error??new Error("Операция отменена"));};
    try { action(tx.objectStore(STORE),value=>{result=value;hasResult=true;}); }
    catch(error){tx.abort();reject(error);}
  });
}
export async function listItems(): Promise<StoredItem[]>{
  return transaction<StoredItem[]>("readonly",(store,done)=>{
    const req=store.getAll();
    req.onsuccess=()=>done(req.result as StoredItem[]);
  });
}
export async function getItem(id:string):Promise<StoredItem|undefined>{
  return transaction<StoredItem|undefined>("readonly",(store,done)=>{
    const req=store.get(id);
    req.onsuccess=()=>done(req.result as StoredItem|undefined);
  });
}
export async function saveItem(item:StoredItem):Promise<void>{
  return transaction<void>("readwrite",(store,done)=>{store.put(item);done(undefined);});
}
export async function uploadFiles(files:FileList|File[],parentId:string|null=null):Promise<StoredItem[]>{
  const added:StoredItem[]=[];
  for(const file of Array.from(files)){
    const now=new Date().toISOString();
    const item:StoredItem={id:crypto.randomUUID(),parentId,name:file.name,kind:"file",mime:file.type||"application/octet-stream",size:file.size,blob:file,createdAt:now,updatedAt:now};
    await saveItem(item);
    added.push(item);
  }
  window.dispatchEvent(new Event("fox-files-updated"));
  return added;
}
export async function createFolder(name:string,parentId:string|null=null):Promise<StoredItem>{
  const now=new Date().toISOString();
  const folder:StoredItem={id:crypto.randomUUID(),parentId,name:name.trim(),kind:"folder",mime:"",size:0,createdAt:now,updatedAt:now};
  if(!folder.name)throw new Error("Нужно название папки");
  await saveItem(folder);
  window.dispatchEvent(new Event("fox-files-updated"));
  return folder;
}
export async function editItem(id:string,patch:Pick<Partial<StoredItem>,"name"|"parentId">):Promise<void>{
  const item=await getItem(id);
  if(!item)throw new Error("Файл не найден");
  if(typeof patch.name==="string"&&!patch.name.trim())throw new Error("Название не может быть пустым");
  const updated={...item,...patch,updatedAt:new Date().toISOString()};
  await saveItem(updated);
  window.dispatchEvent(new Event("fox-files-updated"));
}
export async function deleteItem(id:string):Promise<void>{
  const all=await listItems();
  const ids=new Set([id]);
  let found=true;
  while(found){found=false;for(const item of all){if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);found=true;}}}
  await transaction<void>("readwrite",(store,done)=>{for(const entryId of ids)store.delete(entryId);done(undefined);});
  window.dispatchEvent(new Event("fox-files-updated"));
}
export async function downloadItem(item:StoredItem):Promise<void>{
  if(item.kind!=="file"||!item.blob)throw new Error("Содержимое файла не найдено");
  const url=URL.createObjectURL(item.blob);
  const link=document.createElement("a");
  link.href=url;link.download=item.name;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function sizeLabel(size:number):string{
  if(size<1024)return size+" Б";
  if(size<1024*1024)return (size/1024).toFixed(1)+" КБ";
  if(size<1024*1024*1024)return (size/(1024*1024)).toFixed(1)+" МБ";
  return (size/(1024*1024*1024)).toFixed(2)+" ГБ";
}
