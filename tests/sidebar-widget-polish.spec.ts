import {test,expect} from "@playwright/test";

test.beforeEach(async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
});

test("workspace navigation stays in its own layout column and can collapse from topbar",async({page})=>{
  await page.locator(".dock-add").click();
  await page.locator(".fox-preset-list button").filter({hasText:"Путешествия"}).click();
  const nav=page.getByRole("complementary",{name:"Дерево экранов"});
  await expect(nav).toBeVisible();
  const main=page.locator(".main-area.has-page-tree");
  await expect(main).toBeVisible();
  const geometry=await page.evaluate(()=>{
    const menu=document.querySelector(".fox-page-tree")!.getBoundingClientRect();
    const content=document.querySelector(".main-area.has-page-tree > :not(.fox-page-tree)")!.getBoundingClientRect();
    return {menuRight:menu.right,contentLeft:content.left,menuPosition:getComputedStyle(document.querySelector(".fox-page-tree")!).position};
  });
  expect(geometry.menuPosition).toBe("sticky");
  expect(geometry.contentLeft).toBeGreaterThan(geometry.menuRight);
  await page.getByRole("button",{name:"Свернуть боковое меню"}).click();
  await expect(nav).toHaveClass(/is-hidden/);
  await expect(main).toHaveClass(/tree-collapsed/);
  await page.getByRole("button",{name:"Развернуть боковое меню"}).click();
  await expect(nav).not.toHaveClass(/is-hidden/);
  await page.reload();
  await page.locator(".dock-screen").first().click();
  await expect(nav).not.toHaveClass(/is-hidden/);
});

test("data widget tables show a search field, sorting and a sample row without creating records",async({page})=>{
  await page.evaluate(()=>{
    localStorage.setItem("fox-screens",JSON.stringify([{id:"sample",name:"Таблица на экране"}]));
    localStorage.setItem("fox-tables-v1",JSON.stringify([{
      id:"data",name:"Задачи",columns:[{id:"title",name:"Задача",type:"text"},{id:"done",name:"Готово",type:"checkbox"}],rows:[]
    }]));
    localStorage.setItem("fox-editor-widgets-v1",JSON.stringify({sample:[{
      id:"widget",type:"table",title:"Список задач",tableId:"data",width:12,height:360,filter:{},limit:8,target:100,aggregate:"sum"
    }]}));
  });
  await page.reload();
  await page.locator(".dock-screen").first().click();
  const widget=page.locator(".fox-widget").first();
  await expect(widget.getByRole("textbox",{name:"Поиск по таблице"})).toBeVisible();
  await expect(widget.getByRole("combobox",{name:"Сортировка таблицы"})).toBeVisible();
  await expect(widget.getByRole("row",{name:"Пример оформления строки"})).toBeVisible();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-tables-v1")??"[]"));
  expect(stored[0].rows).toHaveLength(0);
});
