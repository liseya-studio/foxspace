#!/usr/bin/env python3
"""Download an owned Telegram channel archive and stage confirmed Boosty deliveries."""
import argparse
import asyncio
from contextlib import closing
from getpass import getpass
import fcntl
import json
import os
from pathlib import Path
import sys

from archive import (
    URL, atomic_json, begin_delivery, canonical_blog, clear_pending,
    complete_delivery, delivery_db, make_post, media_path, tag, url_blog,
)

from desktop_export import copy_media, export_albums, export_message, has_media, open_export

BOT = "boosty_posting_bot"
MANIFEST = "boosty-archive.json"


def read_manifest(root):
    with (root / MANIFEST).open(encoding="utf-8") as index:
        manifest = json.load(index)
    if manifest.get("format") != "foxspace-boosty-archive-v1":
        raise ValueError("Неизвестный формат реестра архива.")
    return manifest


def rules(args):
    requested = tag(args.hashtag)
    replacements = {}
    for rule in args.replace_tag:
        before, separator, after = rule.partition("=")
        if not separator:
            raise ValueError("Задайте замену в формате #старый=#новый. Пустое значение удаляет тег.")
        if after:
            tag(after)
            if not after.startswith("#"):
                raise ValueError("Новый тег должен начинаться с #.")
        replacements[tag(before)] = after
    return requested,replacements


def import_export(args):
    channel_id, title, source, entries = open_export(args.export)
    requested,replacements = rules(args)
    root=args.folder
    if root.resolve()==source:
        raise ValueError("Укажите отдельную папку для очереди Boosty.")
    root.mkdir(parents=True,exist_ok=True)
    old=read_manifest(root) if (root/MANIFEST).exists() else None
    if old and (old["channel_id"]!=channel_id or old["hashtag"]!=requested):
        raise ValueError("Для другого канала или хэштега выберите новую папку.")
    posts=[]
    for (kind,_),members in export_albums(entries.values()):
        post=make_post(channel_id,[export_message(entry) for entry in members],requested,replacements,args.heading)
        if post is None: continue
        for item in members:
            copy_media(source,item,root,post)
        if kind=="message" and any(has_media(item) for item in members):
            post["blocked"].append("Telegram Desktop не указал ID альбома. Для точного порядка используйте сверку метаданных канала.")
        posts.append(post)
    manifest={"format":"foxspace-boosty-archive-v1","channel_id":channel_id,"channel":title,
              "hashtag":requested,"complete":True,"posts":posts}
    atomic_json(root/MANIFEST,manifest)
    print(f"Найдено: {len(posts)}. Требуют проверки: {sum(bool(post['blocked']) for post in posts)}. Реестр: {root/MANIFEST}")


