import {test,expect} from "@playwright/test";
import {valueForColumn,filterRows,aggregateRows,type TableData} from "../src/features/tables/values";
import {createImportDraft,mergeExcelIntoTable} from "../src/features/tables/excelImport";

test("blank formula operands stay blank, while numeric zero is retained",()=>{
 const table:TableData={id:"t",name:"Тест",columns:[
  {id:"amount",name:"Сумма",type:"number"},
  {id:"calc",name:"Расчёт",type:"formula",formulaSourceId:"amount",formulaFactor:2,formulaOperator:"*"}
 ],rows:[{id:"empty",cells:{}},{id:"zero",cells:{amount:0}},{id:"filled",cells:{amount:7}}]};
 expect(valueForColumn(table.rows[0],table.columns[1],[table])).toBeUndefined();
 expect(valueForColumn(table.rows[1],table.columns[1],[table])).toBe(0);
 expect(valueForColumn(table.rows[2],table.columns[1],[table])).toBe(14);
 expect(aggregateRows(table.rows,table.columns[1],[table],"average")).toBe(7);
});

test("multi-choice exact filtering matches an individual choice",()=>{
 const table:TableData={id:"t",name:"Test",columns:[{id:"tags",name:"Теги",type:"multiselect"}],rows:[
 {id:"a",cells:{tags:JSON.stringify(["Видео","Монтаж"])}},
 {id:"b",cells:{tags:JSON.stringify(["Видеосъёмка"])}}
 ]};
 expect(filterRows(table.rows,table,[table],{columnId:"tags",operator:"equals",value:"видео"}).map(r=>r.id)).toEqual(["a"]);
 expect(filterRows(table.rows,table,[table],{columnId:"tags",operator:"not_equals",value:"видео"}).map(r=>r.id)).toEqual(["b"]);
});

test("Excel retains observed options absent from an old dropdown validation",()=>{
 let counter=0;const id=()=>String(++counter);
 const draft=createImportDraft("Заказы",[
  ["Статус","Теги"],["Архив","Видео; Сложный"],["Новый","Видео"]
 ],{0:["Новый","В работе"],1:["Видео","Монтаж"]},id);
 const table=mergeExcelIntoTable(draft,undefined,id);
 expect(table.columns[0].options).toEqual(["Новый","В работе","Архив"]);
 expect(table.columns[1].options).toEqual(["Видео","Монтаж","Сложный"]);
 expect(JSON.parse(String(table.rows[0].cells[table.columns[1].id]))).toEqual(["Видео","Сложный"]);
});

test("scheduled local automation creates a task once without notification permission",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 const result=await page.evaluate(async()=>{
  const {saveAutomations,runDueAutomations,readAutomations}=await import("/src/features/automations/data.ts");
  const {readNotesTasks}=await import("/src/features/notes/data.ts");
  const clock=new Date(2026,10,23,10,30);
  saveAutomations({version:1,notificationsEnabled:false,history:[],items:[{
   id:"local-1",name:"Сделать отчёт",message:"Проверить показатели",
   action:"create_task",trigger:"schedule",cadence:"daily",date:"2026-11-23",
   weekday:1,time:"09:00",enabled:true,lastRunKey:null,lastRunAt:null,
   createdAt:clock.toISOString(),updatedAt:clock.toISOString()
  }]});
  await runDueAutomations(clock);
  await runDueAutomations(clock);
  return {tasks:readNotesTasks().tasks,history:readAutomations().history};
 });
 expect(result.tasks).toHaveLength(1);
 expect(result.tasks[0].title).toBe("Сделать отчёт");
 expect(result.history).toHaveLength(1);
 expect(result.history[0].status).toBe("completed");
});

test("date filter compares calendar dates without timezone coercion",()=>{
 const table:TableData={id:"date",name:"Даты",columns:[{id:"day",name:"Дата",type:"date"}],rows:[
  {id:"before",cells:{day:"2026-11-22"}},
  {id:"equal",cells:{day:"2026-11-23"}},
  {id:"after",cells:{day:"2026-11-24"}}
 ]};
 expect(filterRows(table.rows,table,[table],{columnId:"day",operator:"gt",value:"2026-11-23"}).map(r=>r.id)).toEqual(["after"]);
 expect(filterRows(table.rows,table,[table],{columnId:"day",operator:"lt",value:"2026-11-23"}).map(r=>r.id)).toEqual(["before"]);
});

