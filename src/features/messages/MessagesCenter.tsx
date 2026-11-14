import { Mail, Inbox, ShieldCheck, PlugZap } from "lucide-react";

export default function MessagesCenter(){
  return <section className="fox-messages-center">
    <div className="fox-comm-heading"><div><div className="eyebrow">ЛИЧНЫЕ СООБЩЕНИЯ</div><h1>Сообщения</h1><p>Единый список диалогов подключённых сервисов.</p></div></div>
    <div className="fox-comm-panel fox-messages-layout"><aside className="fox-messages-sidebar"><div className="fox-messages-sidebar-title"><Mail size={17}/> Диалоги</div><div className="fox-messages-empty-list">Пока нет подключённых источников сообщений.</div></aside><div className="fox-messages-main"><div className="fox-comm-empty"><Inbox size={32}/><h2>Сообщений пока нет</h2><p>Диалоги появятся после подключения источника. Сейчас Fox Space не имеет доступа к вашим личным перепискам и не отправляет сообщения.</p><div className="fox-messages-info"><ShieldCheck size={17}/> Переписки не импортируются и не синхронизируются без вашего подключения.</div></div></div></div>
    <div className="fox-messages-connect"><PlugZap size={16}/><span>Интеграции Telegram и VK запланированы. Авторизация, просмотр переписок и отправка пока не реализованы.</span></div>
  </section>;
}
