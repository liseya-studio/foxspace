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
  await expect(page.locator(".fox-item-title-label input")).toHaveValue("Проверить макет");
  await page.getByRole("button",{name:"Закрыть"}).last().click();
  await expect(page.getByText("Проверить макет").first()).toBeVisible();
  await info.attach("tasks", {body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("create custom screen with a local text widget", async ({page},info)=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  await expect(page.getByText("FOX EDITOR", {exact:true})).toBeVisible();
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

test("data widgets can be placed and persisted before a table exists", async ({page},info)=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  const editor=page.locator(".fox-editor");
  await expect(editor).toBeVisible();
  const types=["Показатель","Счётчик записей","Прогресс","Столбчатый график","Линейный график","Круговая диаграмма","Хронология","Таблица","Список"];
  for(const type of types){
    await editor.locator(".fox-editor-toolbar .outline-button").filter({hasText:"Виджет"}).click();
    const card=editor.locator(".fox-editor-library button").filter({has:page.locator("b",{hasText:type})});
    await expect(card).toBeEnabled();
    await card.click();
  }
  await expect(page.locator(".fox-widget")).toHaveCount(types.length);
  await expect(page.getByText("Подключите данные").first()).toBeVisible();
  await page.reload();
  await page.locator(".dock-screen-name").first().click();
  await expect(page.locator(".fox-widget")).toHaveCount(types.length);
  await page.locator(".fox-widget").first().getByRole("button",{name:"Выбрать источник"}).click();
  await expect(page.getByText("Источник данных")).toBeVisible();
  await expect(page.getByRole("button",{name:"Создать таблицу"})).toBeVisible();
  await info.attach("unconnected-widgets",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("public feed has the requested Telegram and VK sources and verified posts", async ({page})=>{
  await page.getByRole("button",{name:"Лента"}).click();
  await expect(page.getByRole("heading",{name:"Лента"})).toBeVisible();
  await expect(page.getByText("Telegram · @bulotkaff").first()).toBeVisible();
  await expect(page.getByText("ВКонтакте · btsah").first()).toBeVisible();
  const api=await page.request.get("/feed.json");
  expect(api.ok()).toBeTruthy();
  const payload=await api.json() as {sources:{id:string;status:string}[];posts:{sourceId:string;url:string}[]};
  expect(payload.sources).toHaveLength(2);
  for(const post of payload.posts) {
    expect(["telegram-bulotkaff","vk-btsah"]).toContain(post.sourceId);
    expect(post.url.startsWith("https://")).toBeTruthy();
  }
});

test("real feed sources show Telegram and VK source states", async ({page},info)=>{
  await page.getByRole("button",{name:"Лента",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Лента"})).toBeVisible();
  await expect(page.getByText("Telegram · @bulotkaff").first()).toBeVisible();
  await expect(page.getByText("ВКонтакте · btsah").first()).toBeVisible();
  await expect(page.getByRole("link",{name:/Открыть источник/})).toHaveCount(2);
  await info.attach("feed",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});
