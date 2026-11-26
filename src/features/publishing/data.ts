import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

export type Platform = "telegram" | "vk" | "boosty";
export type Destination = { platform: Platform; id: string; title: string; url: string };
export const platformNames = {telegram:"Telegram",vk:"VK",boosty:"Boosty"} as const;
export const DESTINATIONS_KEY = "fox-publishing-destinations-v1";
export const DELIVERIES_KEY = "fox-publishing-deliveries-v1";
const changed = "fox-publishing-destinations-changed";

export function destinationKey(item: Destination) { return item.platform+":"+item.id; }

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; }
  catch { return fallback; }
}
export function readDestinations() {
  const values = read<Destination[]>(DESTINATIONS_KEY, []);
  return Array.isArray(values) ? values.filter(value=>value && Object.hasOwn(platformNames,value.platform) && typeof value.id==="string" && typeof value.title==="string") : [];
}

export function useDestinations() {
  const [items,setItems] = useState(readDestinations);
  useEffect(()=>{
    const refresh=()=>setItems(readDestinations());
    window.addEventListener(changed,refresh);
    return ()=>window.removeEventListener(changed,refresh);
  },[]);
  return items;
}

function writeDestinations(items: Destination[]) {
  localStorage.setItem(DESTINATIONS_KEY,JSON.stringify(items));
  window.dispatchEvent(new Event(changed));
}

export async function connectDestination(platform: Platform, address: string, token: string) {
  let result: Destination;
  if(platform==="boosty"){
    const slug = address.trim().replace(/^https?:\/\/boosty\.to\//i,"").replace(/\/$/,"");
    if(!/^[a-z0-9_-]{1,64}$/i.test(slug)) throw Error("Укажите адрес блога в формате boosty.to/имя.");
    result={platform,id:slug.toLowerCase(),title:slug,url:"https://boosty.to/"+slug};
  }else{
    const providerAddress=address.trim().replace(platform==="telegram"?/^https?:\/\/t\.me\//i:/^https?:\/\/vk\.(?:ru|com)\//i,"").replace(/\/$/,"");
    const normalized=platform==="vk"?providerAddress.replace(/^(?:club|public)(?=\d+$)/i,""):providerAddress;
    result={...await invoke<Omit<Destination,"platform">>("publishing_connect",{platform,address:normalized,token}),platform};
  }
  writeDestinations([...readDestinations().filter(item=>destinationKey(item)!==destinationKey(result)),result]);
}

export async function disconnectDestination(item: Destination) {
  if(item.platform!=="boosty")await invoke("publishing_disconnect",{platform:item.platform,id:item.id});
  writeDestinations(readDestinations().filter(other=>destinationKey(other)!==destinationKey(item)));
}

export type Delivery = {status:"sending"|"published"|"rejected"|"uncertain";requestId:string;message?:string;url?:string};
type Deliveries = Record<string,Record<string,Delivery>>;
export function readDeliveries(postId:string):Record<string,Delivery> {
  return read<Deliveries>(DELIVERIES_KEY,{})[postId] ?? {};
}
export function recordDelivery(postId:string,target:string,delivery:Delivery){
  const all=read<Deliveries>(DELIVERIES_KEY,{});
  all[postId]={...all[postId],[target]:delivery};
  localStorage.setItem(DELIVERIES_KEY,JSON.stringify(all));
}

export function providerError(error:unknown):{message:string;uncertain:boolean} {
  if(error&&typeof error==="object"&&"message" in error&&"uncertain" in error)return {message:String(error.message),uncertain:error.uncertain!==false};
  return {message:error instanceof Error?error.message:"Fox Space не смог подтвердить результат запроса.",uncertain:true};
}
