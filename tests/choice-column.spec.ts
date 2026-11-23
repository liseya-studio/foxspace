import {test,expect} from "@playwright/test";
import {changeChoiceColumn} from "../src/features/tables/choiceColumn";

test("convert text labels to multiselect without losing records and options",()=>{
 const input={columns:[{id:"name",name:"Название",type:"text"},{id:"tags",name:"Теги",type:"text"}],rows:[
  {id:"one",cells:{name:"Монтаж",tags:"Видео; Срочно"}},
  {id:"two",cells:{name:"Сайт",tags:"Дизайн"}}
 ]};
 const changed=changeChoiceColumn(input,"tags","multiselect",["Срочно"]);
 expect(changed.columns[1].type).toBe("multiselect");
 expect(changed.columns[1].options).toEqual(["Срочно","Видео","Дизайн"]);
 expect(JSON.parse(changed.rows[0].cells.tags)).toEqual(["Видео","Срочно"]);
 expect(input.rows[0].cells.tags).toBe("Видео; Срочно");
 expect(input.columns[1].type).toBe("text");
});
test("multi-to-single refuses destructive conversion, text conversion is lossless",()=>{
 const table={columns:[{id:"tags",name:"Теги",type:"multiselect",options:["Видео","Срочно"]}],rows:[{id:"one",cells:{tags:'["Видео","Срочно"]'}}]};
 expect(()=>changeChoiceColumn(table,"tags","select",["Видео","Срочно"])).toThrow(/без потери данных/);
 expect(table.rows[0].cells.tags).toBe('["Видео","Срочно"]');
 expect(changeChoiceColumn(table,"tags","text",[]).rows[0].cells.tags).toBe("Видео; Срочно");
});
test("existing string values become selectable even when not in defined choices",()=>{
 const table={columns:[{id:"status",name:"Статус",type:"text"}],rows:[{id:"r1",cells:{status:"Завершено"}}]};
 const changed=changeChoiceColumn(table,"status","select",["Новый","В работе"]);
 expect(changed.columns[0].options).toEqual(["Новый","В работе","Завершено"]);
 expect(changed.rows[0].cells.status).toBe("Завершено");
});
test("existing text fields can be changed from table header",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>{
  localStorage.clear();
  localStorage.setItem("fox-tables-v1",JSON.stringify([{
   id:"table",name:"Материалы",updatedAt:new Date().toISOString(),
   columns:[{id:"title",name:"Название",type:"text"},{id:"tags",name:"Теги",type:"text"}],
   rows:[{id:"r1",cells:{title:"Видео",tags:"Срочно; Видео"}}]
  }]));
 });
 await page.reload();
 await page.getByRole("button",{name:"Файлы и таблицы"}).click();
 await page.locator(".fox-files-tabs button").filter({hasText:"Таблицы"}).click();
 await page.getByTitle("Настроить поле: Теги").click();
 const panel=page.getByRole("dialog",{name:"Настройка вариантов"});
 await panel.getByRole("combobox",{name:"Тип существующего поля"}).selectOption("multiselect");
 await panel.getByRole("textbox",{name:"Список вариантов"}).fill("Видео\nСрочно\nДизайн");
 await panel.getByRole("button",{name:"Сохранить поле"}).click();
 const table=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-tables-v1")??"[]")[0]);
 expect(table.columns[1].type).toBe("multiselect");
 expect(JSON.parse(table.rows[0].cells.tags)).toEqual(["Срочно","Видео"]);
 await expect(page.locator(".fox-multi-choice").first()).toContainText("Срочно");
});
