import { test, expect } from "@playwright/test";

async function openScreenEditor(page:import("@playwright/test").Page){
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  await page.getByRole("button",{name:"Редактировать экран"}).click();
}

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
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
  await openScreenEditor(page);
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
  await openScreenEditor(page);
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
  await openScreenEditor(page);
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

test("ready-made travel dashboard has a clickable offline world map",async({page},info)=>{
  await page.locator(".dock-add").click();
  await expect(page.getByText("Готовые экраны")).toBeVisible();
  await page.locator(".fox-preset-list button").filter({hasText:"Путешествия"}).click();
  await expect(page.getByRole("heading",{name:"Путешествия",exact:true}).first()).toBeVisible();
  const map=page.getByRole("img",{name:"Интерактивная карта стран мира"});
  await expect(map).toBeVisible();
  await expect(map.locator("path.fox-worldmap-country").first()).toBeVisible();
  await map.locator("path.fox-worldmap-country").first().evaluate(element=>element.dispatchEvent(new MouseEvent("click",{bubbles:true})));
  await expect(page.locator(".fox-worldmap-details strong")).toBeVisible();
  await info.attach("travel-map",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  await page.reload();
  await page.locator(".dock-screen-name").first().click();
  await expect(map).toBeVisible();
});

test("relationship template starts without invented personal dates",async({page})=>{
  await page.locator(".dock-add").click();
  await page.getByRole("button",{name:/Наши отношения/}).click();
  await expect(page.getByText("Выберите дату начала в настройках")).toBeVisible();
  await expect(page.locator(".fox-widget")).toHaveCount(6);
});

test("platform icon gallery can change a screen dock icon",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  await page.getByRole("button",{name:"Изменить значок"}).click();
  await expect(page.getByRole("heading",{name:"Выберите значок"})).toBeVisible();
  await page.getByRole("button",{name:"Telegram"}).click();
  await expect(page.locator(".dock-screen .fox-platform-icon")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".dock-screen .fox-platform-icon")).toHaveCount(1);
});

test("a workbook-style import fills an existing empty travel template without losing map linkage",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Путешествия"}).click();
  const before=await page.evaluate(()=>{
    const screens=JSON.parse(localStorage.getItem("fox-screens")??"[]");
    return {id:screens[0].tableId,tables:JSON.parse(localStorage.getItem("fox-tables-v1")??"[]").length};
  });
  await page.getByRole("button",{name:"Файлы и таблицы"}).click();
  const sample=["ISO A3;Страна;Город;Количество городов;Дата въезда","FRA;France;Paris;1;2024-08-01",""].join(String.fromCharCode(10));
  await page.locator(".fox-file-header input[type=file]").first().setInputFiles({name:"Путешествия (поездки).csv",mimeType:"text/csv",buffer:Buffer.from(sample)});
  await expect(page.getByText("Путешествия (поездки).csv")).toBeVisible();
  await page.getByTitle("Импортировать как таблицу").click();
  await expect.poll(async()=>{ const issue=await page.locator(".fox-file-error").allInnerTexts(); if(issue.length)throw Error("Ошибка импорта: "+issue.join("; ")); return page.evaluate(()=>{
    const tables=JSON.parse(localStorage.getItem("fox-tables-v1")??"[]");
    const screens=JSON.parse(localStorage.getItem("fox-screens")??"[]");
    return tables.find((t:{id:string})=>t.id===screens[0].tableId)?.rows.length??0;
  }); },{timeout:10000}).toBe(1);
  const after=await page.evaluate(()=>{
    const tables=JSON.parse(localStorage.getItem("fox-tables-v1")??"[]");
    const screens=JSON.parse(localStorage.getItem("fox-screens")??"[]");
    return {id:screens[0].tableId,tables:tables.length,rows:tables.find((t:{id:string})=>t.id===screens[0].tableId)?.rows.length};
  });
  expect(after.id).toBe(before.id);
  expect(after.tables).toBe(before.tables);
  expect(after.rows).toBe(1);
  await page.locator(".dock-screen-name").first().click();
  await expect(page.getByText("1 стран с записями")).toBeVisible();
});

