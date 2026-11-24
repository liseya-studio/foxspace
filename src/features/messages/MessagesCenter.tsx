import { useEffect, useRef, useState, type FormEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ExternalLink, Inbox, Mail, RefreshCw } from "lucide-react";
import "./messages.css";

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

export default function MessagesCenter() {
  const [group, setGroup] = useState<number | null>(null);
  const [groupInput, setGroupInput] = useState("");
  const [token, setToken] = useState("");
  const [list, setList] = useState<Conversations | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(!isTauri());
  const [problem, setProblem] = useState("");
  const dialog = list?.items.find(item => item.conversation.peer.id === active);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    invoke<number | null>("vk_connection").then(id => {
      if (!cancelled) setGroup(id);
    }).catch(error => {
      if (!cancelled) setProblem(String(error));
    }).finally(() => {
      if (!cancelled) setStatusLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    setBusy(true);
    setProblem("");
    try {
      setList(await invoke<Conversations>("vk_conversations"));
    } catch (error) {
      setProblem(String(error));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (group && !list) void refresh();
  }, [group]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d+$/.test(groupInput) || !token.trim()) return;
    setBusy(true);
    setProblem("");
    try {
      const id = Number(groupInput);
      setList(await invoke<Conversations>("vk_connect", { groupId: id, token }));
      setGroup(id);
      setToken("");
    } catch (error) {
      setProblem(String(error));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setProblem("");
    try {
      await invoke("vk_disconnect");
      setActive(null);
      setList(null);
      setGroup(null);
    } catch (error) {
      setProblem(String(error));
    } finally {
      setBusy(false);
    }
  }

  return <section className="fox-messages-center">
    <div className="fox-comm-heading">
      <div><h1>Сообщения</h1><p>Входящие и ответы от имени сообщества ВКонтакте.</p></div>
      <div className="vk-actions">
        {group && <>
          <button type="button" title="Обновить диалоги" aria-label="Обновить диалоги" className="outline-button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16}/></button>
          <button type="button" className="outline-button" disabled={busy} onClick={() => void disconnect()}>Отключить ВКонтакте</button>
        </>}
      </div>
    </div>
    {problem && <p role="alert" className="vk-status">{problem}</p>}
    {!group ? <div className="fox-comm-panel vk-connect">
      <h2>Подключить сообщество ВКонтакте</h2>
      {isTauri() ? <form onSubmit={connect}>
        <p>Включите сообщения в сообществе и создайте ключ доступа с правом управления сообщениями. Ключ сохранится в macOS Keychain.</p>
        <label>Числовой ID сообщества<input inputMode="numeric" pattern="[0-9]+" required value={groupInput} onChange={event => setGroupInput(event.target.value)} /></label>
        <label>Ключ доступа<input type="password" required autoComplete="off" value={token} onChange={event => setToken(event.target.value)} /></label>
        <button className="primary-button" disabled={!statusLoaded || busy}>{busy ? "Проверка…" : "Подключить"}</button>
      </form> : <p>Подключение сообщества доступно в приложении Fox Space для Mac.</p>}
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
