import { useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Publication } from "../operations/data";
import { selectedPublicationAudience } from "../operations/content/model";
import { flushPersistentStorage } from "../storage/persistence";
import { destinationKey, platformNames, providerError, readDeliveries, recordDelivery, useDestinations, type Delivery, type Destination } from "./data";
import "./publishing.css";

type Props = { post: Publication; saveDraft:()=>boolean; onOpenConnections:()=>void };

export default function PublishPanel({post,saveDraft,onOpenConnections}:Props){
  const destinations = useDestinations();
  const [selected,setSelected] = useState<string[]>([]);
  const [choices,setChoices] = useState<Record<string,string>>({});
  const [deliveries,setDeliveries] = useState(()=>readDeliveries(post.id));
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [plainText,setPlainText] = useState(false);
  const [boostyLinks,setBoostyLinks] = useState<Record<string,string>>({});
  const sending = useRef(false);
  const native = isTauri();
  const hasMedia = Boolean(post.mediaFileIds?.length);

  function variants(target:Destination){
    return post.variants.filter(item=>item.platform===platformNames[target.platform] && item.text.trim());
  }
  function chosenVariant(target:Destination){
    const versions=variants(target);
    const choice=choices[destinationKey(target)];
    if(choice==="base")return undefined;
    return versions.find(item=>item.id===choice)??(versions.length===1?versions[0]:undefined);
  }
  function body(target:Destination){
    const version=chosenVariant(target);
    if(version)return version.text.trim();
    if(choices[destinationKey(target)]==="base"||variants(target).length===0)return post.text.trim();
    return "";
  }
  function restricted(target:Destination){
    return selectedPublicationAudience(post,chosenVariant(target))==="restricted";
  }
  function saveResult(target:string,result:Delivery){
    recordDelivery(post.id,target,result);
    setDeliveries(readDeliveries(post.id));
  }

  async function publish(){
    if(sending.current)return;
    setError("");
    setMessage("");
    const latest=readDeliveries(post.id);
    const targets=destinations.filter(item=>item.platform!=="boosty"&&selected.includes(destinationKey(item))
      && (!latest[destinationKey(item)]||latest[destinationKey(item)].status==="rejected"));
    if(!native || !targets.length)return;
    if(targets.some(restricted)){
      setError("Выберите открытую версию для Telegram или VK. Версии с ограниченным доступом можно подготовить для Boosty.");
      return;
    }
    if(hasMedia&&!plainText){setError("Выберите отправку только текста. Прикреплённые файлы останутся в черновике.");return;}
    if(targets.some(target=>!body(target)||Array.from(body(target)).length>4096)){
      setError("Для каждой площадки выберите версию текста длиной от 1 до 4096 символов.");
      return;
    }
    if(!post.title.trim()){ setError("Сначала заполните название публикации."); return; }
    if(!window.confirm("Публикуем сейчас?\n"+targets.map(item=>platformNames[item.platform]+" — "+item.title).join("\n")+(hasMedia?"\nБудет отправлен только текст.":"")))return;
    sending.current=true;
    setBusy(true);
    try {
      if(!saveDraft())return;
      for(const target of targets){
        const key=destinationKey(target);
        const previous=readDeliveries(post.id)[key];
        if(previous && previous.status!=="rejected")continue;
        const requestId=crypto.randomUUID();
        saveResult(key,{status:"sending",requestId});
        try {
          await flushPersistentStorage();
        }catch{
          saveResult(key,{status:"rejected",requestId,message:"Черновик не удалось записать на Mac. Отправка не началась."});
          break;
        }
        let delivery:Delivery;
        try {
          const result=await invoke<{url:string}>("publish_text",{platform:target.platform,id:target.id,message:body(target),requestId});
          delivery={status:"published",requestId,url:result.url};
        }catch(error){
          const failure=providerError(error);
          delivery={status:failure.uncertain?"uncertain":"rejected",requestId,message:failure.message};
        }
        saveResult(key,delivery);
        await flushPersistentStorage();
      }
    }catch{setError("Не удалось записать результат. Проверьте выбранные площадки перед повторной отправкой.");}
    finally{sending.current=false;setBusy(false);}
  }

  async function copyBoosty(target:Destination){
    const content=body(target);
    if(!content){setError("Выберите версию текста для Boosty.");return;}
    try {
      await navigator.clipboard.writeText(content);
      setError("");
      setMessage("Текст скопирован. Отправьте его боту Boosty и выберите уровень доступа.");
    }catch{setError("Не удалось скопировать текст. Выделите его в предпросмотре.");}
  }

  function publishedUrl(delivery:Delivery|undefined){
    if(delivery?.status!=="published" || !delivery.url)return "";
    try {
      const url=new URL(delivery.url);
      return ["https://t.me","https://vk.com","https://boosty.to"].includes(url.origin)?url.href:"";
    }catch{return "";}
  }

  function confirmBoosty(target:Destination){
    const key=destinationKey(target);
    let url:URL;
    try {
      url=new URL(boostyLinks[key]??"");
      const [slug,section,id]=url.pathname.split("/").filter(Boolean);
      if(url.origin!=="https://boosty.to"||slug?.toLowerCase()!==target.id||section!=="posts"||!id)throw Error();
    }catch{setError("Вставьте ссылку на опубликованный пост в этом блоге Boosty.");return;}
    if(!post.title.trim()){setError("Сначала заполните название публикации.");return;}
    if(!saveDraft())return;
    saveResult(key,{status:"published",requestId:crypto.randomUUID(),url:url.href});
    setError("");
  }

  return <section className="fox-publishing">
    <h3>Мультипостинг</h3>
    {!destinations.length&&<p>Добавьте каналы, сообщества и блог для публикаций.</p>}
    <button type="button" className="outline-button" disabled={busy} onClick={onOpenConnections}>Настроить площадки</button>
    {destinations.map(target=>{
      const key=destinationKey(target);
      const delivery=deliveries[key];
      const versions=variants(target);
      const sendable=target.platform!=="boosty" && (!delivery || delivery.status==="rejected");
      const uncertain=delivery?.status==="uncertain"||delivery?.status==="sending";
      return <div key={key} className="fox-publishing-target">
        <strong>{platformNames[target.platform]} · {target.title}</strong>
        {versions.length>0 && !delivery?.url && <label>Версия текста<select disabled={busy} value={choices[key]??(versions.length===1?versions[0].id:"")} onChange={event=>setChoices(old=>({...old,[key]:event.target.value}))}>
          <option value="" disabled>Выберите вариант</option>
          <option value="base">Исходный текст</option>
          {versions.map((version,index)=><option key={version.id} value={version.id}>Версия {index+1} · {version.text.trim().slice(0,35)}</option>)}
        </select></label>}
        {!delivery?.url&&body(target)&&<details><summary>Предпросмотр текста</summary><pre>{body(target)}</pre></details>}
        {target.platform!=="boosty"&&restricted(target)&&<p>Ограниченный доступ. Для отправки выберите открытую версию.</p>}
        {sendable&&native&&<label className="fox-publishing-check"><input type="checkbox" disabled={busy} checked={selected.includes(key)} onChange={event=>setSelected(old=>event.target.checked?[...old,key]:old.filter(value=>value!==key))}/> Опубликовать в {target.title}</label>}
        {target.platform==="boosty"&&!delivery?.url&&<>
          {restricted(target)&&<p>Уровень для Boosty: {(chosenVariant(target)?.tier??post.tier)?.trim()||"По подписке"}.</p>}
          <div className="fox-setting-actions"><button type="button" className="outline-button" onClick={()=>void copyBoosty(target)}>Копировать текст</button><a href="https://t.me/boosty_posting_bot" target="_blank" rel="noreferrer">Открыть бота Boosty</a></div>
          <label>Ссылка на опубликованный пост<input value={boostyLinks[key]??""} placeholder={target.url+"/posts/…"} onChange={e=>setBoostyLinks(old=>({...old,[key]:e.target.value}))} /></label>
          <button type="button" className="outline-button" onClick={()=>confirmBoosty(target)}>Отметить публикацию</button>
        </>}
        {publishedUrl(delivery)&&<a href={publishedUrl(delivery)} target="_blank" rel="noreferrer">Открыть опубликованный пост</a>}
        {delivery?.status==="rejected"&&<p role="alert">{delivery.message}</p>}
        {uncertain&&(!busy?<><p role="status">{delivery?.message??"Результат отправки неизвестен. Проверьте площадку."}</p><button type="button" className="outline-button" onClick={()=>{
          if(window.confirm("Вы проверили площадку и поста там нет?"))saveResult(key,{status:"rejected",requestId:delivery!.requestId,message:"Можно отправить снова."});
        }}>Поста на площадке нет</button></>:<p role="status">Отправляем…</p>)}
      </div>;
    })}
    {native&&selected.some(key=>destinations.some(item=>item.platform!=="boosty"&&destinationKey(item)===key)&&(!deliveries[key]||deliveries[key].status==="rejected"))&&<>
      {hasMedia&&<label className="fox-publishing-check"><input disabled={busy} type="checkbox" checked={plainText} onChange={event=>setPlainText(event.target.checked)}/> Отправить только текст, без вложений</label>}
      <button type="button" className="primary-button" disabled={busy} onClick={()=>void publish()}>{busy?"Отправляем…":"Опубликовать выбранное сейчас"}</button>
    </>}
    {message&&<p role="status">{message}</p>}
    {error&&<p role="alert">{error}</p>}
  </section>;
}
