"""Extract ordered message records from a Telegram Desktop HTML export."""
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
import hashlib
import re
from urllib.parse import unquote, urlsplit

PAGE = re.compile(r"messages(\d*)\.html", re.I)
MESSAGE = re.compile(r"message(\d+)")
MONTHS = "января февраля марта апреля мая июня июля августа сентября октября ноября декабря".split()
MEDIA_DIRECTORIES = {"photos", "video_files", "files", "voice_messages", "round_video_messages", "stickers"}


def exported_date(value):
    try:
        return datetime.fromisoformat(value).isoformat()
    except ValueError:
        pass
    match = re.fullmatch(r"(\d{1,2}) ([а-я]+) (\d{4}),? (\d{2}):(\d{2}):(\d{2})",value.lower())
    if match and match[2] in MONTHS:
        day, year, hour, minute, second = map(int,(match[1],match[3],match[4],match[5],match[6]))
        if 2500 <= year <= 2699:
            year -= 543
        return datetime(year, MONTHS.index(match[2])+1, day, hour, minute, second).isoformat()
    for layout in ("%d.%m.%Y %H:%M:%S %z","%d.%m.%Y %H:%M:%S"):
        try:
            return datetime.strptime(value,layout).isoformat()
        except ValueError:
            continue
    return ""


class TelegramHtml(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth=0
        self.message_depth=None
        self.text_depth=None
        self.title_depth=None
        self.current=None
        self.entries={}
        self.title=[]
        self.caption=[]
        self.link=""
        self.closed=False

    def handle_starttag(self,element,attributes):
        attrs=dict(attributes)
        classes=set(attrs.get("class","").split())
        if element=="div":
            self.depth+=1
            match=MESSAGE.fullmatch(attrs.get("id",""))
            if match and {"message","default"}<=classes:
                self.message_depth=self.depth
                self.current={"id":int(match[1]),"type":"message","text":"","attachments":[],"date":""}
            if self.current is None and {"name","bold"}<=classes and not self.title:
                self.title_depth=self.depth
            if self.current is not None and self.message_depth!=self.depth:
                if "text" in classes and self.text_depth is None:
                    self.text_depth=self.depth
                    self.caption=[]
                if "date" in classes and "title" in attrs:
                    self.current["date"]=exported_date(attrs["title"])
        if self.current is None:
            return
        if self.text_depth is not None:
            if element=="br":
                self.caption.append("\n")
            elif element=="a":
                href=attrs.get("href","")
                if href.startswith(("https://","http://")):
                    self.link=href
        elif element=="a":
            href=urlsplit(attrs.get("href",""))
            path=Path(unquote(href.path))
            if not href.scheme and not href.netloc and path.parts and path.parts[0] in MEDIA_DIRECTORIES:
                relative=path.as_posix()
                if relative not in self.current["attachments"]:
                    self.current["attachments"].append(relative)

    def handle_startendtag(self,element,attributes):
        self.handle_starttag(element,attributes)

    def handle_endtag(self,element):
        if element=="html":
            self.closed=True
        if element=="a" and self.link:
            self.caption.append(" ("+self.link+")")
            self.link=""
        if element!="div":
            return
        if self.depth==self.title_depth:
            self.title_depth=None
        if self.depth==self.text_depth:
            self.current["text"]="".join(self.caption).strip()
            self.text_depth=None
        if self.depth==self.message_depth:
            self.entries.setdefault(self.current["id"],self.current)
            self.message_depth=None
            self.current=None
        self.depth=max(0,self.depth-1)

    def handle_data(self,data):
        if self.title_depth is not None:
            self.title.append(data)
        if self.text_depth is not None:
            self.caption.append(data)


def open_html_export(path, require_complete=True):
    folder=(path if path.is_dir() else path.parent).resolve()
    pages=sorted((page for page in folder.iterdir() if PAGE.fullmatch(page.name)),
                 key=lambda page:int(PAGE.fullmatch(page.name)[1] or 1))
    if not pages:
        raise ValueError("В папке не найден messages.html.")
    title=""
    entries={}
    complete=True
    for page in pages:
        parser=TelegramHtml()
        parser.feed(page.read_text(encoding="utf-8-sig"))
        parser.close()
        complete=complete and parser.closed
        title=title or "".join(parser.title).strip()
        for key,item in parser.entries.items():
            entries.setdefault(key,item)
    if require_complete and not complete:
        raise ValueError("Telegram Desktop ещё записывает HTML. Дождитесь окончания экспорта.")
    if not title:
        title=folder.name.removeprefix("ChatExport_")
    identity="html-"+hashlib.sha256(title.encode()).hexdigest()[:16]
    return identity,title,folder,entries,complete
