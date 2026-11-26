import type { CSSProperties } from "react";
import { Activity, ArrowLeft, Bell, ChevronRight, Clock3, Cloud, Database, FileDown, Folder, Globe, Layers3, LayoutGrid, Link2, Mail, Monitor, Moon, Paintbrush, Palette, Plus, Settings, ShieldCheck, Sun, UserRound, type LucideIcon } from "lucide-react";
import BackupPanel from "../backup/BackupPanel";
import ConnectionSettings from "./ConnectionSettings";
import { AutoLaunchSettings, ReminderSettings } from "./DesktopSettings";
import "./settings.css";

export type SettingsSection = "profile" | "appearance" | "connections" | "notifications" | "data" | "security" | "locale" | "spaces";
type Page = {id:string;name:string};
type Destination = "feed" | "agents" | "files" | "notifications" | "messages" | "automations";
type Row = {label:string;icon:LucideIcon;section?:SettingsSection;destination?:Destination};
type Category = {id:SettingsSection; title:string; description:string; icon:LucideIcon; tone:string; rows:Row[]};

const categories:Category[] = [
  {id:"profile",title:"Профиль и аккаунты",description:"Имя и подключённые площадки.",icon:UserRound,tone:"orange",rows:[
    {label:"Основная информация",icon:UserRound},{label:"Подключённые аккаунты",icon:Link2,section:"connections"}]},
  {id:"appearance",title:"Внешний вид",description:"Тема и цвета интерфейса.",icon:Paintbrush,tone:"amber",rows:[
    {label:"Светлая и тёмная темы",icon:Sun},{label:"Акцентный цвет",icon:Palette},{label:"Запуск на Mac",icon:Monitor}]},
  {id:"connections",title:"Подключения",description:"Каналы, сообщества и сервисы.",icon:Link2,tone:"blue",rows:[
    {label:"Telegram, Boosty и ВКонтакте",icon:Link2},{label:"Сообщения ВКонтакте",icon:Mail},{label:"Источники ленты",icon:Activity,destination:"feed"},{label:"Агенты ChatGPT",icon:ShieldCheck,destination:"agents"}]},
  {id:"notifications",title:"Уведомления",description:"События приложения и напоминания.",icon:Bell,tone:"pink",rows:[
    {label:"Внутри приложения",icon:Bell,destination:"notifications"},{label:"Системные напоминания",icon:Monitor},{label:"Автоматизации",icon:Clock3,destination:"automations"}]},
  {id:"data",title:"Данные и синхронизация",description:"Резервные копии и хранение файлов.",icon:Database,tone:"purple",rows:[
    {label:"Резервное копирование",icon:Cloud},{label:"Импорт и экспорт данных",icon:FileDown},{label:"Локальные файлы",icon:Folder,destination:"files"}]},
  {id:"security",title:"Безопасность",description:"Разрешения агентов и журнал действий.",icon:ShieldCheck,tone:"green",rows:[
    {label:"Доступ к данным",icon:ShieldCheck,destination:"agents"},{label:"Журнал действий",icon:Activity,destination:"agents"}]},
  {id:"locale",title:"Язык и регион",description:"Язык приложения и системный часовой пояс.",icon:Globe,tone:"blue",rows:[
    {label:"Язык приложения",icon:Globe},{label:"Часовой пояс",icon:Clock3}]},
  {id:"spaces",title:"Пространства",description:"Рабочие экраны и дашборды.",icon:Layers3,tone:"orange",rows:[
    {label:"Доступные экраны",icon:LayoutGrid},{label:"Создать экран",icon:Plus}]},
];
const themes = [{id:"light",name:"Светлая",icon:Sun},{id:"dark",name:"Тёмная",icon:Moon},{id:"system",name:"Системная",icon:Monitor}];
type Props = {
  section: SettingsSection | null;
  onSection:(section:SettingsSection|null)=>void;
  onNavigate:(destination:Destination)=>void;
  onClose:()=>void;
  theme:string;
  onTheme:(theme:string)=>void;
  accent:string;
  accents:{name:string;value:string}[];
  onAccent:(color:string)=>void;
  name:string;
  onName:(name:string)=>void;
  pages:Page[];
  onOpenPage:(id:string)=>void;
  onCreatePage:()=>void;
};

