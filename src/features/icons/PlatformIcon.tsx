import { siTelegram, siVk, siYoutube, siTiktok, siGmail, siWhatsapp, siX, siInstagram, siDiscord } from "simple-icons";
import type { SimpleIcon } from "simple-icons";
import {
  Plane, Heart, Activity, Wallet, PenLine, ChartNoAxesCombined, BriefcaseBusiness,
  Clapperboard, Star, Sun, Flag, Sparkles, LayoutDashboard, BookOpen, CalendarDays,
  ListTodo, FolderOpen, FileSpreadsheet, Globe2, Camera, Music2, Users, Target,
  Layers3, Bookmark, Gift, MessageCircle, Palette, Lightbulb, Video,
  CalendarClock, PlaneTakeoff, MapPin, Compass, Luggage, Hotel, TrainFront, CarFront,
  ReceiptText, CreditCard, Landmark, BadgeDollarSign, NotebookTabs, GraduationCap,
  BookMarked, HeartHandshake, Cake, Coffee, Utensils, Dumbbell, Stethoscope,
  Pill, BedDouble, CircleUserRound, Clock3, Bell, AtSign, Mail,
  ShoppingBag, Package, Link2, FolderKanban, ListChecks, Map, type LucideIcon
} from "lucide-react";

export const PLATFORM_ICONS=[
{id:"tg",label:"TG",title:"Telegram",color:"#229ED9",icon:siTelegram},
{id:"vk",label:"VK",title:"ВКонтакте",color:"#0077FF",icon:siVk},
{id:"kwork",label:"kw",title:"Kwork",color:"#41A85F"},
{id:"avito",label:"a",title:"Авито",color:"#6554E8"},
{id:"hh",label:"hh",title:"HeadHunter",color:"#D92F38"},
{id:"youtube",label:"YT",title:"YouTube",color:"#F03B38",icon:siYoutube},
{id:"tiktok",label:"TT",title:"TikTok",color:"#17191F",icon:siTiktok},
{id:"x",label:"X",title:"X (Twitter)",color:"#181818",icon:siX},
{id:"instagram",label:"IG",title:"Instagram",color:"#D94685",icon:siInstagram},
{id:"whatsapp",label:"WA",title:"WhatsApp",color:"#25D366",icon:siWhatsapp},
{id:"gmail",label:"M",title:"Gmail",color:"#EA4335",icon:siGmail},
{id:"discord",label:"D",title:"Discord",color:"#5865F2",icon:siDiscord},
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
{id:"calendar-time",title:"Расписание",icon:CalendarClock},
{id:"departure",title:"Авиаперелёт",icon:PlaneTakeoff},
{id:"location",title:"Место",icon:MapPin},
{id:"compass",title:"Маршрут",icon:Compass},
{id:"luggage",title:"Багаж",icon:Luggage},
{id:"hotel",title:"Отель",icon:Hotel},
{id:"train",title:"Поезд",icon:TrainFront},
{id:"car",title:"Автомобиль",icon:CarFront},
{id:"receipt",title:"Счёт",icon:ReceiptText},
{id:"card",title:"Банковская карта",icon:CreditCard},
{id:"bank",title:"Банк",icon:Landmark},
{id:"income",title:"Доходы",icon:BadgeDollarSign},
{id:"notebook",title:"Блокнот",icon:NotebookTabs},
{id:"study",title:"Обучение",icon:GraduationCap},
{id:"lessons",title:"Уроки",icon:BookMarked},
{id:"couple",title:"Пара",icon:HeartHandshake},
{id:"birthday",title:"День рождения",icon:Cake},
{id:"coffee",title:"Кофе",icon:Coffee},
{id:"food",title:"Питание",icon:Utensils},
{id:"fitness",title:"Спорт",icon:Dumbbell},
{id:"doctor",title:"Врач",icon:Stethoscope},
{id:"medicine",title:"Лекарства",icon:Pill},
{id:"sleep",title:"Сон",icon:BedDouble},
{id:"profile",title:"Профиль",icon:CircleUserRound},
{id:"clock",title:"Время",icon:Clock3},
{id:"notifications",title:"Уведомления",icon:Bell},
{id:"mentions",title:"Упоминания",icon:AtSign},
{id:"email",title:"Почта",icon:Mail},
{id:"shopping",title:"Покупки",icon:ShoppingBag},
{id:"parcel",title:"Посылка",icon:Package},
{id:"links",title:"Ссылки",icon:Link2},
{id:"kanban",title:"Канбан",icon:FolderKanban},
{id:"checklist",title:"Чек-лист",icon:ListChecks},
{id:"map",title:"География",icon:Map},
];
export const DECORATIVE_ICONS=symbols.map(item=>item.id);
export default function PlatformIcon({value,size=22}:{value?:string;size?:number}){
 const platform=PLATFORM_ICONS.find(item=>item.id===value);
 if(platform)return <span className="fox-platform-icon" style={{width:size,height:size,background:platform.id==="avito"?"#fff":platform.color}} title={platform.title} role="img" aria-label={platform.title}>
   {platform.icon?<svg viewBox="0 0 24 24" width={Math.round(size*.66)} height={Math.round(size*.66)} aria-hidden="true"><path d={platform.icon.path} fill="#fff"/></svg>:platform.id==="avito"?<svg viewBox="0 0 32 32" width={Math.round(size*.76)} height={Math.round(size*.76)} aria-label="Авито" role="img"><circle cx="10" cy="10" r="6" fill="#00B4FF"/><circle cx="23" cy="10" r="4" fill="#FF5A51"/><circle cx="10" cy="23" r="4" fill="#B863F0"/><circle cx="23" cy="22" r="6" fill="#90D24B"/></svg>:<b style={{fontSize:Math.max(9,Math.round(size*.4))}}>{platform.label}</b>}
 </span>;
 const symbol=symbols.find(item=>item.id===value||item.legacy===value)??symbols.find(item=>item.id==="dashboard")!;
 const Icon=symbol.icon;
 return <span className="fox-symbol-icon" style={{width:size,height:size}} title={symbol.title} role="img" aria-label={symbol.title}><Icon size={Math.round(size*.65)} strokeWidth={1.9} aria-hidden="true"/></span>;
}