test("Excel safely upgrades empty text columns to choice fields but leaves populated columns unchanged",()=>{
 let number=0;const id=()=>String(++number);
 const draft=createImportDraft("Сделки",[["Статус"],["В работе"]],{0:["Новый","В работе"]},id);
 const base={id:"table",name:"Сделки",columns:[{id:"status",name:"Статус",type:"text"}],rows:[{id:"old",cells:{status:""}}]};
 const upgraded=mergeExcelIntoTable(draft,base,id);
 expect(upgraded.columns[0].type).toBe("select");
 expect(upgraded.columns[0].options).toEqual(["Новый","В работе"]);
 const populated=mergeExcelIntoTable(draft,{...base,rows:[{id:"old",cells:{status:"Пользовательский текст"}}]},id);
 expect(populated.columns[0].type).toBe("text");
 expect(populated.rows[0].cells.status).toBe("Пользовательский текст");
});

test("monthly automation scheduled for the 31st runs on February's last day",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 const result=await page.evaluate(async()=>{
  const {saveAutomations,runDueAutomations,readAutomations}=await import("/src/features/automations/data.ts");
  const {readNotesTasks}=await import("/src/features/notes/data.ts");
  const onLastDay=new Date(2027,1,28,10,30);
  saveAutomations({version:1,notificationsEnabled:false,history:[],items:[{
   id:"month-end",name:"Закрыть месяц",message:"Проверить отчёт",action:"create_task",
   trigger:"schedule",cadence:"monthly",monthlyDay:31,date:"2027-01-31",
   weekday:0,time:"09:00",enabled:true,lastRunKey:null,lastRunAt:null,
   createdAt:onLastDay.toISOString(),updatedAt:onLastDay.toISOString()
  }]});
  await runDueAutomations(onLastDay);
  await runDueAutomations(onLastDay);
  return {tasks:readNotesTasks().tasks,history:readAutomations().history};
 });
 expect(result.tasks).toHaveLength(1);
 expect(result.tasks[0].title).toBe("Закрыть месяц");
 expect(result.history).toHaveLength(1);
});

test("Excel import never overwrites formula or relation columns with the same display name",()=>{
 let n=0;const id=()=>String(++n);
 const draft=createImportDraft("Финансы",[["Итого","Клиент"],[1250,"Новый клиент"]],{},id);
 const base:TableData={id:"finance",name:"Финансы",columns:[
  {id:"total",name:"Итого",type:"formula",formulaSourceId:"amount",formulaFactor:1,formulaOperator:"*"},
  {id:"client",name:"Клиент",type:"relation",relationTableId:"clients"}
 ],rows:[{id:"existing",cells:{amount:100,total:100,client:"client-1"}}]};
 const result=mergeExcelIntoTable(draft,base,id);
 expect(result.columns.find(column=>column.id==="total")?.type).toBe("formula");
 expect(result.columns.find(column=>column.id==="client")?.type).toBe("relation");
 expect(result.columns.some(column=>column.name==="Итого (Импорт 2)"&&column.type==="number")).toBeTruthy();
 expect(result.columns.some(column=>column.name==="Клиент (Импорт 2)"&&column.type==="text")).toBeTruthy();
 expect(result.rows[1].cells.total).toBeUndefined();
 expect(result.rows[1].cells.client).toBeUndefined();
});

test("Excel import adds observed values to an existing choice column even when inference says text",()=>{
 let n=0;const id=()=>String(++n);
 const draft=createImportDraft("Заказы",[["Статус"],["Отложен"],["В работе"]],{},id);
 const base={id:"orders",name:"Заказы",columns:[{id:"status",name:"Статус",type:"select",options:["Новый"]}],rows:[]};
 const result=mergeExcelIntoTable(draft,base,id);
 expect(result.columns[0].options).toEqual(["Новый","Отложен","В работе"]);
});

test("older backups without widget-column preferences remain restorable",async({page})=>{
 await page.goto("/");
 const result=await page.evaluate(async()=>{
  const {inspectBackup}=await import("/src/features/backup/backup.ts");
  const records={
   "fox-screens":[],"fox-theme":"light","fox-accent":"#f06432","fox-tables-v1":[],
   "fox-notes-tasks-v1":{notes:[],tasks:[]},"fox-editor-widgets-v1":{},"fox-screen-grid-v1":{},
   "fox-projects-v1":{version:1,projects:[]},"fox-operations-v1":{version:1,transactions:[],publications:[],budgets:[],ledger:[],audience:[]},
   "fox-trackers-v1":{version:1,trackers:[]},"fox-agent-policies-v1":[],"fox-audit-log-v1":[],
   "fox-automations-v1":{version:1,items:[],history:[],notificationsEnabled:false},"fox-agent-pending-v1":[]
  };
  const file=new File([JSON.stringify({format:"fox-space-backup-v1",createdAt:"2026-01-01T00:00:00.000Z",records,files:[]})],"old-backup.json",{type:"application/json"});
  const inspected=await inspectBackup(file);
  return {summary:inspected.summary,preferences:inspected.backup.records["fox-widget-table-columns-v1"]};
 });
 expect(result.preferences).toEqual({});
 expect(result.summary).toContain("старый архив без контрольной суммы");
});
