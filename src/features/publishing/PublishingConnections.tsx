import { useState, type FormEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { connectDestination, destinationKey, disconnectDestination, platformNames, providerError, useDestinations, type Platform } from "./data";

const copy = {
  telegram:{label:"Канал Telegram",placeholder:"@канал или ID",token:"Токен бота",hint:"Добавьте бота в администраторы канала с правом публикации сообщений."},
  vk:{label:"Сообщество ВКонтакте",placeholder:"vk.com/сообщество или ID",token:"Пользовательский токен VK",hint:"Нужен токен с правом wall и доступ редактора или администратора сообщества."},
  boosty:{label:"Блог Boosty",placeholder:"boosty.to/имя",token:"",hint:"Добавьте адрес блога. Уровень доступа и публикация подтверждаются в официальном боте Boosty."},
};

export default function PublishingConnections(){
  const items=useDestinations();
  const [platform,setPlatform]=useState<Platform>("telegram");
  const [address,setAddress]=useState("");
  const [token,setToken]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const native=isTauri();
  const available=native||platform==="boosty";

  async function run(action:()=>Promise<void>){
    setBusy(true);
    setError("");
    try { await action(); }
    catch(error){setError(providerError(error).message);}
    finally{setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||!available)return;
    void run(async()=>{
      await connectDestination(platform,address,token);
      setAddress("");
      setToken("");
    });
  }
  return <section className="fox-setting-card">
    <h3>Мультипостинг</h3>
    {items.length>0&&<ul className="publishing-destinations">{items.map(item=><li key={destinationKey(item)}>
      <span><strong>{item.title}</strong><small>{platformNames[item.platform]}{item.platform==="boosty"?" · через бота":""}</small></span>
      <button type="button" className="outline-button" disabled={busy || (!native && item.platform!=="boosty")} aria-label={"Убрать "+item.title} onClick={()=>void run(()=>disconnectDestination(item))}>Убрать</button>
    </li>)}</ul>}
    <form onSubmit={submit} className="fox-setting-form">
      <label>Площадка для публикаций<select disabled={busy} value={platform} onChange={event=>{setPlatform(event.target.value as Platform);setAddress("");setToken("");setError("");}}>
        <option value="telegram">Telegram</option><option value="vk">ВКонтакте</option><option value="boosty">Boosty</option>
      </select></label>
      {available ? <>
        <label>{copy[platform].label}<input required disabled={busy} placeholder={copy[platform].placeholder} value={address} onChange={event=>setAddress(event.target.value)} /></label>
        {platform!=="boosty"&&<label>{copy[platform].token}<input type="password" autoComplete="off" required disabled={busy} value={token} onChange={event=>setToken(event.target.value)} /></label>}
        <small>{copy[platform].hint}</small>
        <button className="primary-button" disabled={busy}>{busy?"Проверяем…":platform==="boosty"?"Добавить блог":"Подключить площадку"}</button>
      </>:<p>Публикации в Telegram и ВКонтакте подключаются в приложении для Mac.</p>}
    </form>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
