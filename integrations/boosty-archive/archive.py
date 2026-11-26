"""Archive planning and delivery state for Telegram → Boosty."""
import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

TAG = re.compile(r"(?<![\w#])#[\w]+(?:@[a-zA-Z0-9_]+)?")
BLOG = re.compile(r"[A-Za-z0-9_-]{1,64}")
POST_PATH = re.compile(r"/([A-Za-z0-9_-]{1,64})/posts/([a-fA-F0-9-]{36})/?")
URL = re.compile(r"https://boosty\.to/[A-Za-z0-9_./-]+")


def tag(value):
    value = "#" + value.strip().lstrip("#")
    if not TAG.fullmatch(value):
        raise ValueError("Укажите точный хэштег, например #название_работы.")
    return value.casefold()


def has_tag(text, expected):
    return any(item.group().casefold() == expected for item in TAG.finditer(text))


def rewrite_tags(text, replacements):
    return TAG.sub(lambda match: replacements.get(match.group().casefold(), match.group()), text)


def canonical_blog(value):
    value = value.strip().rstrip("/")
    if value.startswith("https://boosty.to/"):
        value = value.removeprefix("https://boosty.to/")
    if not BLOG.fullmatch(value):
        raise ValueError("Укажите блог в формате https://boosty.to/имя.")
    return value.lower()


def url_blog(value, post=False):
    url = urlsplit(value)
    if url.scheme != "https" or url.netloc != "boosty.to":
        return None
    if post:
        match = POST_PATH.fullmatch(url.path)
        return match[1].lower() if match else None
    parts = url.path.strip("/").split("/")
    return parts[0].lower() if len(parts) == 1 and BLOG.fullmatch(parts[0]) else None


def atomic_json(path, data):
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False, indent=2)
        output.write("\n")
    tmp.replace(path)


def make_post(channel_id, messages, requested_tag, replacements, heading=""):
    messages = sorted(messages, key=lambda message: message.id)
    captions = [message.message for message in messages if message.message]
    if not any(has_tag(text, requested_tag) for text in captions):
        return None
    body = rewrite_tags("\n\n".join(captions), replacements)
    if heading:
        body = heading + "\n\n" + body
    return {
        "id": f"{channel_id}:{messages[0].id}",
        "date": messages[0].date.isoformat(),
        "message_ids": [message.id for message in messages],
        "text": body,
        "media": [],
        "blocked": [],
    }


def media_path(root, relative):
    base = root.resolve()
    path = (base / relative).resolve()
    if not path.is_relative_to(base / "media") or not path.is_file():
        raise ValueError(f"Файл отсутствует или лежит за пределами папки media: {relative}")
    return path


def delivery_db(path):
    db = sqlite3.connect(path, timeout=15)
    db.execute("""CREATE TABLE IF NOT EXISTS delivery (
        blog TEXT NOT NULL, post TEXT NOT NULL, state TEXT NOT NULL, url TEXT,
        PRIMARY KEY (blog,post)
    )""")
    return db


def begin_delivery(db, blog, post):
    with db:
        return db.execute("INSERT OR IGNORE INTO delivery VALUES (?, ?, 'pending', NULL)", (blog, post)).rowcount == 1


def complete_delivery(db, blog, post, url):
    if url_blog(url, post=True) != blog:
        raise ValueError("Бот не подтвердил публикацию в выбранном блоге.")
    with db:
        db.execute("UPDATE delivery SET state='published', url=? WHERE blog=? AND post=?",(url,blog,post))


def clear_pending(db, blog, post):
    with db:
        db.execute("DELETE FROM delivery WHERE blog=? AND post=? AND state='pending'", (blog,post))
