import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, Inbox, Mail, RefreshCw } from "lucide-react";
import "./messages.css";
import { useVkConnection } from "../settings/vkConnection";

type Message = {
  id: number;
  conversation_message_id?: number;
  date: number;
  text: string;
  out: 0 | 1;
  attachments?: unknown[];
};
type VkConversation = {
  conversation: {
    peer: { id: number };
    unread_count?: number;
    chat_settings?: { title?: string };
  };
  last_message?: Message;
};
type Conversations = {
  count: number;
  items: VkConversation[];
  profiles?: { id: number; first_name: string; last_name: string }[];
  groups?: { id: number; name: string }[];
};
type History = { count: number; items: Message[] };
const emptyHistory: History = { count: 0, items: [] };

function dialogName(dialog: VkConversation, list: Conversations) {
  const { peer, chat_settings } = dialog.conversation;
  const profile = list.profiles?.find(person => person.id === peer.id);
  return chat_settings?.title || (profile && [profile.first_name, profile.last_name].join(" ").trim())
    || list.groups?.find(group => -group.id === peer.id)?.name || "Диалог " + peer.id;
}
function messageText(message?: Message) {
  return message?.text || (message?.attachments?.length ? "Вложение" : "Сообщение без текста");
}
function mergeHistory(items: Message[], extra: Message[]) {
  return [...new Map([...items, ...extra].map(item => [item.conversation_message_id ?? item.id, item])).values()]
    .sort((a,b) => a.date - b.date || a.id - b.id);
}

function VkThread({ peerId, name, onSent }: { peerId: number; name: string; onSent: () => void }) {
  const [history, setHistory] = useState(emptyHistory);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const sendAttempt = useRef<{ text: string; id: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);

  async function fetchHistory(offset = 0) {
    setLoading(true);
    setProblem("");
    try {
      const page = await invoke<History>("vk_history", { peerId, offset });
      setHistory(current => ({
        count: page.count,
        items: mergeHistory(offset === 0 ? [] : current.items, page.items),
      }));
      setLoaded(true);
      if (!offset) requestAnimationFrame(() => list.current?.scrollTo(0, list.current.scrollHeight));
    } catch (error) {
      setProblem(String(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void fetchHistory(); }, [peerId]);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = text.trim();
    if (!answer || sending || loading) return;
    setSending(true);
    setProblem("");
    const previous = sendAttempt.current;
    const randomId = previous?.text === answer ? previous.id
      : 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 2_147_483_646);
    sendAttempt.current = { text: answer, id: randomId };
    try {
      await invoke("vk_send", { peerId, randomId, text: answer });
      setText("");
      sendAttempt.current = null;
      onSent();
      await fetchHistory();
    } catch (error) {
      setProblem(String(error));
    } finally {
      setSending(false);
    }
  }

  return <div className="fox-messages-main vk-thread">
    <header><strong>{name}</strong><button type="button" className="outline-button" disabled={loading || sending} onClick={() => void fetchHistory()}>Обновить</button></header>
    {problem && <p role="alert" className="vk-status">{problem}</p>}
    <div ref={list} className="vk-history" aria-label="История сообщений">
      {history.items.length < history.count && <button type="button" disabled={loading || sending} onClick={() => void fetchHistory(history.items.length)}>Загрузить предыдущие</button>}
      {loading && <p role="status" className="vk-status">Загрузка переписки…</p>}
      {loaded && !history.items.length && !loading && <p className="vk-status">Переписка пуста.</p>}
      {history.items.map(message => <article className={message.out ? "vk-message outgoing" : "vk-message"} key={message.conversation_message_id ?? message.id}>
        <p>{messageText(message)}</p>
        <time dateTime={new Date(message.date * 1000).toISOString()}>{new Date(message.date * 1000).toLocaleString("ru-RU", {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</time>
      </article>)}
    </div>
    <form className="vk-reply" onSubmit={reply}>
      <textarea aria-label="Ответ ВКонтакте" placeholder="Ответить от имени сообщества" value={text} onChange={event => setText(event.target.value)} maxLength={4096} disabled={sending} />
      <button className="primary-button" disabled={!text.trim() || sending || loading}>{sending ? "Отправка…" : "Отправить"}</button>
    </form>
  </div>;
}

export default function MessagesCenter({onOpenConnections}: {onOpenConnections:()=>void}) {
  const connection = useVkConnection();
  const group = connection.status === "connected" ? connection.groupId : null;
  const [list, setList] = useState<Conversations | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const dialog = list?.items.find(item => item.conversation.peer.id === active);
  const request = useRef(0);

  async function refresh() {
    const revision = ++request.current;
    setBusy(true);
    setProblem("");
    try {
      const result = await invoke<Conversations>("vk_conversations");
      if (revision === request.current) setList(result);
    } catch (error) {
      if (revision === request.current) setProblem(String(error));
    } finally {
      if (revision === request.current) setBusy(false);
    }
  }
  useEffect(() => {
    setList(null);
    setActive(null);
    setProblem("");
    setBusy(false);
    if (group) void refresh();
    return ()=>{request.current++;};
  }, [group]);

  return <section className="fox-messages-center">
    <div className="fox-comm-heading">
      <div><h1>Сообщения</h1><p>Входящие и ответы от имени сообщества ВКонтакте.</p></div>
      <div className="vk-actions">
        {group && <>
          <button type="button" title="Обновить диалоги" aria-label="Обновить диалоги" className="outline-button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16}/></button>
          <button type="button" className="outline-button" disabled={busy} onClick={onOpenConnections}>Настройки подключения</button>
        </>}
      </div>
    </div>
    {problem && <p role="alert" className="vk-status">{problem}</p>}
    {!group ? <div className="fox-comm-panel vk-connect">
      <h2>Подключить сообщество ВКонтакте</h2>
      {connection.status === "loading" ? <p role="status">Проверяем подключение…</p>
        : connection.status === "browser" ? <p>Подключение доступно в Fox Space для Mac.</p>
        : <button className="outline-button" onClick={onOpenConnections}>Открыть настройки подключения</button>}
    </div> : <div className="fox-comm-panel fox-messages-layout">
      <aside className="fox-messages-sidebar">
        <div className="fox-messages-sidebar-title"><Mail size={17}/> Диалоги ВКонтакте</div>
        <div className="vk-dialogs">
          {list?.items.map(item => {
            const peerId = item.conversation.peer.id;
            return <button key={peerId} type="button" aria-pressed={peerId === active} onClick={() => setActive(peerId)}>
              <strong>{dialogName(item, list)}</strong>
              <small>{messageText(item.last_message)}</small>
              {!!item.conversation.unread_count && <span className="vk-unread">{item.conversation.unread_count}</span>}
            </button>;
          })}
          {!list?.items.length && <p className="vk-status">{busy ? "Загрузка диалогов…" : "Диалогов пока нет."}</p>}
        </div>
      </aside>
      {dialog && list ? <VkThread key={dialog.conversation.peer.id} peerId={dialog.conversation.peer.id} name={dialogName(dialog, list)} onSent={() => void refresh()} />
        : <div className="fox-messages-main"><div className="fox-comm-empty"><Inbox size={32}/><h2>Выберите диалог</h2></div></div>}
    </div>}
    <div className="fox-messages-connect"><ExternalLink size={16}/><a href="https://web.telegram.org/" target="_blank" rel="noreferrer">Открыть переписки в Telegram</a></div>
  </section>;
}
