import { useEffect, useMemo, useState } from "react";
import { Rss, Layers3, ShieldCheck, Radio, ExternalLink, RefreshCw, MessageCircle, Image as ImageIcon } from "lucide-react";

type SourceId = "telegram-bulotkaff" | "vk-btsah";
type Source = {id:SourceId;platform:"telegram"|"vk";title:string;url:string;status:string;message:string;updatedAt?:string};
type Post = {id:string;sourceId:SourceId;text:string;url:string;date?:string|null;images?:string[]};
type FeedData = {generatedAt:string|null;sources:Source[];posts:Post[]};
const defaultSources:Source[]=[
  {id:"telegram-bulotkaff",platform:"telegram",title:"Telegram · @bulotkaff",url:"https://t.me/bulotkaff",status:"pending",message:"Ожидаем первой синхронизации"},
  {id:"vk-btsah",platform:"vk",title:"ВКонтакте · btsah",url:"https://vk.ru/btsah",status:"pending",message:"Ожидаем первой синхронизации"}
];
const sourceName=(id:SourceId)=>id==="telegram-bulotkaff"?"Telegram":"ВКонтакте";
function validLink(url:string){return /^https:\/\//.test(url);}
function readableDate(date?:string|null){
  if(!date)return "Дата не указана";
  const value=new Date(date);
  return Number.isNaN(value.getTime())?"Дата не указана":value.toLocaleString("ru-RU",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
export default function FeedCenter(){
  const [feed,setFeed]=useState<FeedData>({generatedAt:null,sources:defaultSources,posts:[]});
  const [filter,setFilter]=useState<"all"|SourceId>("all");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);
    const source=import.meta.env.BASE_URL+"feed.json?v="+Date.now();
    fetch(source,{signal:controller.signal,cache:"no-store"}).then(async response=>{
      if(!response.ok)throw Error("Ошибка загрузки: HTTP "+response.status);
      return response.json() as Promise<FeedData>;
    }).then(data=>{
      if(!Array.isArray(data.sources)||!Array.isArray(data.posts))throw Error("Некорректный формат ленты");
      setFeed({generatedAt:data.generatedAt??null,sources:data.sources,posts:data.posts});
      setError("");
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Не удалось загрузить ленту");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[refresh]);
  const sources=feed.sources.length?feed.sources:defaultSources;
  const visible=useMemo(()=>feed.posts.filter(post=>filter==="all"||post.sourceId===filter),[feed.posts,filter]);
  const sourceById=(id:SourceId)=>sources.find(source=>source.id===id);
  return <section className="fox-feed-center">
    <header className="fox-comm-heading"><div><div className="eyebrow">ПУБЛИКАЦИИ</div><h1>Лента</h1><p>Два выбранных публичных источника. Здесь отображаются только действительно загруженные публикации, без демонстрационных постов.</p></div></header>
    <div className="fox-feed-layout"><div className="fox-feed-main">
      <div className="fox-feed-filter-head"><Layers3 size={16}/><span>Публикации</span><small>{feed.posts.length} получено</small><button className="fox-feed-refresh" aria-label="Обновить ленту" title="Проверить новую синхронизацию" onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={16}/></button></div>
      <div className="fox-feed-filters"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Все</button>{sources.map(source=><button key={source.id} className={filter===source.id?"active":""} onClick={()=>setFilter(source.id)}>{sourceName(source.id)}</button>)}</div>
      {loading&&<div className="fox-feed-status" role="status">Загрузка публикаций…</div>}
      {!loading&&error&&<div className="fox-feed-status" role="alert">Лента временно недоступна: {error}</div>}
      {!loading&&visible.length>0&&<div className="fox-feed-posts">{visible.map(post=><article className="fox-feed-post" key={post.id}>
        <div className="fox-feed-post-meta"><span className={"fox-feed-post-avatar "+(post.sourceId==="telegram-bulotkaff"?"telegram":"vk")}><MessageCircle size={18}/></span><div><strong>{sourceById(post.sourceId)?.title??sourceName(post.sourceId)}</strong><small>{readableDate(post.date)}</small></div><a href={post.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть оригинал"><ExternalLink size={16}/></a></div>
        {post.text&&<p className="fox-feed-post-text">{post.text}</p>}
        {!!post.images?.length&&<div className="fox-feed-gallery">{post.images.filter(validLink).map((url,i)=><a key={url+i} href={post.url} target="_blank" rel="noopener noreferrer"><img src={url} loading="lazy" alt={"Вложение "+(i+1)} onError={event=>event.currentTarget.style.display="none"}/></a>)}</div>}
        {!post.text&&!post.images?.length&&<div className="fox-feed-no-preview"><ImageIcon size={18}/> Медиа без доступного предпросмотра</div>}
        <a href={post.url} className="fox-feed-post-link" target="_blank" rel="noopener noreferrer">Смотреть оригинал <ExternalLink size={13}/></a>
      </article>)}</div>}
      {!loading&&visible.length===0&&<div className="fox-comm-empty fox-feed-empty"><Rss size={32}/><h2>Публикации пока не загружены</h2><p>Источники добавлены в Fox Space. Отображение постов зависит от доступности публичного Telegram-просмотра и официального VK API. Ты можешь открыть источники по ссылкам справа.</p></div>}
    </div><aside className="fox-feed-side"><div className="fox-feed-aside-title"><Radio size={16}/> Источники</div><div className="fox-feed-sources">{sources.map(source=><div key={source.id} className="fox-feed-source">
      <div className="fox-feed-source-title"><strong>{source.title}</strong><span className={"fox-feed-source-state "+source.status}>{source.status==="ok"?"Посты загружены":source.status==="stale"?"Старые данные":source.status==="pending"?"Ожидает загрузки":"Нет данных"}</span></div>
      <p>{source.message||"Источник добавлен"}</p><a href={source.url} target="_blank" rel="noopener noreferrer">Открыть источник <ExternalLink size={13}/></a>
    </div>)}</div>
    {feed.generatedAt&&<p className="fox-feed-last-sync">Последняя попытка синхронизации: {readableDate(feed.generatedAt)}</p>}
    <div className="fox-feed-privacy"><ShieldCheck size={16}/> Только публичный контент. Вход в Telegram/VK, чтение личных сообщений и публикация от имени аккаунта не выполняются.</div></aside></div>
  </section>;
}
