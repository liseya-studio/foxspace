import { useState, type FormEvent } from "react";
import { feedSources, setFeedSourceVisible, useHiddenFeedSources } from "../feed/sources";
import { ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import PublishingConnections from "../publishing/PublishingConnections";
import "../publishing/publishing.css";
import { connectVk, disconnectVk, useVkConnection } from "./vkConnection";

export default function ConnectionSettings({onOpenFeed,onOpenAgents}: {onOpenFeed:()=>void;onOpenAgents:()=>void}) {
  const vk = useVkConnection();
  const hiddenSources = useHiddenFeedSources();
  const [id, setId] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await action();
      setStatus(success);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const groupId = Number(id.trim());
    if (!Number.isSafeInteger(groupId) || groupId < 1) {
      setError("Введите числовой ID сообщества.");
      return;
    }
    void perform(async () => {
      await connectVk(groupId, token.trim());
      setToken("");
    }, "Сообщество подключено.");
  }

  return <>
    <PublishingConnections/>
    <section className="fox-setting-card">
      <h3>Сообщения ВКонтакте</h3>
      <p>Диалоги сообщества и ответы от его имени.</p>
      {vk.status === "browser" && <p>Подключение доступно в Fox Space для Mac.</p>}
      {vk.status === "loading" && <p role="status">Проверяем сохранённое подключение…</p>}
      {vk.status === "error" && <p role="alert">{vk.message}</p>}
      {vk.status === "connected" && <>
        <p>Подключено сообщество № {vk.groupId}</p>
        <div className="fox-setting-actions">
          <button type="button" className="outline-button" disabled={busy} onClick={() => void perform(async()=>{await invoke("vk_conversations");}, "ВКонтакте подтвердил доступ к сообщениям.")}>Проверить доступ</button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void perform(disconnectVk, "Сообщество отключено.")}>Отключить</button>
        </div>
      </>}
      {vk.status === "disconnected" && <form onSubmit={connect} className="fox-setting-form">
        <label>Числовой ID сообщества<input required inputMode="numeric" pattern="[0-9]+" value={id} onChange={e=>setId(e.target.value)} /></label>
        <label>Ключ доступа к сообщениям<input required type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} /></label>
        <small>Ключ сохраняется в macOS Keychain.</small>
        <button className="primary-button" disabled={busy || !token.trim()}>{busy ? "Проверяем…" : "Подключить ВКонтакте"}</button>
      </form>}
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
    <section className="fox-setting-card">
      <h3>Публичная лента</h3>
      <fieldset className="fox-feed-source-options"><legend>Показывать публикации</legend>
        {feedSources.map(source=><label key={source.id}><input type="checkbox" checked={!hiddenSources.includes(source.id)} onChange={e=>setFeedSourceVisible(source.id,e.target.checked)} />{source.title}</label>)}
      </fieldset>
      <div className="fox-setting-actions">
        <button type="button" className="outline-button" onClick={onOpenFeed}>Открыть источники</button>
        <a href="https://web.telegram.org/" target="_blank" rel="noreferrer">Чаты в Telegram <ExternalLink size={13}/></a>
      </div>
    </section>
    <section className="fox-setting-card">
      <h3>Агенты ChatGPT</h3>
      <p>Локальный MCP читает данные по разрешениям выбранного профиля.</p>
      <button type="button" className="outline-button" onClick={onOpenAgents}>Управлять доступом</button>
    </section>
  </>;
}
