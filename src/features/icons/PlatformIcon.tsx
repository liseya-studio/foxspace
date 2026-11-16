import { siTelegram, siVk, siYoutube, siTiktok } from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import {
  Plane, Heart, Activity, Wallet, PenLine, ChartNoAxesCombined, BriefcaseBusiness,
  Clapperboard, Star, Sun, Flag, Sparkles, LayoutDashboard, BookOpen, CalendarDays,
  ListTodo, FolderOpen, FileSpreadsheet, Globe2, Camera, Music2, Users, Target,
  Layers3, Bookmark, Gift, MessageCircle, Palette, Lightbulb, Video, type LucideIcon
} from "lucide-react";

export const PLATFORM_ICONS=[
{id:"tg",label:"TG",title:"Telegram",color:"#229ED9",icon:siTelegram},
{id:"vk",label:"VK",title:"ВКонтакте",color:"#0077FF",icon:siVk},
{id:"kwork",label:"kw",title:"Kwork",color:"#41A85F"},
{id:"avito",label:"a",title:"Авито",color:"#6554E8"},
{id:"hh",label:"hh",title:"HeadHunter",color:"#D92F38"},
{id:"youtube",label:"YT",title:"YouTube",color:"#F03B38",icon:siYoutube},
{id:"tiktok",label:"TT",title:"TikTok",color:"#17191F",icon:siTiktok},
] as {id:string;label:string;title:string;color:string;icon?:SimpleIcon}[];

/** Uniform 24px outline symbols. Legacy glyphs stay resolvable for saved screens. */
const symbols:{id:string;title:string;icon:LucideIcon;legacy?:string}[]=[
{id:"travel",title:"Путешествия",icon:Plane,legacy:"✈"},
{id:"heart",title:"Отношения",icon:Heart,legacy:"♡"},
{id:"health",title:"Здоровье",icon:Activity,legacy:"✚"},
{id:"finance",title:"Финансы",icon:Wallet,legacy:"₽"},
{id:"writing",title:"Творчество",icon:PenLine,legacy:"✎"},
{id:"statistics",title:"Статистика",icon:ChartNoAxesCombined,legacy:"◫"},
{id:"work",title:"Работа",icon:BriefcaseBusiness,legacy:"▣"},
{id:"media",title:"Медиатека",icon:Clapperboard,legacy:"◈"},
{id:"star",title:"Избранное",icon:Star,legacy:"★"},
{id:"sun",title:"Личное",icon:Sun,legacy:"☼"},
{id:"flag",title:"Цели",icon:Flag,legacy:"⚑"},
{id:"sparkles",title:"Идеи",icon:Sparkles,legacy:"✦"},
{id:"dashboard",title:"Экран",icon:LayoutDashboard},
{id:"books",title:"Книги",icon:BookOpen},
{id:"calendar",title:"Календарь",icon:CalendarDays},
{id:"tasks",title:"Задачи",icon:ListTodo},
{id:"files",title:"Файлы",icon:FolderOpen},
{id:"tables",title:"Таблицы",icon:FileSpreadsheet},
{id:"world",title:"Карта",icon:Globe2},
{id:"photos",title:"Фотографии",icon:Camera},
{id:"music",title:"Музыка",icon:Music2},
{id:"people",title:"Люди",icon:Users},
{id:"target",title:"Прогресс",icon:Target},
{id:"layers",title:"Проекты",icon:Layers3},
{id:"bookmark",title:"Закладки",icon:Bookmark},
{id:"gift",title:"Подарки",icon:Gift},
{id:"chat",title:"Сообщения",icon:MessageCircle},
{id:"palette",title:"Дизайн",icon:Palette},
{id:"lightbulb",title:"Заметки",icon:Lightbulb},
{id:"video",title:"Видео",icon:Video},
];
export const DECORATIVE_ICONS=symbols.map(item=>item.id);
export default function PlatformIcon({value,size=22}:{value?:string;size?:number}){
 const platform=PLATFORM_ICONS.find(item=>item.id===value);
 if(platform)return <span className="fox-platform-icon" style={{width:size,height:size,background:platform.color}} title={platform.title} role="img" aria-label={platform.title}>
   {platform.icon?<svg viewBox="0 0 24 24" width={Math.round(size*.66)} height={Math.round(size*.66)} aria-hidden="true"><path d={platform.icon.path} fill="#fff"/></svg>:<b style={{fontSize:Math.max(9,Math.round(size*.4))}}>{platform.label}</b>}
 </span>;
 const symbol=symbols.find(item=>item.id===value||item.legacy===value)??symbols.find(item=>item.id==="dashboard")!;
 const Icon=symbol.icon;
 return <span className="fox-symbol-icon" style={{width:size,height:size}} title={symbol.title} role="img" aria-label={symbol.title}><Icon size={Math.round(size*.65)} strokeWidth={1.9} aria-hidden="true"/></span>;
}
