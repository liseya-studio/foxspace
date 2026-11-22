import { useEffect, useRef, useState } from "react";
import { Download, Upload, ShieldCheck, AlertTriangle, X } from "lucide-react";
import { exportBackup, inspectBackup, restoreBackup } from "./backup";
import { createAutoBackup, getAutoBackupStatus, restoreLatestAutoBackup } from "./autoBackup";

export default function BackupPanel(){
  const ref=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<File|null>(null);
  const [lastAuto,setLastAuto]=useState<string|null>(null);
  const [autoCount,setAutoCount]=useState(0);
  useEffect(()=>{void getAutoBackupStatus().then(status=>{setLastAuto(status.createdAt);setAutoCount(status.count);}).catch(()=>{});},[]);
  async function create(){
    setBusy(true);setError("");setStatus("");
    try{
      const result=await exportBackup();
      await createAutoBackup(true);
      const backupStatus=await getAutoBackupStatus();setLastAuto(backupStatus.createdAt);setAutoCount(backupStatus.count);
      setStatus("Резервная копия скачана. Файлов: "+result.fileCount+". Локальная копия также сохранена.");
    }catch(e){setError(e instanceof Error?e.message:"Экспорт не удался");}
    finally{setBusy(false);}
  }
  async function restore(){
    if(!selected)return;
    setBusy(true);setError("");
    try{
      const {backup,items,summary}=await inspectBackup(selected);
      if(!window.confirm("Восстановить архив ("+summary+")? Текущие экраны, таблицы, заметки и файлы будут заменены."))return;
      await restoreBackup(backup,items);
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:"Не удалось восстановить архив");}
    finally{setBusy(false);}
  }
  async function restoreAutomatic(){setBusy(true);setError("");try{if(!window.confirm("Восстановить последнюю автоматическую копию? Текущие данные будут заменены."))return;await restoreLatestAutoBackup();window.location.reload();}catch(e){setError(e instanceof Error?e.message:"Не удалось восстановить автоматическую копию");}finally{setBusy(false);}}
  return <section className="fox-backup">
    <div className="fox-backup-intro"><ShieldCheck size={21}/><div><strong>Резервная копия рабочего пространства</strong><p>Сохраняет экраны, таблицы, задачи, заметки, виджеты, настройки, папки и содержимое файлов в один JSON-архив. Данные не отправляются на сервер.</p></div></div>
    <div className="fox-backup-actions"><button disabled={busy} onClick={()=>void create()}><Download size={16}/> Скачать резервную копию</button><input hidden type="file" ref={ref} accept=".json,application/json" onChange={e=>setSelected(e.target.files?.[0]??null)}/><button disabled={busy} onClick={()=>ref.current?.click()}><Upload size={16}/> Выбрать архив</button></div>
    {selected&&<div className="fox-backup-selected"><span>{selected.name}</span><button disabled={busy} onClick={()=>void restore()}>Восстановить данные</button><button onClick={()=>{setSelected(null);if(ref.current)ref.current.value="";}} title="Отмена"><X size={15}/></button></div>}
    <div className="fox-backup-auto"><div><strong>Автоматические копии</strong><span>{lastAuto?"Последняя: "+new Date(lastAuto).toLocaleString("ru-RU"):"Будет создана при запуске приложения"} · Хранится версий: {autoCount}/5</span></div><button disabled={busy||!lastAuto} onClick={()=>void restoreAutomatic()}>Восстановить последнюю</button></div>
    <div className="fox-backup-warning"><AlertTriangle size={16}/> Восстановление заменяет существующие данные. Проверяйте архив перед восстановлением. Лимит JSON-архива — 150 МБ, отдельного файла — 60 МБ.</div>
    {status&&<p className="fox-backup-status" role="status">{status}</p>}
    {error&&<p className="fox-backup-error" role="alert">{error}</p>}
  </section>;
}
