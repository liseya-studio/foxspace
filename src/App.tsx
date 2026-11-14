import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import FilesHub from "./features/files/FilesHub";
import { uploadFiles } from "./features/files/storage";
import BackupPanel from "./features/backup/BackupPanel";
import { listItems, type StoredItem } from "./features/files/storage";
import FoxEditor from "./features/editor/FoxEditor";
import NotesTasks from "./features/notes/NotesTasks";
import { readNotesTasks } from "./features/notes/data";
import NotificationCenter from "./features/notifications/NotificationCenter";
import MessagesCenter from "./features/messages/MessagesCenter";
import { unreadNotificationCount, dispatchDesktopReminders } from "./features/notifications/data";
import {
  Bell, Mail, Search, Plus, ChevronDown, MoreHorizontal, Settings,
  FileSpreadsheet, StickyNote, CheckSquare, LayoutDashboard, X, Sun,
  Moon, Monitor, Palette, PanelRightClose, Command, ArrowUpRight,
  CircleHelp, CalendarDays, Folder, Sparkles, SlidersHorizontal, Upload, FolderPlus, Database, ArrowDownToLine
} from "lucide-react";

type Screen = { id: string; name: string; tableId?: string };
type Section = "home" | "files" | "notes" | "notifications" | "messages" | string;

const starterScreens: Screen[] = [];
const accents = [
  { name: "Оранжевый", value: "#f06432" },
  { name: "Синий", value: "#4779d5" },
  { name: "Зелёный", value: "#388b69" },
  { name: "Фиолетовый", value: "#8864c8" },
  { name: "Розовый", value: "#d45e88" },
];

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

