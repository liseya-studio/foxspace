#!/usr/bin/env python3
"""Fetch only public posts for the two explicitly configured Fox Space sources.

Telegram uses its public /s/ preview. VK uses the official wall.get API
with a server-side VK_SERVICE_TOKEN; the token is never sent to the browser.
Failures preserve old verified posts and expose an honest source status.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from bs4 import BeautifulSoup

DEST = Path("public/feed.json")
SOURCE_IDS = ("telegram-bulotkaff", "vk-btsah")
MAX_PER_SOURCE = 20
USER_AGENT = "Mozilla/5.0 (compatible; FoxSpacePublicFeed/1.0)"

def fetch(url):
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/json"})
    with urlopen(request, timeout=25) as response:
        return response.read().decode("utf-8", errors="replace")

def telegram_posts():
    html = fetch("https://t.me/s/bulotkaff")
    soup = BeautifulSoup(html, "html.parser")
    posts = []
    seen = set()
    for node in soup.select(".tgme_widget_message[data-post]"):
        ident = node.get("data-post", "")
        if not re.fullmatch(r"bulotkaff/\d+", ident) or ident in seen:
            continue
        seen.add(ident)
        text_node = node.select_one(".tgme_widget_message_text")
        text = text_node.get_text("\n", strip=True) if text_node else ""
        date_node = node.select_one("time[datetime]")
        date = date_node.get("datetime") if date_node else None
        post_url = "https://t.me/" + ident
        images = []
        for image in node.select(".tgme_widget_message_photo_wrap"):
            css = image.get("style", "")
            match = re.search(r'url\(["\']?([^)"\']+)', css)
            if match and match.group(1).startswith("https://"):
                images.append(match.group(1))
        if not text and not images and not node.select_one(".tgme_widget_message_video_player"):
            continue
        posts.append({"id": "telegram:" + ident, "sourceId": SOURCE_IDS[0], "text": text[:15000],
                      "url": post_url, "date": date, "images": images})
    if not posts:
        raise ValueError("Публичная страница Telegram не вернула доступных постов.")
    return posts[-MAX_PER_SOURCE:]

def vk_posts():
    token = os.environ.get("VK_SERVICE_TOKEN", "").strip()
    if not token:
        raise ValueError("Для загрузки постов ВКонтакте требуется серверный токен VK_SERVICE_TOKEN.")
    query = urlencode({"domain": "btsah", "count": MAX_PER_SOURCE, "v": "5.199", "access_token": token})
    data = json.loads(fetch("https://api.vk.com/method/wall.get?" + query))
    if "error" in data:
        raise ValueError("VK API: " + str(data["error"].get("error_msg", "не удалось получить публикации")))
    response = data.get("response", {})
    posts = []
    for entry in response.get("items", []):
        if not isinstance(entry.get("id"), int):
            continue
        photos = []
        for attachment in entry.get("attachments", []):
            if attachment.get("type") == "photo":
                sizes = attachment.get("photo", {}).get("sizes", [])
                if sizes:
                    chosen = max(sizes, key=lambda item: item.get("width", 0) * item.get("height", 0))
                    if chosen.get("url", "").startswith("https://"):
                        photos.append(chosen["url"])
        owner = entry.get("owner_id", "")
        ident = entry["id"]
        posts.append({"id": f"vk:{owner}_{ident}", "sourceId": SOURCE_IDS[1],
                      "text": entry.get("text", "")[:15000], "url": f"https://vk.com/wall{owner}_{ident}",
                      "date": datetime.fromtimestamp(entry.get("date", 0), timezone.utc).isoformat(),
                      "images": photos})
    if not posts:
        raise ValueError("Сообщество ВКонтакте не вернуло доступных публикаций.")
    return posts

def main():
    current = json.loads(DEST.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc).isoformat()
    old_posts = current.get("posts", [])
    sources = []
    all_posts = []
    for original in current.get("sources", []):
        source = dict(original)
        source_id = source["id"]
        try:
            posts = telegram_posts() if source_id == SOURCE_IDS[0] else vk_posts()
            all_posts.extend(posts)
            source.update(status="ok", message=f"Загружено публикаций: {len(posts)}", updatedAt=now)
            print(source_id, len(posts), "posts")
        except Exception as error:
            retained = [p for p in old_posts if p.get("sourceId") == source_id]
            all_posts.extend(retained)
            source.update(status="stale" if retained else "unavailable", message=str(error))
            print(source_id, "unavailable:", error, file=sys.stderr)
        sources.append(source)
    unique = {post["id"]: post for post in all_posts}
    result = {"generatedAt": now, "sources": sources,
              "posts": sorted(unique.values(), key=lambda post: post.get("date") or "", reverse=True)}
    DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
