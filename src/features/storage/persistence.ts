import { isTauri, invoke } from "@tauri-apps/api/core";
const DB_NAME="fox-space-persistence-v1";
const STORE="records";
type RecordEntry={key:string;value:string;updatedAt:string};
let databasePromise:Promise<IDBDatabase>|null=null;
let writeQueue=Promise.resolve();
let initialized=false;
let nativeMode=false;
let nativeWriteQueue=Promise.resolve();
let nativePaused=false;
let nativeTimer:number|undefined;
function openDb():Promise<IDBDatabase>{if(databasePromise)return databasePromise;databasePromise=new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:"key"});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>{databasePromise=null;reject(request.error??new Error("Не удалось открыть локальное хранилище"));};});return databasePromise;}
function allRecords(db:IDBDatabase):Promise<RecordEntry[]>{return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),request=tx.objectStore(STORE).getAll();request.onsuccess=()=>resolve(request.result as RecordEntry[]);request.onerror=()=>reject(request.error);});}
function writeRecord(key:string,value:string){writeQueue=writeQueue.then(async()=>{const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put({key,value,updatedAt:new Date().toISOString()} satisfies RecordEntry);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}).catch(error=>{console.error("Fox Space persistence mirror failed",error);});}
function deleteRecord(key:string){writeQueue=writeQueue.then(async()=>{const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}).catch(error=>console.error("Fox Space persistence delete failed",error));}
function readSnapshot():Record<string,string>{
  const snapshot:Record<string,string>={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key!==null){
      const value=localStorage.getItem(key);
      if(value!==null)snapshot[key]=value;
    }
  }
  return snapshot;
}
function enqueueNativeSnapshot(){
  if(!nativeMode||nativePaused)return;
  const content=JSON.stringify(readSnapshot());
  nativeWriteQueue=nativeWriteQueue.catch(()=>{}).then(()=>invoke<void>("write_workspace_snapshot",{content}));
  void nativeWriteQueue.catch(error=>console.error("Fox Space native persistence failed",error));
}
function flushNativeTimer(){
  if(nativeTimer===undefined)return;
  window.clearTimeout(nativeTimer);
  nativeTimer=undefined;
  enqueueNativeSnapshot();
}
function queueNativeSnapshot(){
  if(!nativeMode||nativePaused)return;
  if(nativeTimer!==undefined)window.clearTimeout(nativeTimer);
  nativeTimer=window.setTimeout(flushNativeTimer,250);
}
export async function createNativeBackup():Promise<string|null>{if(!isTauri())return null;await flushPersistentStorage();await nativeWriteQueue;return invoke<string>("create_native_backup");}
export async function restoreNativeBackup():Promise<string>{
  if(!isTauri())throw new Error("Нативное восстановление доступно только в macOS-приложении");
  const pending=flushPersistentStorage();
  nativePaused=true;
  try{
    await pending;
    return await invoke<string>("restore_latest_native_backup");
  }catch(error){
    nativePaused=false;
    queueNativeSnapshot();
    throw error;
  }
}

export async function initializePersistentStorage():Promise<void>{
  if(initialized||typeof window==="undefined"||!("indexedDB" in window))return;
  nativeMode=isTauri();
  if(nativeMode){
    const raw=await invoke<string|null>("read_workspace_snapshot");
    if(raw){
      const snapshot=JSON.parse(raw) as Record<string,string>;
      if(!snapshot||Array.isArray(snapshot)||typeof snapshot!=="object"||Object.values(snapshot).some(value=>typeof value!=="string")){
        throw new Error("Повреждён снимок рабочего пространства");
      }
      localStorage.clear();
      for(const [key,value] of Object.entries(snapshot))localStorage.setItem(key,value);
    }else await invoke("write_workspace_snapshot",{content:JSON.stringify(readSnapshot())});
  }
  const db=await openDb();
  const saved=new Map((await allRecords(db)).map(record=>[record.key,record.value]));
  for(const [key,value] of saved){
    if(!nativeMode&&localStorage.getItem(key)===null)localStorage.setItem(key,value);
  }
  for(const [key,value] of Object.entries(readSnapshot())){
    if(saved.get(key)!==value)writeRecord(key,value);
  }
  const originalSet=Storage.prototype.setItem;
  const originalRemove=Storage.prototype.removeItem;
  const originalClear=Storage.prototype.clear;
  Storage.prototype.setItem=function(key:string,value:string){
    originalSet.call(this,key,value);
    if(this===window.localStorage){writeRecord(key,value);queueNativeSnapshot();}
  };
  Storage.prototype.removeItem=function(key:string){
    originalRemove.call(this,key);
    if(this===window.localStorage){deleteRecord(key);queueNativeSnapshot();}
  };
  Storage.prototype.clear=function(){
    const keys=this===window.localStorage?Object.keys(readSnapshot()):[];
    originalClear.call(this);
    if(this===window.localStorage){keys.forEach(deleteRecord);queueNativeSnapshot();}
  };
  document.addEventListener("visibilitychange",flushNativeTimer);
  window.addEventListener("pagehide",flushNativeTimer);
  initialized=true;
  window.dispatchEvent(new Event("fox-persistence-ready"));
}
export async function requestPersistentStorage():Promise<{persistent:boolean;quota?:number;usage?:number}>{const persistent=await navigator.storage?.persist?.()??false;const estimate=await navigator.storage?.estimate?.();return {persistent,quota:estimate?.quota,usage:estimate?.usage};}
export async function getPersistenceStatus():Promise<{persistent:boolean;native:boolean;records:number;usage?:number;quota?:number}>{const db=await openDb();const records=await allRecords(db);const persistent=await navigator.storage?.persisted?.()??false;const estimate=await navigator.storage?.estimate?.();return {persistent,native:isTauri(),records:records.length,usage:estimate?.usage,quota:estimate?.quota};}
export async function flushPersistentStorage():Promise<void>{
  flushNativeTimer();
  await writeQueue;
  await nativeWriteQueue;
}