test("feed gallery keeps every image in a multi-photo album",async({page})=>{
  const media=Array.from({length:9},(_,index)=>"https://example.com/image-"+index+".jpg");
  await page.route("**/feed.json?*",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
    generatedAt:"2026-11-14T15:00:00Z",
    sources:[{id:"telegram-bulotkaff",platform:"telegram",title:"Telegram · @bulotkaff",url:"https://t.me/bulotkaff",status:"ok",message:"Загружено публикаций: 1"}],
    posts:[{id:"tg:gallery",sourceId:"telegram-bulotkaff",text:"Альбом из девяти изображений",url:"https://t.me/bulotkaff/1",date:"2026-11-14T15:00:00Z",images:media}]
  })}));
  await page.getByRole("button",{name:"Лента",exact:true}).click();
  await expect(page.locator(".fox-feed-gallery img")).toHaveCount(9);
  await expect(page.locator(".fox-feed-gallery a")).toHaveCount(9);
});

test("dropdowns share centered arrows and consistent right inset",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Мои финансы"}).click();
  await openScreenEditor(page);
  await expect(page.locator(".fox-editor-source select")).toBeVisible();
  const source=await page.locator(".fox-editor-source select").evaluate(node=>{
    const css=getComputedStyle(node);
    return {appearance:css.appearance,image:css.backgroundImage,padding:parseFloat(css.paddingRight),position:css.backgroundPosition};
  });
  expect(source.appearance).toBe("none");
  expect(source.image).toContain("svg");
  expect(source.padding).toBeGreaterThanOrEqual(32);
  expect(source.position).toMatch(/right|calc\(100% - 10px\)/);
  await page.locator(".fox-widget").filter({hasText:"Обязательные платежи"}).first().click();
  const inspector=page.locator(".fox-editor-fields select").first();
  await expect(inspector).toBeVisible();
  const inset=await inspector.evaluate(node=>parseFloat(getComputedStyle(node).paddingRight));
  expect(inset).toBeGreaterThanOrEqual(32);
});

test("widgets resize from borders only in page editor",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Мои финансы"}).click();
  await openScreenEditor(page);
  const widget=page.locator(".fox-widget").last();
  await expect(widget).toBeVisible();
  await widget.evaluate(node=>node.scrollIntoView({block:"center",behavior:"auto"}));
  await expect(widget.locator(".fox-widget-resize")).toHaveCount(0);
  await expect(widget.locator(".fox-widget-edge")).toHaveCount(4);
  const before=await widget.evaluate(node=>({width:getComputedStyle(node).gridColumnEnd,height:node.getBoundingClientRect().height}));
  const border=widget.locator(".fox-widget-edge-bottom");
  const bounds=await border.boundingBox();
  if(!bounds)throw Error("Bottom edge is missing");
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
  await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2+80,{steps:7});
  await page.mouse.up();
  const after=await widget.evaluate(node=>node.getBoundingClientRect().height);
  expect(after).toBeGreaterThan(before.height+25);
  await page.getByRole("button",{name:"Готово"}).click();
  await expect(page.locator(".fox-widget-edge")).toHaveCount(0);
});

test("home offers ready-to-use templates without giant empty hero",async({page})=>{
  await expect(page.locator(".fox-home-template")).toHaveCount(4);
  await expect(page.getByRole("heading",{name:"Начните с шаблона"})).toBeVisible();
  await page.locator(".fox-home-template").filter({hasText:"Мои финансы"}).click();
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
  await openScreenEditor(page);
  await expect(page.getByText("FOX EDITOR",{exact:true})).toBeVisible();
});

test("world map stays clipped within its card when zoomed",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Путешествия"}).click();
  const map=page.locator(".fox-worldmap-surface");
  await expect(map).toBeVisible();
  await page.getByRole("button",{name:"Приблизить карту"}).click();
  await page.getByRole("button",{name:"Приблизить карту"}).click();
  const bounds=await map.evaluate(node=>{
    const svg=node.querySelector("svg");
    const container=node.getBoundingClientRect();
    const image=svg?.getBoundingClientRect();
    return {height:container.height,svgHeight:image?.height||0,width:container.width,svgWidth:image?.width||0,overflow:getComputedStyle(node).overflow};
  });
  expect(bounds.overflow).toBe("hidden");
  expect(bounds.svgWidth).toBeLessThanOrEqual(bounds.width+1);
  expect(bounds.svgHeight).toBeLessThanOrEqual(bounds.height+1);
});