async def scan(client, args):
    from telethon import types
    channel = await client.get_entity(args.channel)
    if not isinstance(channel, types.Channel) or not channel.broadcast:
        raise ValueError("Нужен Telegram-канал, а не группа или личный чат.")
    permission = await client.get_permissions(channel, "me")
    if not permission.is_admin and not permission.is_creator:
        raise ValueError("Войдите в свой аккаунт редактора или администратора канала.")
    if channel.noforwards:
        raise ValueError("В канале ограничено сохранение контента. Проверьте настройки своего канала.")
    requested,replacements = rules(args)
    imported = open_export(args.export) if args.export else None
    if imported and imported[0] != str(channel.id):
        raise ValueError("Выбранный экспорт принадлежит другому каналу.")
    root = args.folder
    if imported and root.resolve() == imported[2]:
        raise ValueError("Укажите отдельную папку для очереди Boosty.")
    root.mkdir(parents=True, exist_ok=True)
    (root / "media").mkdir(exist_ok=True)
    old = read_manifest(root) if (root / MANIFEST).exists() else None
    if old and (old["channel_id"] != str(channel.id) or old["hashtag"] != requested):
        raise ValueError("Для другого канала или хэштега выберите новую папку.")
    manifest = {"format":"foxspace-boosty-archive-v1","channel_id":str(channel.id),
                "channel":channel.title,"hashtag":requested,"complete":False,"posts":[]}

    async def add(album):
        post = make_post(channel.id, album, requested, replacements, args.heading)
        if post is None:
            return
        for msg in sorted(album,key=lambda item:item.id):
            if not msg.media or isinstance(msg.media, types.MessageMediaWebPage):
                continue
            if msg.noforwards or msg.gif or msg.sticker or not (msg.photo or msg.video or msg.audio):
                post["blocked"].append(f"Сообщение {msg.id}: вложение требует ручной проверки.")
                continue
            if imported and msg.id in imported[3]:
                flags=len(post["blocked"])
                if copy_media(imported[2],imported[3][msg.id],root,post,keep_source_format=False):
                    continue
                del post["blocked"][flags:]
            directory = root / "media" / str(post["message_ids"][0]) / str(msg.id)
            directory.mkdir(parents=True, exist_ok=True)
            cached = sorted(path for path in directory.iterdir() if path.is_file() and path.stat().st_size)
            if not cached:
                stage = directory / "download"
                stage.mkdir(exist_ok=True)
                downloaded = await client.download_media(msg, file=str(stage))
                if not downloaded:
                    post["blocked"].append(f"Сообщение {msg.id}: Telegram не отдал файл.")
                    continue
                file = Path(downloaded)
                cached = [file.replace(directory / file.name)]
            post["media"].extend(str(path.relative_to(root)) for path in cached)
        manifest["posts"].append(post)
        if len(manifest["posts"]) % 20 == 0:
            atomic_json(root / MANIFEST, manifest)
        print(f"Подготовлено: {len(manifest['posts'])} · {post['date']} · {len(post['media'])} медиа", flush=True)

    batch = []
    scanned = 0
    async for msg in client.iter_messages(channel, reverse=True, wait_time=1):
        if not isinstance(msg, types.Message):
            continue
        if batch and (not msg.grouped_id or msg.grouped_id != batch[0].grouped_id):
            await add(batch)
            batch = []
        batch.append(msg)
        scanned += 1
        if scanned % 250 == 0:
            print(f"Проверено сообщений: {scanned}", flush=True)
    if batch:
        await add(batch)
    manifest["complete"] = True
    atomic_json(root / MANIFEST, manifest)
    print(f"Проверено сообщений: {scanned}. Готовых записей: {len(manifest['posts'])}. Реестр: {root / MANIFEST}")


def message_links(message):
    urls = set(URL.findall(message.raw_text or ""))
    urls.update(entity.url for entity in (message.entities or []) if isinstance(getattr(entity, "url", None), str))
    urls.update(button.url for row in message.buttons or [] for button in row if isinstance(getattr(button,"url",None),str))
    return urls


async def receipt(client, bot, sent_id, prompt_id, blog):
    for attempt in range(12):
        for answer in await client.get_messages(bot, limit=15):
            if answer.id < prompt_id or answer.id <= sent_id or answer.out:
                continue
            for candidate in message_links(answer):
                if url_blog(candidate, post=True) == blog:
                    return candidate
        if attempt < 11:
            await asyncio.sleep(2)
    return None


async def publish(client, args):
    from telethon import types
    root = args.folder
    manifest = read_manifest(root)
    if not manifest["complete"]:
        raise ValueError("Дождитесь окончания сканирования архива.")
    blog = canonical_blog(args.blog)
    bot = await client.get_entity(BOT)
    if not getattr(bot,"bot",False) or (bot.username or "").casefold()!=BOT:
        raise ValueError("Не удалось подтвердить адрес официального бота Boosty.")
    with closing(delivery_db(root / "delivery.sqlite3")) as db:
        pending = db.execute("SELECT post FROM delivery WHERE blog=? AND state='pending'", (blog,)).fetchone()
        if pending:
            raise ValueError(f"Проверьте результат предыдущей отправки {pending[0]}. Команда resolve фиксирует результат.")
        count=0
        for post in manifest["posts"]:
            if db.execute("SELECT 1 FROM delivery WHERE blog=? AND post=?", (blog,post["id"])).fetchone():
                continue
            files = [str(media_path(root,path)) for path in post["media"]]
            text = post["text"].strip()
            limit = 1024 if files else 4096
            if post["blocked"] or len(files)>10 or len(text)>limit or not (text or files):
                raise ValueError(f"Пост {post['id']} требует ручной подготовки. Проверьте вложения и длину текста в реестре.")
            if not begin_delivery(db,blog,post["id"]):
                raise ValueError("Этот пост уже обрабатывается.")
            async with client.conversation(bot,timeout=30,total_timeout=60,exclusive=True) as conversation:
                if files:
                    sent = await conversation.send_file(files if len(files)>1 else files[0],caption=text,parse_mode=None)
                else:
                    sent = await conversation.send_message(text,parse_mode=None)
                last=sent[-1] if isinstance(sent,list) else sent
                answer = await conversation.get_response(last)
                buttons = [button for row in answer.buttons or [] for button in row
                           if button.text.strip() == args.tier and isinstance(button.button,types.KeyboardButtonCallback)]
                if len(buttons)!=1 or not any(url_blog(link)==blog for link in message_links(answer)):
                    raise ValueError(f"Черновик {post['id']} отправлен боту. Он не подтвердил блог и точный уровень; проверьте диалог.")
                await buttons[0].click()
                link = await receipt(client,bot,last.id,answer.id,blog)
                if not link:
                    raise ValueError(f"Проверьте публикацию {post['id']} в Boosty: ссылка от бота не получена.")
                complete_delivery(db,blog,post["id"],link)
                count+=1
                print(f"{post['id']} → {link}",flush=True)
            if count>=args.limit:
                break
            await asyncio.sleep(3)


