import { useState } from "react";

type Entry = {id:string;date:string;text:string;media:string[];blocked:string[]};
type Archive = {channel:string;hashtag:string;complete:boolean;posts:Entry[]};

function isEntry(item:unknown): item is Entry {
  if(!item||typeof item!=="object")return false;
  const value=item as Partial<Entry>;
  return typeof value.id==="string"&&typeof value.date==="string"&&typeof value.text==="string"
    &&Array.isArray(value.media)&&value.media.every(path=>typeof path==="string")
    &&Array.isArray(value.blocked)&&value.blocked.every(reason=>typeof reason==="string");
}

export default function ArchivePanel(){
  const [archive,setArchive]=useState<Archive|null>(null);
  const [limit,setLimit]=useState(20);
  const [error,setError]=useState("");

  async function load(file:File|undefined){
    if(!file)return;
    setError("");
    try{
      const value=JSON.parse(await file.text());
      if(value?.format!=="foxspace-boosty-archive-v1"||typeof value.channel!=="string"
        ||typeof value.hashtag!=="string"||typeof value.complete!=="boolean"
        ||!Array.isArray(value.posts)||!value.posts.every(isEntry)){
        throw Error("Выберите подготовленный реестр boosty-archive.json.");
      }
      setArchive(value);
      setLimit(20);
    }catch(error){setError(error instanceof Error?error.message:"Не удалось загрузить реестр.");}
  }
  return <div className="ops-panel">
    <header><div><h2>Архив Telegram → Boosty</h2><small>Очередь публикаций по хэштегу</small></div><a href="https://t.me/boosty_posting_bot" target="_blank" rel="noreferrer">Открыть бота Boosty</a></header>
    <p>Откройте реестр <code>boosty-archive.json</code>, чтобы проверить тексты и порядок вложений перед отправкой.</p>
    <label className="outline-button ops-media-upload">Выбрать реестр<input type="file" accept=".json,application/json" hidden onChange={event=>{void load(event.target.files?.[0]);event.target.value="";}}/></label>
    {error&&<p role="alert">{error}</p>}
    {archive&&<>
      <p><strong>{archive.channel} · {archive.hashtag}</strong> · {archive.posts.length} записей · {archive.posts.filter(item=>item.blocked.length).length} требуют проверки</p>
      {!archive.complete&&<p role="status">Подготовка архива ещё не закончена.</p>}
      {archive.posts.slice(0,limit).map(post=><article className="fox-publishing-target" key={post.id}>
        <details>
          <summary>{post.date.slice(0,10)} · {post.id} · {post.media.length} файлов</summary>
          {post.text&&<pre>{post.text}</pre>}
          {post.media.length>0&&<ol>{post.media.map((file,index)=><li key={file+index}>{file.split("/").at(-1)}</li>)}</ol>}
          {post.blocked.length>0&&<ul>{post.blocked.map((item,index)=><li key={index}>{item}</li>)}</ul>}
        </details>
      </article>)}
      {limit<archive.posts.length&&<button type="button" className="outline-button" onClick={()=>setLimit(value=>value+20)}>Показать ещё</button>}
    </>}
  </div>;
}