export default function SettingsPage(props:Props){
  const {section,onSection,onNavigate,onClose}=props;
  const current=categories.find(category=>category.id===section);
  const Icon=current?.icon??Settings;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  return <section className="fox-settings-page">
    <header className="fox-settings-heading">
      <div className={"fox-settings-icon "+(current?.tone??"orange")}><Icon size={30} strokeWidth={1.8}/></div>
      <div>{current&&<button type="button" className="fox-settings-back" onClick={()=>onSection(null)}><ArrowLeft size={15}/> Все настройки</button>}
        <h1>{current?.title??"Настройки"}</h1><p>{current?.description??"Настрой своё пространство под себя."}</p>
      </div>
      <button type="button" className="outline-button fox-settings-close" onClick={onClose}>Закрыть настройки</button>
    </header>
    {!current?<div className="fox-settings-grid">
      {categories.map(category=><article key={category.id} className="fox-settings-category">
        <button type="button" className="fox-settings-category-heading" aria-label={category.title} onClick={()=>onSection(category.id)}>
          <span className={"fox-settings-icon "+category.tone}><category.icon size={30} strokeWidth={1.8}/></span>
          <span><strong>{category.title}</strong><small>{category.description}</small></span>
          <ChevronRight size={16}/>
        </button>
        <ul>{category.rows.map(row=><li key={row.label}><button type="button" onClick={()=>row.destination?onNavigate(row.destination):onSection(row.section??category.id)}>
          <row.icon size={17}/><span>{row.label}</span>
        </button></li>)}</ul>
      </article>)}
    </div>:<div className="fox-settings-detail">
      {section==="profile"&&<section className="fox-setting-card"><h3>Основная информация</h3><label>Имя в Fox Space<input value={props.name} maxLength={60} onChange={event=>props.onName(event.target.value)} /></label><div className="fox-setting-actions"><button type="button" className="outline-button" onClick={()=>onSection("connections")}>Подключённые аккаунты</button></div></section>}
      {section==="appearance"&&<>
        <section className="fox-setting-card"><h3>Тема оформления</h3><div className="theme-options">{themes.map(theme=><button type="button" key={theme.id} aria-pressed={props.theme===theme.id} className={"theme-option"+(props.theme===theme.id?" selected":"")} onClick={()=>props.onTheme(theme.id)}><theme.icon size={18}/>{theme.name}</button>)}</div></section>
        <section className="fox-setting-card"><h3>Акцентный цвет</h3><div className="accent-options">{props.accents.map(color=><button type="button" key={color.value} aria-pressed={props.accent===color.value} aria-label={color.name} className={"accent-swatch"+(props.accent===color.value?" selected":"")} style={{"--swatch":color.value} as CSSProperties} onClick={()=>props.onAccent(color.value)} title={color.name}/>)}</div></section>
        <AutoLaunchSettings/>
      </>}
      {section==="connections"&&<ConnectionSettings onOpenFeed={()=>onNavigate("feed")} onOpenAgents={()=>onNavigate("agents")}/>}
      {section==="notifications"&&<><ReminderSettings/><div className="fox-setting-actions"><button type="button" className="outline-button" onClick={()=>onNavigate("notifications")}>Открыть уведомления</button><button type="button" className="outline-button" onClick={()=>onNavigate("automations")}>Настроить автоматизации</button></div></>}
      {section==="data"&&<BackupPanel/>}
      {section==="security"&&<section className="fox-setting-card"><h3>Доступ к рабочим данным</h3><p>Разрешения MCP задаются для каждого профиля. Ключи подключений хранятся в macOS Keychain.</p><button type="button" className="outline-button" onClick={()=>onNavigate("agents")}>Профили и журнал действий</button></section>}
      {section==="locale"&&<section className="fox-setting-card"><h3>Текущий региональный формат</h3><dl className="fox-settings-facts"><dt>Язык приложения</dt><dd>Русский</dd><dt>Часовой пояс устройства</dt><dd>{zone}</dd><dt>Дата и время</dt><dd>{new Date().toLocaleString("ru-RU")}</dd><dt>Валюта финансов</dt><dd>Российский рубль (₽)</dd></dl></section>}
      {section==="spaces"&&<section className="fox-setting-card"><h3>Доступные экраны</h3>{props.pages.length?<ul className="fox-settings-page-list">{props.pages.map(page=><li key={page.id}><button type="button" className="outline-button" onClick={()=>props.onOpenPage(page.id)}>{page.name}</button></li>)}</ul>:<p>Создай экран, чтобы добавить первый дашборд.</p>}<button type="button" className="primary-button" onClick={props.onCreatePage}>Создать экран</button></section>}
    </div>}
  </section>;
}
