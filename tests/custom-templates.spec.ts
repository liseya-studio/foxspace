import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
});

test("user can save a composed screen as a reusable template with widget layout",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  await page.getByRole("button",{name:"Редактировать экран"}).click();
  await page.locator(".fox-editor-library button").filter({hasText:"Текст"}).click();
  await page.getByRole("button",{name:"Готово"}).click();
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  page.once("dialog",dialog=>dialog.accept("Мой экран"));
  await page.getByRole("button",{name:"Сохранить экран как шаблон"}).click();

  let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-custom-screen-templates-v1")||"[]"));
  expect(saved).toHaveLength(1);
  expect(saved[0].widgets).toHaveLength(1);
  expect(saved[0].layout?.positions).toBeDefined();

  await page.locator(".dock-add").click();
  await page.locator(".fox-custom-template-row .fox-preset-card").filter({hasText:"Мой экран"}).click();
  await expect(page.locator(".dock-screen")).toHaveCount(2);

  const stores=await page.evaluate(()=>({
    screens:JSON.parse(localStorage.getItem("fox-screens")||"[]"),
    widgets:JSON.parse(localStorage.getItem("fox-editor-widgets-v1")||"{}"),
    grids:JSON.parse(localStorage.getItem("fox-screen-grid-v1")||"{}")
  }));
  expect(stores.screens).toHaveLength(2);
  const first=stores.widgets[stores.screens[0].id];
  const second=stores.widgets[stores.screens[1].id];
  expect(second).toHaveLength(first.length);
  expect(second[0].id).not.toBe(first[0].id);
  expect(second[0].type).toBe(first[0].type);
  expect(stores.grids[stores.screens[1].id].positions[second[0].id]).toEqual(stores.grids[stores.screens[0].id].positions[first[0].id]);
});