def resolve(args):
    blog=canonical_blog(args.blog)
    with closing(delivery_db(args.folder / "delivery.sqlite3")) as db:
        pending=db.execute("SELECT state FROM delivery WHERE blog=? AND post=?",(blog,args.post)).fetchone()
        if not pending or pending[0]!="pending":
            raise ValueError("Эта запись не ожидает проверки.")
        if args.url:
            complete_delivery(db,blog,args.post,args.url)
        else:
            clear_pending(db,blog,args.post)


async def online(args):
    from telethon import TelegramClient
    api_id = os.environ.get("FOXSPACE_TG_API_ID") or input("Telegram API ID: ")
    api_hash = os.environ.get("FOXSPACE_TG_API_HASH") or getpass("Telegram API hash: ")
    session = Path(os.environ.get("FOXSPACE_TG_SESSION",str(Path.home()/".foxspace-boosty"/"telegram")))
    session.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    with session.with_suffix(".lock").open("a") as lock:
        try:
            fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise ValueError("С этой сессией Telegram уже запущена другая операция.") from error
        client = TelegramClient(str(session),int(api_id),api_hash, flood_sleep_threshold=0)
        try:
            await client.start()
            if await client.is_bot():
                raise ValueError("Для старого архива требуется аккаунт Telegram, а не токен бота.")
            await (scan(client,args) if args.mode=="scan" else publish(client,args))
        finally:
            await client.disconnect()


def cli():
    parser=argparse.ArgumentParser(description=__doc__)
    modes=parser.add_subparsers(dest="mode",required=True)
    scanner=modes.add_parser("scan")
    importer=modes.add_parser("import-export")
    scanner.add_argument("--channel",required=True)
    scanner.add_argument("--export",type=Path)
    importer.add_argument("--export",type=Path,required=True)
    for command in (scanner,importer):
        command.add_argument("--hashtag",required=True)
        command.add_argument("--folder",type=Path,required=True)
        command.add_argument("--replace-tag",action="append",default=[])
        command.add_argument("--heading",default="")
    sender=modes.add_parser("send")
    sender.add_argument("--folder",type=Path,required=True)
    sender.add_argument("--blog",required=True)
    sender.add_argument("--tier",required=True)
    sender.add_argument("--limit",type=int,default=1)
    sender.add_argument("--apply",action="store_true")
    recovery=modes.add_parser("resolve")
    recovery.add_argument("--folder",type=Path,required=True)
    recovery.add_argument("--blog",required=True)
    recovery.add_argument("--post",required=True)
    confirmation=recovery.add_mutually_exclusive_group(required=True)
    confirmation.add_argument("--url")
    confirmation.add_argument("--checked-not-published",action="store_true")
    args=parser.parse_args()
    os.umask(0o077)
    try:
        if args.mode=="resolve":
            resolve(args)
        elif args.mode=="import-export":
            import_export(args)
        elif args.mode=="send" and not args.apply:
            blog=canonical_blog(args.blog)
            manifest=read_manifest(args.folder)
            print(f"Блог: {blog}. Уровень: {args.tier}. В реестре: {len(manifest['posts'])}. Лимит запуска: {args.limit}.")
            print("Предпросмотр. Для отправки добавьте --apply.")
        else:
            if args.mode=="send" and (not args.tier.strip() or args.limit<1):
                raise ValueError("Укажите точный уровень доступа и положительный лимит.")
            asyncio.run(online(args))
    except (ValueError,OSError,ImportError,TimeoutError) as error:
        print(f"Остановлено: {error}",file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f"Остановлено: {type(error).__name__}. Проверьте соединение и статус отправки.",file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    cli()
