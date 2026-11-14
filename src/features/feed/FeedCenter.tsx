import { Rss, Layers3, ShieldCheck, Radio } from "lucide-react";
export default function FeedCenter(){
  return <section className="fox-feed-center">
    <header className="fox-comm-heading"><div><div className="eyebrow">ПУБЛИКАЦИИ</div><h1>Лента</h1><p>Публикации из выбранных сообществ и каналов — в одном потоке.</p></div></header>
    <div className="fox-feed-layout"><div className="fox-feed-main"><div className="fox-feed-filter-head"><Layers3 size={16}/><span>Все источники</span><small>0 подключено</small></div><div className="fox-comm-empty fox-feed-empty"><Rss size={32}/><h2>Лента пока пуста</h2><p>Здесь будут полные публикации выбранных каналов Telegram и сообществ VK, с оригинальным текстом и вложениями. Сейчас источники не подключены.</p></div></div>
      <aside className="fox-feed-side"><div className="fox-feed-aside-title"><Radio size={16}/> Источники</div><p>Пока нет подключённых каналов или сообществ.</p><div className="fox-feed-privacy"><ShieldCheck size={16}/> Никакие аккаунты не подключаются автоматически. Управление доступом появится вместе с интеграциями.</div></aside></div>
  </section>;
}
