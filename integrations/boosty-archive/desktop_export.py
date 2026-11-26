"""Read a single-channel Telegram Desktop export without changing the source."""
from datetime import datetime
import json
from pathlib import Path
import shutil
from types import SimpleNamespace

MEDIA_FIELDS = ("photo", "file", "voice_message", "video_file", "audio_file")


def open_export(path):
    path = path / "result.json" if path.is_dir() else path
    with path.open(encoding="utf-8-sig") as source:
        export = json.load(source)
    if export.get("type") not in ("public_channel", "private_channel") or not isinstance(export.get("messages"),list):
        raise ValueError("Экспортируйте один Telegram-канал через меню канала, формат JSON.")
    identifier = str(export.get("id", ""))
    if identifier.startswith("-100"):
        identifier = identifier[4:]
    if not identifier.isdecimal():
        raise ValueError("В экспорте Telegram отсутствует ID канала.")
    messages = {}
    for item in export["messages"]:
        if not isinstance(item,dict) or item.get("type")!="message" or not isinstance(item.get("id"),int):
            continue
        messages.setdefault(item["id"],item)
    return identifier, export.get("name","Telegram"), path.parent.resolve(), messages


def export_message(entry):
    content = entry.get("text", "")
    if isinstance(content,list):
        pieces = []
        for part in content:
            if isinstance(part,str):
                pieces.append(part)
            elif isinstance(part,dict):
                label = part.get("text","")
                pieces.append(label if isinstance(label,str) else "")
                link = part.get("href")
                if isinstance(link,str) and link.startswith(("https://","http://")):
                    pieces.append(f" ({link})")
        content = "".join(pieces)
    # Telegram Desktop emits a numeric Unix timestamp alongside the human-readable date.
    raw_date=entry.get("date_unixtime")
    date=datetime.fromtimestamp(int(raw_date)).astimezone() if raw_date else datetime.fromisoformat(entry["date"])
    return SimpleNamespace(id=entry["id"],message=content if isinstance(content,str) else "",date=date)


def has_media(entry):
    return any(entry.get(field) for field in MEDIA_FIELDS)


def copy_media(source, entry, folder, post, keep_source_format=True):
    fields = list(dict.fromkeys(entry[field] for field in MEDIA_FIELDS if isinstance(entry.get(field),str)))
    if not fields:
        return False
    copied = False
    media_type=entry.get("media_type", "")
    if keep_source_format and media_type in {"sticker","animation","voice_message","video_message"}:
        post["blocked"].append(f"Сообщение {entry['id']}: формат {media_type} требует проверки перед отправкой.")
    for index, relative in enumerate(fields,1):
        original=(source / relative).resolve()
        if not original.is_relative_to(source) or not original.is_file():
            post["blocked"].append(f"Сообщение {entry['id']}: файл не найден в экспорте.")
            continue
        destination=folder/"media"/str(post["message_ids"][0])/str(entry["id"])/f"{index:02}-{original.name}"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.stat().st_size!=original.stat().st_size:
            staged=destination.with_name(destination.name+".part")
            shutil.copy2(original,staged)
            staged.replace(destination)
        post["media"].append(str(destination.relative_to(folder)))
        copied = True
    return copied


def export_albums(entries):
    """Group only explicit IDs. Telegram Desktop commonly omits them."""
    grouped = {}
    for entry in sorted(entries,key=lambda item:item["id"]):
        group = entry.get("grouped_id") or entry.get("media_group_id")
        key = ("album",str(group)) if group else ("message",entry["id"])
        grouped.setdefault(key,[]).append(entry)
    return grouped.items()
