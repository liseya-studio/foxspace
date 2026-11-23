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

test("embedded table widget can display a selected column beyond its initial six",async({page})=>{
 await page.evaluate(()=>{
  localStorage.setItem("fox-screens",JSON.stringify([{id:"fields",name:"Поля"}]));
  localStorage.setItem("fox-tables-v1",JSON.stringify([{id:"fields-data",name:"Справочник",columns:Array.from({length:8},(_,i)=>({id:"c"+i,name:"Поле "+(i+1),type:"text"})),rows:[{id:"one",cells:{c0:"Начало",c7:"Последнее"}}]}]));
  localStorage.setItem("fox-editor-widgets-v1",JSON.stringify({fields:[{id:"fields-widget",type:"table",title:"Справочник",tableId:"fields-data",width:12,height:360,filter:{},limit:8,aggregate:"sum"}]}));
 });
 await page.reload();
 await page.locator(".dock-screen").first().click();
 const widget=page.locator(".fox-widget").first();
 await expect(widget.getByRole("columnheader",{name:"Поле 8"})).toHaveCount(0);
 await widget.locator(".fox-widget-column-picker summary").click();
 await widget.locator(".fox-widget-column-options").getByRole("checkbox",{name:"Поле 8"}).check();
 await expect(widget.getByRole("columnheader",{name:"Поле 8"})).toBeVisible();
 await expect(widget.getByText("Последнее")).toBeVisible();
 await page.reload();
 await page.locator(".dock-screen").first().click();
 await expect(page.locator(".fox-widget").first().getByRole("columnheader",{name:"Поле 8"})).toBeVisible();
});

test("bar widget groups numeric values by labels when grouping is enabled",async({page})=>{
 await page.evaluate(()=>{
  localStorage.setItem("fox-screens",JSON.stringify([{id:"report",name:"Аналитика"}]));
  localStorage.setItem("fox-tables-v1",JSON.stringify([{
   id:"sales",name:"Продажи",columns:[{id:"category",name:"Категория",type:"text"},{id:"amount",name:"Сумма",type:"number"}],
   rows:[{id:"a",cells:{category:"Видео",amount:1200}},{id:"b",cells:{category:"Видео",amount:800}},{id:"c",cells:{category:"Сайты",amount:3000}}]
  }]));
  localStorage.setItem("fox-editor-widgets-v1",JSON.stringify({report:[{id:"bar",type:"bars",title:"Расходы",tableId:"sales",columnId:"amount",labelColumnId:"category",groupBars:true,aggregate:"sum",width:12,height:300,limit:8}]}));
 });
 await page.reload();
 await page.locator(".dock-screen").first().click();
 const chart=page.locator(".fox-widget-bars");
 await expect(chart.locator(".fox-widget-bar-row")).toHaveCount(2);
 await expect(chart.getByText("Видео")).toBeVisible();
 await expect(chart.getByText("Сайты")).toBeVisible();
 await expect(chart.getByText("2 000")).toBeVisible();
});
