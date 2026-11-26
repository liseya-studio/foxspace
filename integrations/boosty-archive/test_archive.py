from contextlib import closing, redirect_stdout
from io import StringIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest

from archive import begin_delivery, complete_delivery, delivery_db, has_tag, tag
from run import import_export
from html_export import open_html_export


class ArchiveTest(unittest.TestCase):
    def test_exact_hashtag_and_order_with_explicit_album(self):
        with TemporaryDirectory() as folder:
            root=Path(folder)
            exported=root/"export"
            exported.mkdir()
            for name in ("first.jpg","second.jpg","uncertain.jpg"):
                (exported/name).write_bytes(name.encode())
            common={"date":"2025-10-10T10:00:00","type":"message"}
            original={"id":123,"type":"private_channel","name":"Fixture","messages":[
                {**common,"id":20,"text":"","photo":"second.jpg","grouped_id":"56"},
                {**common,"id":19,"text":["Глава ",{"type":"hashtag","text":"#Работа"}],"photo":"first.jpg","grouped_id":"56"},
                {**common,"id":21,"text":"#работа_продолжение"},
                {**common,"id":22,"text":"#работа","photo":"uncertain.jpg"},
                {**common,"id":23,"text":"#работа","file":"../secret.jpg"},
            ]}
            (root/"secret.jpg").write_text("outside export")
            (exported/"result.json").write_text(json.dumps(original))
            output=root/"queue"
            with redirect_stdout(StringIO()):
                import_export(SimpleNamespace(export=exported,folder=output,hashtag="#работа",replace_tag=["#работа=#Архив"],heading="Глава"))
            manifest=json.loads((output/"boosty-archive.json").read_text())
            first,uncertain,missing=manifest["posts"]
            self.assertEqual(first["message_ids"],[19,20])
            self.assertEqual(first["text"],"Глава\n\nГлава #Архив")
            self.assertEqual([(output/path).read_bytes() for path in first["media"]],[b"first.jpg",b"second.jpg"])
            self.assertFalse(first["blocked"])
            self.assertTrue(uncertain["blocked"])
            self.assertTrue(missing["blocked"])
            self.assertFalse(missing["media"])
            self.assertFalse(has_tag("#работа_продолжение",tag("#работа")))

    def test_html_export_reuses_media_and_rejects_incomplete_pages(self):
        with TemporaryDirectory() as folder:
            root=Path(folder)
            page=root/"messages.html"
            page.write_text("""<html><div class="name bold">Канал</div>
              <div class="message default clearfix" id="message7">
              <div class="body"><div class="pull_right date details" title="12 января 2569, 15:58:04">15:58</div>
              <a class="photo_wrap" href="photos/photo_7.jpg"><img src="photos/tiny.jpg"></a>
              <div class="text"><a href="#">#работа</a><br>Текст</div></div></div>""")
            with self.assertRaises(ValueError):
                open_html_export(root)
            with page.open("a") as file: file.write("</html>")
            identity,name,base,items,closed=open_html_export(root)
            self.assertTrue(closed)
            self.assertEqual(name,"Канал")
            self.assertEqual(items[7]["text"],"#работа\nТекст")
            self.assertEqual(items[7]["date"],"2026-01-12T15:58:04")
            self.assertEqual(items[7]["attachments"],["photos/photo_7.jpg"])

    def test_pending_or_confirmed_delivery_is_never_started_twice(self):
        with TemporaryDirectory() as folder:
            with closing(delivery_db(Path(folder)/"delivery.sqlite3")) as db:
                self.assertTrue(begin_delivery(db,"fox","1:2"))
                self.assertFalse(begin_delivery(db,"fox","1:2"))
                with self.assertRaises(ValueError):
                    complete_delivery(db,"fox","1:2","https://boosty.to/other/posts/12345678-1234-1234-1234-123456789abc")
                complete_delivery(db,"fox","1:2","https://boosty.to/fox/posts/12345678-1234-1234-1234-123456789abc")
                self.assertFalse(begin_delivery(db,"fox","1:2"))
                self.assertTrue(begin_delivery(db,"other","1:2"))
