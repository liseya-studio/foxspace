import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{await page.goto("/");await page.evaluate(()=>localStorage.clear());await page.reload();});

test("image column stays compact and record drawer previews the actual uploaded photo",async({page})=>{
 await page.locator(".dock-add").click();
 await page.locator(".fox-global-create-items button").filter({hasText:"Таблица"}).click();
 await page.locator(".dialog .form-input").fill("Рекламные публикации");
 await page.locator(".dialog .primary-button").click();
 await page.getByRole("button",{name:"Поля"}).click();
 await page.getByPlaceholder("Например, Приоритет").fill("Обложка");
 await page.locator(".dialog select").first().selectOption("image");
 await page.getByRole("button",{name:"Добавить поле"}).last().click();
 await page.getByRole("button",{name:"Добавить запись"}).click();
 const photo=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLytQAAAABJRU5ErkJggg==","base64");
 await page.locator(".table-image-cell input[type=file]").first().setInputFiles({name:"cover.png",mimeType:"image/png",buffer:photo});
 await expect(page.locator(".table-image-cell").first()).toContainText("Фото");
 await page.getByTitle("Открыть запись").first().click();
 await expect(page.getByRole("dialog",{name:"Карточка записи"})).toBeVisible();
 await expect(page.locator(".table-image-preview img")).toBeVisible();
 await expect(page.locator(".table-image-preview small")).toHaveText("cover.png");
 await page.reload();
 await page.getByRole("button",{name:"Файлы и таблицы"}).click();
 await page.locator(".fox-files-tabs button").filter({hasText:"Таблицы"}).click();
 await page.getByTitle("Открыть запись").first().click();
 await expect(page.locator(".table-image-preview img")).toBeVisible();
});
