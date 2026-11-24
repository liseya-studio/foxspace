import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock3, CalendarDays, AlertCircle, Check, RotateCcw, ArrowUpRight, Inbox, Monitor, BellOff } from "lucide-react";
import { listNotifications, markAllNotifications, markNotification, snoozeNotification, enableDesktopReminders, disableDesktopReminders, dispatchDesktopReminders, getReminderPreferences, type LocalNotification } from "./data";
import PlatformIcon from "../icons/PlatformIcon";

type Props={onOpenTask:(taskId:string)=>void};
type Filter="all"|"unread";
const category:Record<LocalNotification["kind"],string>={overdue:"Просрочено",today:"Сегодня",upcoming:"Скоро"};
export default function NotificationCenter({onOpenTask}:Props){
  const [version,setVersion]=useState(0);
  const [filter,setFilter]=useState<Filter>("all");
  const [permissionMessage,setPermissionMessage]=useState("");
  useEffect(()=>{
    const refresh=()=>setVersion(v=>v+1);
    window.addEventListener("fox-notifications-updated",refresh);
    window.addEventListener("fox-notes-tasks-updated",refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener("focus",refresh);
    const timer=window.setInterval(refresh,60_000);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("fox-notifications-updated",refresh);window.removeEventListener("fox-notes-tasks-updated",refresh);window.removeEventListener("storage",refresh);};
  },[]);
  async function toggleReminders(){
    setPermissionMessage("");
    try{
      if(getReminderPreferences().enabled)disableDesktopReminders();
      else if(await enableDesktopReminders()){
        setPermissionMessage("Уведомления включены.");
        void dispatchDesktopReminders();
      }else setPermissionMessage("Разрешите уведомления в настройках macOS или браузера.");
    }catch{
      setPermissionMessage("Не удалось запросить разрешение на уведомления.");
    }
  }
  const items=useMemo(()=>listNotifications(),[version]);
  const unread=items.filter(x=>!x.isRead).length;
  const visible=filter==="unread"?items.filter(x=>!x.isRead):items;
  function open(item:LocalNotification){markNotification(item.id,true);onOpenTask(item.taskId);}
  return <section className="fox-notifications">
    <div className="fox-comm-heading"><div><span className="eyebrow">ЦЕНТР СОБЫТИЙ</span><h1>Уведомления</h1><p>Сроки задач из вашего рабочего пространства. Обновляются при изменении задач.</p></div><div className="fox-comm-count"><Bell size={18}/><strong>{unread}</strong><span>непрочитанных</span></div></div>
    <div className="fox-comm-panel">
      <div className="fox-comm-toolbar"><div className="fox-comm-segments"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Все <span>{items.length}</span></button><button className={filter==="unread"?"active":""} onClick={()=>setFilter("unread")}>Непрочитанные <span>{unread}</span></button></div><button className="fox-comm-action" onClick={()=>markAllNotifications(items.map(x=>x.id))} disabled={!unread}><CheckCheck size={16}/> Прочитать все</button></div>
      <div className="fox-notification-list">{visible.map(item=><article key={item.id} className={"fox-notification-row "+item.kind+(item.isRead?" read":"")}>
        <div className="fox-notification-mark">{item.kind==="overdue"?<AlertCircle size={19}/>:item.kind==="today"?<Clock3 size={19}/>:<CalendarDays size={19}/>}</div>
        <div className="fox-notification-text"><div className="fox-notification-meta"><span>{category[item.kind]}</span><small>{new Date(item.date+"T12:00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}</small>{!item.isRead&&<i aria-label="Не прочитано"/>}</div><button className="fox-notification-title" onClick={()=>open(item)}>{item.title}<ArrowUpRight size={14}/></button><p>{item.description}</p></div>
        <div className="fox-notification-actions"><button title={item.isRead?"Отметить непрочитанным":"Отметить прочитанным"} onClick={()=>markNotification(item.id,!item.isRead)}>{item.isRead?<RotateCcw size={15}/>:<Check size={15}/>}</button><button title="Отложить на один день" onClick={()=>snoozeNotification(item.id,1)}><Clock3 size={15}/></button></div>
      </article>)}
      {!visible.length&&<div className="fox-comm-empty"><Inbox size={32}/><h2>{filter==="unread"?"Всё прочитано":"Уведомлений нет"}</h2><p>{filter==="unread"?"Новых уведомлений пока нет.":"Здесь появятся задачи со сроком сегодня, просроченные и задачи на ближайшие три дня."}</p></div>}
      </div>
    </div>
    <section className="fox-notification-platforms" aria-label="Источники уведомлений"><div className="fox-notification-platforms-head"><strong>Площадки и сервисы</strong><span>Значки готовы к подключению. Уведомления из этих сервисов пока не синхронизируются.</span></div><div className="fox-notification-platforms-icons">{[["tg","Telegram"],["vk","ВКонтакте"],["tiktok","TikTok"],["x","X"],["gmail","Gmail"],["whatsapp","WhatsApp"],["kwork","Kwork"],["avito","Авито"],["hh","HeadHunter"],["youtube","YouTube"]].map(([id,label])=><div key={id} className="fox-notification-platform" title={label+" · Не подключено"}><PlatformIcon value={id} size={27}/><span>{label}</span></div>)}</div></section>
    <div className="fox-notification-desktop"><div><Monitor size={17}/><span><strong>Напоминания на рабочем столе</strong><small>Системное уведомление о задачах со сроком сегодня, пока Fox Space открыт.</small></span></div><button onClick={toggleReminders}>{getReminderPreferences().enabled?<BellOff size={15}/>:<Bell size={15}/>} {getReminderPreferences().enabled?"Отключить":"Включить"}</button></div>
    {permissionMessage&&<p className="fox-comm-footnote" role="status">{permissionMessage}</p>}
    <p className="fox-comm-footnote">Для системных оповещений требуется разрешение macOS или браузера.</p>
  </section>;
}
