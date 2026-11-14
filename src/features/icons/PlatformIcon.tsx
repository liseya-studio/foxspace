import { siTelegram, siVk, siYoutube, siTiktok } from "simple-icons";
import type { SimpleIcon } from "simple-icons";

export const PLATFORM_ICONS=[
{id:"tg",label:"Telegram",title:"Telegram",color:"#229ED9",icon:siTelegram},
{id:"vk",label:"VK",title:"ВКонтакте",color:"#0077FF",icon:siVk},
{id:"kwork",label:"KW",title:"Kwork",color:"#49A65A"},
{id:"avito",label:"AV",title:"Авито",color:"#6850E7"},
{id:"hh",label:"hh",title:"HeadHunter",color:"#E0282C"},
{id:"youtube",label:"YT",title:"YouTube",color:"#FF0033",icon:siYoutube},
{id:"tiktok",label:"TT",title:"TikTok",color:"#151515",icon:siTiktok},
] as {id:string;label:string;title:string;color:string;icon?:SimpleIcon}[];
export const DECORATIVE_ICONS=["✈","♡","✚","₽","✎","◫","▣","◈","★","☼","⚑","✦"];
export default function PlatformIcon({value,size=22}:{value?:string;size?:number}){
 const platform=PLATFORM_ICONS.find(item=>item.id===value);
 if(!platform)return <span className="fox-emoji-icon" style={{fontSize:size}}>{value||"◫"}</span>;
 return <span className="fox-platform-icon" style={{width:size,height:size,background:platform.color}} title={platform.title}>
   {platform.icon?<svg viewBox="0 0 24 24" width={Math.round(size*.68)} height={Math.round(size*.68)} aria-hidden="true"><path d={platform.icon.path} fill="#fff"/></svg>:<b style={{fontSize:Math.max(8,Math.round(size*.35))}}>{platform.label}</b>}
 </span>;
}
