import { useEffect, useMemo, useState } from "react";
import { Rss, Layers3, ShieldCheck, Radio, ExternalLink, RefreshCw, Image as ImageIcon, AlertCircle, Search } from "lucide-react";

type Platform = "telegram" | "vk";
type FeedSource = {id:string;platform:Platform;title:string;url:string;status:"pending"|"ok"|"stale"|"unavailable";message?:string;updatedAt?:string};
type FeedPost = {id:string;sourceId:string;text:string;url:string;date?:string|null;images?:string[]};
type FeedPayload = {generatedAt:string|null;sources:FeedSource[];posts:FeedPost[]};
const knownSources:FeedSource[]=[
  {id:"telegram-bulotkaff",platform:"telegram",title:"Telegram · @bulotkaff",url:"https://t.me/bulotkaff",status:"pending"},
  {id:"vk-btsah",platform:"vk",title:"ВКонтакте · btsah",url:"https://vk.ru/btsah",status:"pending"}
];
function validPayload(value:unknown):value is FeedPayload{
  return Boolean(value&&typeof value==="object"&&Array.isArray((value as FeedPayload).posts)&&Array.isArray((value as FeedPayload).sources));
}
export default function FeedCenter(){
  const [payload,setPayload]=useState<FeedPayload>({generatedAt:null,sources:knownSources,posts:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<"all"|Platform>("all");
  const [query,setQuery]=useState("");
  async function refresh(){
    setLoading(true);
    setError("");
    try{
      const response=await fetch(import.meta.env.BASE_URL+"feed.json",{cache:"no-store"});
      if(!response.ok)throw new Error("Сервер не вернул данные ленты.");
      const received:unknown=await response.json();
      if(!validPayload(received))throw new Error("Некорректный формат данных ленты.");
      setPayload(received);
    }catch(reason){setError(reason instanceof Error?reason.message:"Не удалось загрузить ленту.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void refresh();},[]);
  const posts=useMemo(()=>payload.posts.filter(post=>{
    const source=payload.sources.find(item=>item.id===post.sourceId);
    if(!source ||(selected!=="all"&&source.platform!==selected))return false;
    return !query.trim()||(post.text??"").toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"));
  }),[payload,selected,query]);
  const chosenSources=payload.sources.filter(item=>selected==="all"||item.platform===selected);
  const labelOf=(id:string)=>payload.sources.find(s=>s.id===id)?.title??"Публикация";
  function prettyDate(value?:string|null){
    if(!value)return "Дата недоступна";
    const date=new Date(value);
    return Number.isNaN(date.getTime())?"Дата недоступна":date.toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }
  return <section className="fox-feed-center">
    <header className="fox-comm-heading"><div><div className="eyebrow">ПУБЛИКАЦИИ</div><h1>Лента</h1><p>Публикации из добавленных публичных источников Telegram и ВКонтакте.</p></div></header>
    <div className="fox-feed-layout">
      <div className="fox-feed-main">
        <div className="fox-feed-controls"><div className="fox-feed-switch">
          <button className={selected==="all"?"active":""} onClick={()=>setSelected("all")}><Layers3 size={15}/> Все</button>
          <button className={selected==="telegram"?"active":""} onClick={()=>setSelected("telegram")}>Telegram</button>
          <button className={selected==="vk"?"active":""} onClick={()=>setSelected("vk")}>ВКонтакте</button>
        </div><button className="fox-feed-refresh" title="Обновить опубликованные данные" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
        <label className="fox-feed-search"><Search size={15}/><input placeholder="Поиск по текстам публикаций" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        {error&&<div className="fox-feed-warning" role="alert"><AlertCircle size={16}/>{error}</div>}
        {posts.length>0?<div className="fox-feed-posts">{posts.map(post=><article className="fox-feed-post" key={post.id}>
          <div className="fox-feed-post-heading"><span className="fox-feed-post-avatar">{post.sourceId.startsWith("telegram")?"TG":"VK"}</span><div><strong>{labelOf(post.sourceId)}</strong><small>{prettyDate(post.date)}</small></div><a href={post.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть оригинальную публикацию"><ExternalLink size={16}/></a></div>
          {post.text&&<p className="fox-feed-post-text">{post.text}</p>}
          {Boolean(post.images?.length)&&<div className="fox-feed-post-media">{post.images?.slice(0,6).map((url,index)=><a href={post.url} target="_blank" rel="noopener noreferrer" key={index}><img src={url} loading="lazy" alt={"Вложение "+(index+1)} onError={event=>{event.currentTarget.style.display="none";}}/></a>)}</div>}
          {!post.images?.length&&!post.text&&<div className="fox-feed-post-attachment"><ImageIcon size={17}/> Медиа-публикация: просмотреть в источнике</div>}
          <a className="fox-feed-post-original" href={post.url} target="_blank" rel="noopener noreferrer">Открыть публикацию <ExternalLink size={13}/></a>
        </article>)}</div>:<div className="fox-comm-empty fox-feed-empty"><Rss size={32}/><h2>{loading?"Загружаем публикации":"Публикаций пока нет"}</h2><p>{loading?"Читаем доступные данные источников.":query?"По этому запросу публикаций нет.":"Источники добавлены, но реальные посты ещё не удалось получить. Проверьте статус справа и откройте публикации на оригинальных площадках."}</p></div>}
        <div className="fox-feed-bottom">Данные обновляются при синхронизации. Последняя попытка: {prettyDate(payload.generatedAt)}.</div>
      </div>
      <aside className="fox-feed-side"><div className="fox-feed-aside-title"><Radio size={16}/> Источники <span>{payload.sources.length}</span></div>
        <div className="fox-feed-sources">{payload.sources.map(source=><div className="fox-feed-source" key={source.id}>
          <div className="fox-feed-source-heading"><span className={"fox-feed-platform "+source.platform}>{source.platform==="telegram"?"TG":"VK"}</span><div><strong>{source.title}</strong><small>{source.platform==="telegram"?"Публичный канал":"Публичное сообщество"}</small></div></div>
          <p>{source.status==="ok"?"Посты загружены":source.status==="stale"?"Сохранённые посты; обновление не удалось":source.status==="pending"?"Ожидает первой синхронизации":"Публикации недоступны"}</p>
          {(source.status!=="ok")&&source.message&&<small className="fox-feed-source-error">{source.message}</small>}
          <a href={source.url} target="_blank" rel="noopener noreferrer">Открыть источник <ExternalLink size={13}/></a>
        </div>)}</div>
        <div className="fox-feed-privacy"><ShieldCheck size={16}/> Источники добавлены как публичные ссылки. Вход в личные аккаунты не выполнялся; приватные публикации недоступны.</div>
      </aside>
    </div>
  </section>;
}
