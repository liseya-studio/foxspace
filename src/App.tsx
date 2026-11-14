import { useEffect, useMemo, useState, type CSSProperties } from "react";
import TableWorkspace from "./features/tables/TableWorkspace";
import {
  Bell, Mail, Search, Plus, ChevronDown, MoreHorizontal, Settings,
  FileSpreadsheet, StickyNote, CheckSquare, LayoutDashboard, X, Sun,
  Moon, Monitor, Palette, PanelRightClose, Command, ArrowUpRight,
  CircleHelp, CalendarDays, Folder, Sparkles, SlidersHorizontal
} from "lucide-react";

type Screen = { id: string; name: string; tableId?: string };
type Section = "home" | "files" | "notes" | string;

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
  const [tableRevision, setTableRevision] = useState(0);

  useEffect(() => { localStorage.setItem("fox-screens", JSON.stringify(screens)); }, [screens]);
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

  const activeScreen = screens.find(s => s.id === active);
  const filteredScreens = useMemo(() => screens.filter(s => s.name.toLowerCase().includes(search.toLowerCase())), [screens, search]);

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
          <button className="profile-avatar" aria-label="Профиль">L</button>
          <span className="workspace-name">Личное пространство</span>
          <ChevronDown size={14} className="muted-icon" />
        </div>
        <div className="top-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={16}/><span>Поиск</span><kbd>⌘ K</kbd></button>
          <button className="icon-button" title="Уведомления"><Bell size={18}/><i className="notification-dot"/></button>
          <button className="icon-button" title="Сообщения"><Mail size={18}/></button>
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
        ) : active === "files" ? (
          <TableWorkspace />
        ) : active === "notes" ? (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div><h1>Заметки и задачи</h1><p>Идеи, планы и текущие дела.</p></div><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={17}/> Создать</button></div>
            <div className="empty-panel"><div className="empty-icon"><StickyNote size={25}/></div><h2>Пока нет записей</h2><p>Здесь будут заметки, задачи и связанные с ними представления.</p><button className="primary-button" onClick={() => setCreateOpen(true)}><Plus size={16}/> Создать заметку</button></div>
          </section>
        ) : (
          <section className="content-page">
            <div className="page-heading"><div><div className="eyebrow">МОЙ ЭКРАН</div><h1>{activeScreen?.name ?? "Экран"}</h1><p>Добавляйте таблицы и виджеты, чтобы собрать нужное представление.</p></div><button className="outline-button" onClick={() => setCreateOpen(true)}><Plus size={16}/> Добавить</button></div>
            <div className="screen-table-panel"><h2>Источник данных</h2><p>Подключите таблицу к этому экрану. Изменения в таблице будут доступны в разделе «Файлы и таблицы».</p><select className="form-input" value={activeScreen?.tableId??""} onChange={e=>setScreens(prev=>prev.map(s=>s.id===active?{...s,tableId:e.target.value||undefined}:s))}><option value="">Без таблицы</option>{read<{id:string;name:string}[]>("fox-tables-v1",[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{activeScreen?.tableId && <div className="screen-table-attached"><FileSpreadsheet size={20}/><span>Таблица подключена. Откройте редактор, чтобы изменить данные.</span><button className="outline-button" onClick={()=>setActive("files")}>Открыть таблицы</button></div>}</div>
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
              <button className="screen-more" title="Действия" onClick={() => { setRenameId(screen.id); setRenameValue(screen.name); }}><MoreHorizontal size={15}/></button>
            </div>
          ))}
        </div>
        <button className="dock-add" onClick={() => setCreateOpen(true)} title="Добавить экран"><Plus size={20}/></button>
      </nav>

      {createOpen && <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setCreateOpen(false)}><div className="dialog"><button className="close-button" onClick={() => setCreateOpen(false)}><X size={18}/></button><div className="dialog-icon"><LayoutDashboard size={21}/></div><h2>Новый экран</h2><p>Создайте отдельное пространство для нужной темы или проекта.</p><button className="primary-button full" onClick={addScreen}><Plus size={16}/> Создать пустой экран</button><button className="text-button" onClick={() => setCreateOpen(false)}>Отмена</button></div></div>}

      {searchOpen && <div className="overlay search-overlay" onMouseDown={e => e.target === e.currentTarget && setSearchOpen(false)}><div className="search-dialog"><div className="search-line"><Search size={19}/><input autoFocus placeholder="Поиск по экранам..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>ESC</kbd><button className="close-button" onClick={() => setSearchOpen(false)}><X size={17}/></button></div><div className="search-results"><button onClick={() => {setActive("home");setSearchOpen(false);}}><LayoutDashboard size={17}/>Главная</button><button onClick={() => {setActive("files");setSearchOpen(false);}}><FileSpreadsheet size={17}/>Файлы и таблицы</button><button onClick={() => {setActive("notes");setSearchOpen(false);}}><StickyNote size={17}/>Заметки и задачи</button>{filteredScreens.map(s => <button key={s.id} onClick={() => {setActive(s.id);setSearchOpen(false);}}><LayoutDashboard size={17}/>{s.name}</button>)}</div></div></div>}

      {settingsOpen && <div className="overlay settings-overlay" onMouseDown={e => e.target === e.currentTarget && setSettingsOpen(false)}><aside className="settings-panel"><div className="settings-head"><div><div className="eyebrow">ПЕРСОНАЛИЗАЦИЯ</div><h2>Настройки</h2></div><button className="close-button" onClick={() => setSettingsOpen(false)}><X size={18}/></button></div><div className="setting-group"><h3>Тема оформления</h3><div className="theme-options"><button className={theme === "light" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("light")}><Sun size={18}/>Светлая</button><button className={theme === "dark" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("dark")}><Moon size={18}/>Тёмная</button><button className={theme === "system" ? "theme-option selected" : "theme-option"} onClick={() => setTheme("system")}><Monitor size={18}/>Системная</button></div></div><div className="setting-group"><h3>Акцентный цвет</h3><p>Используется для кнопок и активных элементов интерфейса.</p><div className="accent-options">{accents.map(c => <button key={c.value} className={accent === c.value ? "accent-swatch selected" : "accent-swatch"} style={{"--swatch":c.value} as CSSProperties} onClick={() => setAccent(c.value)} title={c.name}/>)}</div></div><div className="settings-note"><SlidersHorizontal size={17}/> Дополнительные настройки появятся по мере развития Fox Space.</div></aside></div>}
    </div>
  );
}