test("Dock opens a ready-made screen in read-only mode; editing is in screen actions",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Путешествия"}).click();
  await expect(page.getByRole("heading",{name:"Путешествия",exact:true}).first()).toBeVisible();
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
  await expect(page.locator(".fox-editor-sidebar")).toHaveCount(0);
  await expect(page.locator(".fox-widget-edge")).toHaveCount(0);
  await expect(page.locator(".dock-screen .screen-more")).toHaveCount(0);
  await openScreenEditor(page);
  await expect(page.getByText("FOX EDITOR",{exact:true})).toBeVisible();
  await expect(page.locator(".fox-widget-edge").first()).toBeAttached();
  await page.getByRole("button",{name:"Готово"}).click();
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
  await page.locator(".dock-screen-name").first().click();
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
});

test("approved finance screen uses ten cards and saves real entries from plus buttons",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Мои финансы"}).click();
  await expect(page.locator(".finance-dashboard-grid .fox-finance-card")).toHaveCount(10);
  await expect(page.locator(".fox-editor-toolbar")).toHaveCount(0);
  await expect(page.locator(".fox-finance-income .finance-add")).toBeVisible();
  const first=page.locator(".fox-finance-income .finance-add");
  await first.click();
  await expect(page.getByRole("dialog",{name:"Добавить доход"})).toBeVisible();
  await page.locator(".finance-modal input").nth(0).fill("Фриланс");
  await page.locator(".finance-modal input").nth(1).fill("15000");
  await page.locator(".finance-modal input").nth(2).fill("Работа");
  await page.getByRole("dialog",{name:"Добавить доход"}).getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.getByText("Фриланс").first()).toBeVisible();
  await page.locator(".fox-finance-expense .finance-add").click();
  await page.locator(".finance-modal input").nth(0).fill("Продукты");
  await page.locator(".finance-modal input").nth(1).fill("2500");
  await page.getByRole("dialog",{name:"Добавить расход"}).getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.locator(".fox-finance-recent .finance-entry")).toHaveCount(2);
  await page.locator(".fox-finance-payments .finance-add").click();
  await page.locator(".finance-modal input").nth(0).fill("Аренда");
  await page.locator(".finance-modal input").nth(1).fill("17000");
  await page.locator(".finance-modal input").last().fill("2026-12-25");
  await page.getByRole("dialog",{name:"Добавить обязательный платёж"}).getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.getByText("Аренда").first()).toBeVisible();
  await page.locator(".fox-finance-debts .finance-add").click();
  await page.locator(".finance-modal input").nth(0).fill("Банк");
  await page.locator(".finance-modal input").nth(1).fill("3000");
  await page.getByRole("dialog",{name:"Добавить долг"}).getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.locator(".finance-debt.negative")).toHaveCount(1);
  await page.locator(".fox-finance-goals .finance-add").click();
  await page.locator(".finance-modal input").nth(0).fill("Компьютер");
  await page.locator(".finance-modal input").nth(1).fill("100000");
  await page.locator(".finance-modal input").nth(2).fill("25000");
  await page.getByRole("dialog",{name:"Добавить финансовую цель"}).getByRole("button",{name:"Добавить",exact:true}).click();
  await expect(page.getByText("Компьютер")).toBeVisible();
  const tableSizes=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-tables-v1")??"[]").filter((t:{name:string})=>t.name.startsWith("ФИНАНСЫ")).map((t:{name:string;rows:unknown[]})=>[t.name,t.rows.length]));
  expect(tableSizes).toHaveLength(4);
  expect(tableSizes.map((item:[string,number])=>item[1]).sort()).toEqual([1,1,1,2]);
  await page.reload();
  await page.locator(".dock-screen-name").first().click();
  await expect(page.locator(".fox-finance-recent .finance-entry")).toHaveCount(2);
  await expect(page.locator(".fox-finance-goals .finance-goal")).toHaveCount(1);
  const row1=await page.locator(".fox-finance-balance").boundingBox();
  const mid=await page.locator(".fox-finance-trend").boundingBox();
  const right=await page.locator(".fox-finance-income").boundingBox();
  expect(row1).toBeTruthy();expect(mid).toBeTruthy();expect(right).toBeTruthy();
  expect(Math.abs(row1!.y-mid!.y)).toBeLessThan(2);
  expect(Math.abs(row1!.y-right!.y)).toBeLessThan(2);
});
