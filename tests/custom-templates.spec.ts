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

test("entire nested page hierarchy installs as a new reusable workspace",async({page})=>{
  await page.evaluate(()=>{
    localStorage.setItem("fox-screens",JSON.stringify([
      {id:"root",name:"Клиентская работа"},
      {id:"child",name:"Документы",parentId:"root"},
      {id:"grandchild",name:"Сметы",parentId:"child"}
    ]));
    localStorage.setItem("fox-editor-widgets-v1",JSON.stringify({
      root:[{id:"a",type:"heading",title:"Работа",width:12,height:110,body:"Главная",filter:{}}],
      child:[{id:"b",type:"text",title:"Документы",width:6,height:200,body:"Внутренняя страница",filter:{}}],
      grandchild:[{id:"c",type:"table",title:"Расходы",tableId:"existing-data",width:12,height:280,filter:{}}]
    }));
    localStorage.setItem("fox-screen-grid-v1",JSON.stringify({
      root:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{a:{x:0,y:0,w:12,h:2}}},
      child:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{b:{x:1,y:1,w:6,h:3}}},
      grandchild:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{c:{x:0,y:0,w:12,h:4}}}
    }));
  });
  await page.reload();
  await page.locator(".dock-screen").first().click();
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  page.once("dialog",dialog=>dialog.accept("Моя студия"));
  await page.getByRole("button",{name:"Сохранить дерево как шаблон"}).click();
  const template=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-custom-screen-templates-v1")??"[]")[0]);
  expect(template.pages).toHaveLength(3);
  await page.locator(".dock-add").click();
  await page.locator(".fox-custom-template-row .fox-preset-card").filter({hasText:"Моя студия"}).click();
  const installed=await page.evaluate(()=>{
    const screens=JSON.parse(localStorage.getItem("fox-screens")??"[]");
    const widgets=JSON.parse(localStorage.getItem("fox-editor-widgets-v1")??"{}");
    const grid=JSON.parse(localStorage.getItem("fox-screen-grid-v1")??"{}");
    return {screens,widgets,grid};
  });
  expect(installed.screens).toHaveLength(6);
  const [root,child,grandchild]=installed.screens.slice(3);
  expect(child.parentId).toBe(root.id);
  expect(grandchild.parentId).toBe(child.id);
  expect(installed.widgets[grandchild.id][0].tableId).toBe("existing-data");
  expect(installed.widgets[grandchild.id][0].id).not.toBe("c");
  expect(installed.grid[grandchild.id].positions[installed.widgets[grandchild.id][0].id]).toEqual({x:0,y:0,w:12,h:4});
  await expect(page.getByRole("complementary",{name:"Дерево экранов"})).toContainText("Документы");
});
