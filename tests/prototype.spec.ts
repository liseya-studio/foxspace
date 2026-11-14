import { test, expect } from "@playwright/test";

test.beforeEach(async ({page})=>{
  await page.goto("/");
  await page.evaluate(()=>{
    localStorage.clear();
    indexedDB.deleteDatabase("fox-space-files-v1");
  });
  await page.reload();
});

test("empty first-launch screens and primary navigation", async ({page},info)=>{
  await expect(page.getByText("Fox Space").first()).toBeVisible();
  await expect(page.getByText("Всё важное.")).toBeVisible();
  await info.attach("home", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  await page.getByRole("button",{name:"Файлы и таблицы"}).click();
  await expect(page.getByRole("button",{name:"Все",exact:true})).toBeVisible();
  await info.attach("files", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  await page.getByRole("button",{name:"Заметки и задачи"}).click();
  await expect(page.getByRole("heading",{name:"Заметки и задачи"})).toBeVisible();
  await info.attach("organizer", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("universal creation opens task and saves its content", async ({page},info)=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Задача"}).click();
  await expect(page.getByRole("heading",{name:"Новая задача"})).toBeVisible();
  await page.getByPlaceholder("Введите название").fill("Проверить макет");
  await page.locator(".dialog .primary-button").click();
  await expect(page.getByDisplayValue("Проверить макет")).toBeVisible();
  await page.getByRole("button",{name:"Закрыть"}).last().click();
  await expect(page.getByText("Проверить макет").first()).toBeVisible();
  await info.attach("tasks", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("create custom screen with a local text widget", async ({page},info)=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  await expect(page.getByText("FOX EDITOR")).toBeVisible();
  await page.getByRole("button",{name:"Виджет"}).click();
  await page.locator(".fox-editor-library button").filter({hasText:"Текст"}).click();
  await expect(page.locator(".fox-widget")).toHaveCount(1);
  await info.attach("editor", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("table creation saves empty editable table", async ({page},info)=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Таблица"}).click();
  await expect(page.getByText("Новая таблица").first()).toBeVisible();
  await page.locator(".dialog .form-input").fill("Проверка таблицы");
  await page.locator(".dialog .primary-button").click();
  await expect(page.getByText("Проверка таблицы").first()).toBeVisible();
  await info.attach("tables", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});