export default function App() {
  const [screens, setScreens] = useState<Screen[]>(() => read("fox-screens", starterScreens));
  const [active, setActive] = useState<Section>("home");
  const [theme, setTheme] = useState(() => read("fox-theme", "light"));
  const [accent, setAccent] = useState(() => read("fox-accent", "#f06432"));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [screenMenuId, setScreenMenuId] = useState<string | null>(null);
  const [fileIndex,setFileIndex] = useState<StoredItem[]>([]);
  const [notificationRevision,setNotificationRevision] = useState(0);
  const [taskToOpen,setTaskToOpen] = useState<string|null>(null);
  const [previousSection,setPreviousSection] = useState<Section>("home");
  const [createAction,setCreateAction] = useState<{type:"task"|"note"|"table"|"folder";id:number}|null>(null);
  const [createError,setCreateError] = useState("");
  const uploadInput=useRef<HTMLInputElement>(null);


  useEffect(()=>{
    const update=()=>dispatchDesktopReminders();
    update();
    const timer=window.setInterval(update,5*60*1000);
    window.addEventListener("fox-notes-tasks-updated",update);
    return ()=>{window.clearInterval(timer);window.removeEventListener("fox-notes-tasks-updated",update);};
  },[]);
  useEffect(() => { localStorage.setItem("fox-screens", JSON.stringify(screens)); }, [screens]);
  useEffect(()=>{
    const update=()=>setNotificationRevision(current=>current+1);
    window.addEventListener("fox-notifications-updated",update);
    window.addEventListener("fox-notes-tasks-updated",update);
    window.addEventListener("storage",update);
    return ()=>{window.removeEventListener("fox-notifications-updated",update);window.removeEventListener("fox-notes-tasks-updated",update);window.removeEventListener("storage",update);};
  },[]);
  useEffect(()=>{if(!searchOpen)return;let active=true;void listItems().then(items=>{if(active)setFileIndex(items);}).catch(()=>{if(active)setFileIndex([]);});return()=>{active=false;};},[searchOpen]);
  useEffect(() => { localStorage.setItem("fox-theme", JSON.stringify(theme)); }, [theme]);
  useEffect(() => { localStorage.setItem("fox-accent", JSON.stringify(accent)); }, [accent]);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.setProperty("--accent", accent); }, [theme, accent]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); }
      if (e.key === "Escape") { setSearchOpen(false); setCreateOpen(false); setSettingsOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const unreadCount = useMemo(()=>unreadNotificationCount(),[notificationRevision]);
  const activeScreen = screens.find(s => s.id === active);
  const availableTables = read<{id:string;name:string;columns:{id:string;name:string;type:string}[];rows:{id:string;cells:Record<string,string|number|boolean>}[]}[]>("fox-tables-v1",[]);
  const attachedTable = availableTables.find(t => t.id === activeScreen?.tableId);
  const filteredScreens = useMemo(() => screens.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [screens, search]);
  const organizerSearch = searchOpen ? readNotesTasks() : {tasks:[],notes:[]};
  const searchTerm = search.trim().toLocaleLowerCase("ru");
  const matchingFiles = searchTerm ? fileIndex.filter(item=>item.name.toLocaleLowerCase("ru").includes(searchTerm)).slice(0,10) : [];
  const matchingTables = searchTerm ? availableTables.filter(t=>t.name.toLocaleLowerCase("ru").includes(searchTerm)||t.rows.some(r=>Object.values(r.cells).some(value=>String(value).toLocaleLowerCase("ru").includes(searchTerm)))) : [];
  const matchingTasks = searchTerm ? organizerSearch.tasks.filter(t=>(t.title+" "+t.description+" "+t.tags.join(" ")).toLocaleLowerCase("ru").includes(searchTerm)).slice(0,8) : [];
  const matchingNotes = searchTerm ? organizerSearch.notes.filter(n=>(n.title+" "+n.body).toLocaleLowerCase("ru").includes(searchTerm)).slice(0,8) : [];

  function openTopSection(section:"notifications"|"messages"){
    setSearchOpen(false);setSettingsOpen(false);
    if(active===section){setActive(previousSection);return;}
    if(active!=="notifications"&&active!=="messages")setPreviousSection(active);
    setActive(section);
  }
  function navigateToTask(taskId:string){setTaskToOpen(taskId);setActive("notes");}
  function startCreate(type:"task"|"note"|"table"|"folder"|"screen"|"upload"){
    setCreateOpen(false);setCreateError("");
    if(type==="screen"){addScreen();return;}
    if(type==="upload"){uploadInput.current?.click();return;}
    setCreateAction({type,id:Date.now()});
    setActive(type==="task"||type==="note"?"notes":"files");
  }
  async function uploadFromGlobal(files:FileList|null){
    if(!files?.length)return;
    try{await uploadFiles(files);setActive("files");}
    catch(error){setCreateError(error instanceof Error?error.message:"Ошибка загрузки");}
    finally{if(uploadInput.current)uploadInput.current.value="";}
  }
    function addScreen() {
    const name = "Новый экран";
    const item = { id: crypto.randomUUID(), name };
    setScreens(current => [...current, item]);
    setActive(item.id);
    setCreateOpen(false);
  }
  function saveRename(id: string) {
    const name = renameValue.trim();
    if (name) setScreens(current => current.map(s => s.id === id ? { ...s, name } : s));
    setRenameId(null);
  }
  function removeScreen(id: string) {
    setScreens(current => current.filter(s => s.id !== id));
    if (active === id) setActive("home");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="top-left">
          <button className="profile-avatar" aria-label="Профиль и настройки" onClick={() => setSettingsOpen(true)}>L</button>
          <span className="workspace-name">Fox Space</span>
          <ChevronDown size={14} className="muted-icon" />
        </div>
        <div className="top-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Поиск</span><kbd>⌘ K</kbd></button>
          <button className={"icon-button"+(active==="notifications"?" active":"")} title="Уведомления" aria-label={"Уведомления: "+unreadCount+" непрочитанных"} onClick={()=>openTopSection("notifications")}><Bell size={18}/>{unreadCount>0&&<span className="fox-bell-count">{unreadCount>99?"99+":unreadCount}</span>}</button>
          <button className={"icon-button"+(active==="messages"?" active":"")} title="Сообщения" onClick={()=>openTopSection("messages")}><Mail size={18}/></button>
          <button className="icon-button" title="Настройки" onClick={() => setSettingsOpen(true)}><Settings size={18}/></button>
        </div>
      </header>

      <main className="main-area">
        {active === "home" ? (
          <section className="welcome">
            <div className="welcome-copy">
              <div className="eyebrow"><Sparkles size={14}/> ВАШЕ ПРОСТРАНСТВО</div>
              <h1>Всё важное.<br/><span>В одном месте.</span></h1>
              <p>Создайте свой первый экран — добавьте таблицы, заметки и виджеты, которые помогают держать дела под контролем.</p>
              <button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17}/> Создать экран</button>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-window">
                <div className="art-window-head"><span/><span/><span/><b>Мой экран</b></div>
                <div className="art-skeleton">
                  <div className="skeleton-card wide"><i/><i/><i/></div>
                  <div className="skeleton-row"><div/><div/></div>
                  <div className="skeleton-card small"><i/><i/></div>
                </div>
              </div>
              <div className="art-float float-one"><FileSpreadsheet size={19}/></div>
              <div className="art-float float-two"><CheckSquare size={19}/></div>
              <div className="art-float float-three"><StickyNote size={19}/></div>
            </div>
          </section>
        ) : active === "notifications" ? (
          <NotificationCenter onOpenTask={navigateToTask}/>
        ) : active === "messages" ? (
          <MessagesCenter />
        ) : active === "files" ? (
          <FilesHub createAction={createAction?.type==="table"||createAction?.type==="folder"?{type:createAction.type,id:createAction.id}:null} onCreateConsumed={()=>setCreateAction(null)}/>
        ) : active === "notes" ? (
          <NotesTasks createAction={createAction?.type==="task"||createAction?.type==="note"?{type:createAction.type,id:createAction.id}:null} onCreateConsumed={()=>setCreateAction(null)} openTaskId={taskToOpen} onTaskOpened={()=>setTaskToOpen(null)}/>
        ) : (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">МОЙ ЭКРАН</div><h1>{activeScreen?.name ?? "Экран"}</h1><p>Добавляйте таблицы и виджеты, чтобы собрать нужное представление.</p></div></div>
            {activeScreen && <FoxEditor
              screenId={activeScreen.id}
              tables={availableTables}
              tableId={activeScreen.tableId}
              onTableChange={id => setScreens(prev => prev.map(s => s.id===activeScreen.id ? {...s,tableId:id||undefined} : s))}
              onOpenTables={() => setActive("files")}
            />}
          </section>
        )}
      </main>

      <nav className="dock" aria-label="Основная навигация">
        <div className="dock-fixed">
          <button className={active === "files" ? "dock-item active" : "dock-item"} onClick={() => setActive("files")}><FileSpreadsheet size={18}/><span>Файлы и таблицы</span></button>
          <button className={active === "notes" ? "dock-item active" : "dock-item"} onClick={() => setActive("notes")}><StickyNote size={18}/><span>Заметки и задачи</span></button>
        </div>
        {screens.length > 0 && <div className="dock-divider"/>}
        <div className="dock-screens">
          {screens.map(screen => (
            <div className={active === screen.id ? "dock-screen active" : "dock-screen"} key={screen.id}>
              {renameId === screen.id ? <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={() => saveRename(screen.id)} onKeyDown={e => e.key === "Enter" && saveRename(screen.id)} /> : <button className="dock-screen-name" onClick={() => setActive(screen.id)}><LayoutDashboard size={17}/>{screen.name}</button>}
              <button className="screen-more" title="Действия" onClick={() => setScreenMenuId(current => current===screen.id?null:screen.id)}><MoreHorizontal size={15}/></button>{screenMenuId===screen.id && <div className="screen-context-menu"><button onClick={()=>{setRenameId(screen.id);setRenameValue(screen.name);setScreenMenuId(null);}}>Переименовать</button><button className="danger" onClick={()=>{if(window.confirm("Удалить экран «"+screen.name+"»?"))removeScreen(screen.id);setScreenMenuId(null);}}>Удалить экран</button></div>}
            </div>
          ))}
        </div>
        <button className="dock-add" onClick={() => setCreateOpen(true)} title="Создать"><Plus size={20}/></button>
      </nav>

      <input hidden type="file" multiple ref={uploadInput} onChange={e=>{void uploadFromGlobal(e.target.files);}}/>
      {createError&&<div role="alert" className="fox-global-error">{createError}<button onClick={()=>setCreateError("")}><X size={14}/></button></div>}
      {createOpen && <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setCreateOpen(false)}><div className="dialog fox-global-create"><button className="close-button" onClick={()=>setCreateOpen(false)}><X size={18}/></button><div className="eyebrow">НОВАЯ ЗАПИСЬ</div><h2>Что создать?</h2><div className="fox-global-create-items">
        <button onClick={()=>startCreate("screen")}><LayoutDashboard size={19}/><span><strong>Экран</strong><small>Конструктор виджетов</small></span></button>
        <button onClick={()=>startCreate("table")}><Database size={19}/><span><strong>Таблица</strong><small>Структурированные данные</small></span></button>
        <button onClick={()=>startCreate("task")}><CheckSquare size={19}/><span><strong>Задача</strong><small>Сроки и приоритеты</small></span></button>
        <button onClick={()=>startCreate("note")}><StickyNote size={19}/><span><strong>Заметка</strong><small>Текст, файлы и идеи</small></span></button>
        <button onClick={()=>startCreate("folder")}><FolderPlus size={19}/><span><strong>Папка</strong><small>Организация файлов</small></span></button>
        <button onClick={()=>startCreate("upload")}><Upload size={19}/><span><strong>Загрузить файлы</strong><small>В локальное хранилище</small></span></button>
      </div></div></div>}

      {searchOpen && <div className="overlay search-overlay" onMouseDown={e => e.target === e.currentTarget && setSearchOpen(false)}><div className="search-dialog"><div className="search-line"><Search size={19}/><input autoFocus placeholder="Экраны, таблицы, задачи, заметки..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>ESC</kbd><button className="close-button" onClick={() => setSearchOpen(false)}><X size={17}/></button></div><div className="search-results"><button onClick={() => {setActive("home");setSearchOpen(false);}}><LayoutDashboard size={17}/>Главная</button><button onClick={() => {setActive("files");setSearchOpen(false);}}><FileSpreadsheet size={17}/>Файлы и таблицы</button><button onClick={() => {setActive("notes");setSearchOpen(false);}}><StickyNote size={17}/>Заметки и задачи</button><button onClick={()=>{setActive("notifications");setSearchOpen(false);}}><Bell size={17}/>Уведомления</button><button onClick={()=>{setActive("messages");setSearchOpen(false);}}><Mail size={17}/>Сообщения</button>{filteredScreens.map(s => <button key={s.id} onClick={() => {setActive(s.id);setSearchOpen(false);}}><LayoutDashboard size={17}/>{s.name}</button>)}{matchingFiles.length>0&&<div className="fox-search-category">Файлы и папки</div>}{matchingFiles.map(item=><button key={item.id} onClick={()=>{setActive("files");setSearchOpen(false);}}><Folder size={17}/><span>{item.name}</span></button>)}{matchingTables.length>0&&<div className="fox-search-category">Таблицы и данные</div>}{matchingTables.map(t=><button key={t.id} onClick={()=>{setActive("files");setSearchOpen(false);}}><FileSpreadsheet size={17}/><span>{t.name}</span></button>)}{matchingTasks.length>0&&<div className="fox-search-category">Задачи</div>}{matchingTasks.map(t=><button key={t.id} onClick={()=>{navigateToTask(t.id);setSearchOpen(false);}}><CheckSquare size={17}/><span>{t.title}</span></button>)}{matchingNotes.length>0&&<div className="fox-search-category">Заметки</div>}{matchingNotes.map(n=><button key={n.id} onClick={()=>{setActive("notes");setSearchOpen(false);}}><StickyNote size={17}/><span>{n.title}</span></button>)}</div></div></div>}

      {settingsOpen && <div className="overlay settings-overlay" onMouseDown={e => e.target === e.currentTarget && setSettingsOpen(false)}><aside className="settings-panel"><div className="settings-head"><div><div className="eyebrow">ПЕРСОНАЛИЗАЦИЯ</div><h2>Настройки</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div><div className="setting-group"><h3>Тема оформления</h3><div className="theme-options"><button className={theme === "light" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("light")}><Sun size={18}/>Светлая</button><button className={theme === "dark" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("dark")}><Moon size={18}/>Тёмная</button><button className={theme === "system" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("system")}><Monitor size={18}/>Системная</button></div></div><div className="setting-group"><h3>Акцентный цвет</h3><p>Используется для кнопок и активных элементов интерфейса.</p><div className="accent-options">{accents.map(c => <button key={c.value} className={accent === c.value ? "accent-swatch selected" : "accent-swatch"} style={{"--swatch":c.value} as CSSProperties} onClick={() => setAccent(c.value)} title={c.name}/>)}</div></div><BackupPanel /><div className="settings-note"><SlidersHorizontal size={17}/> Дополнительные настройки появятся по мере развития Fox Space.</div></aside></div>}
    </div>
  );
}
