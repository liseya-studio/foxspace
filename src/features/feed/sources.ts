import { useEffect, useState } from "react";

export const feedSources = [
  {id:"telegram-bulotkaff",platform:"telegram",title:"Telegram · @bulotkaff",url:"https://t.me/bulotkaff"},
  {id:"vk-btsah",platform:"vk",title:"ВКонтакте · btsah",url:"https://vk.ru/btsah"},
] as const;
export type FeedSourceId = typeof feedSources[number]["id"];

const KEY = "fox-feed-hidden-sources-v1";
const changed = "fox-feed-sources-changed";

function hiddenSources(): FeedSourceId[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? feedSources.filter(source => value.includes(source.id)).map(source => source.id) : [];
  } catch {
    return [];
  }
}

export function setFeedSourceVisible(id: FeedSourceId, visible: boolean) {
  const hidden = new Set(hiddenSources());
  if (visible) hidden.delete(id);
  else hidden.add(id);
  localStorage.setItem(KEY, JSON.stringify([...hidden]));
  window.dispatchEvent(new Event(changed));
}

export function useHiddenFeedSources() {
  const [hidden, setHidden] = useState(hiddenSources);
  useEffect(() => {
    const refresh = () => setHidden(hiddenSources());
    window.addEventListener(changed, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(changed, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return hidden;
}
