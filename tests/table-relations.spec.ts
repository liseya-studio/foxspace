import { test, expect } from "@playwright/test";
import { relationIds, valueForColumn, aggregateRows, filterRows, type TableData } from "../src/features/tables/values";
import { SCREEN_PRESETS, instantiatePreset } from "../src/features/templates/screenPresets";

const projects:TableData={
  id:"projects",name:"Проекты",
  columns:[
    {id:"name",name:"Название",type:"text"},
    {id:"links",name:"Задачи",type:"backlink",backlinkSourceTableId:"tasks",backlinkSourceColumnId:"taskProjects"},
    {id:"taskCount",name:"Количество задач",type:"rollup",rollupRelationId:"links",rollupAggregate:"count"},
    {id:"totalHours",name:"Общие часы",type:"rollup",rollupRelationId:"links",rollupTargetId:"hours",rollupAggregate:"sum"}
  ],
  rows:[
    {id:"project-a",cells:{name:"Fox Space"}},
    {id:"project-b",cells:{name:"FoxCut"}}
  ]
};
const tasks:TableData={
  id:"tasks",name:"Задачи",
  columns:[
    {id:"title",name:"Название",type:"text"},
    {id:"taskProjects",name:"Проекты",type:"relation",relationTableId:"projects",relationMultiple:true},
    {id:"hours",name:"Часы",type:"number"}
  ],
  rows:[
    {id:"task-1",cells:{title:"Базы данных",taskProjects:"project-a,project-b",hours:4}},
    {id:"task-2",cells:{title:"Виджеты",taskProjects:"project-a",hours:3}},
    {id:"task-3",cells:{title:"Дизайн",taskProjects:"",hours:2}}
  ]
};
const tables=[projects,tasks];

test("multiple relations resolve names while preserving IDs",()=>{
  expect(relationIds("project-a,project-b")).toEqual(["project-a","project-b"]);
  expect(relationIds("")).toEqual([]);
  expect(valueForColumn(tasks.rows[0],tasks.columns[1],tables)).toBe("Fox Space, FoxCut");
  expect(valueForColumn(tasks.rows[2],tasks.columns[1],tables)).toBe("");
});

test("backlinks are derived automatically from the forward relation",()=>{
  expect(valueForColumn(projects.rows[0],projects.columns[1],tables)).toBe("Базы данных, Виджеты");
  expect(valueForColumn(projects.rows[1],projects.columns[1],tables)).toBe("Базы данных");
  const renamed={...tasks,rows:[...tasks.rows.slice(0,1),{...tasks.rows[1],cells:{...tasks.rows[1].cells,taskProjects:"project-b"}},tasks.rows[2]]};
  expect(valueForColumn(projects.rows[0],projects.columns[1],[projects,renamed])).toBe("Базы данных");
});

test("rollups aggregate linked rows without duplicating values",()=>{
  expect(valueForColumn(projects.rows[0],projects.columns[2],tables)).toBe(2);
  expect(valueForColumn(projects.rows[0],projects.columns[3],tables)).toBe(7);
  expect(valueForColumn(projects.rows[1],projects.columns[3],tables)).toBe(4);
  expect(aggregateRows(projects.rows,projects.columns[3],tables,"sum")).toBe(11);
  expect(filterRows(projects.rows,projects,tables,{columnId:"taskCount",operator:"gt",value:"1"})).toHaveLength(1);
});

test("legacy single relations continue to work",()=>{
  const single={...tasks,rows:[{id:"legacy",cells:{title:"Старая задача",taskProjects:"project-a",hours:5}}]};
  expect(valueForColumn(single.rows[0],single.columns[1],[projects,single])).toBe("Fox Space");
});

test("binary formulas multiply two fields without disturbing legacy constant formulas",()=>{
  const table:TableData={id:"estimate",name:"Смета",columns:[
    {id:"qty",name:"Количество",type:"number"},
    {id:"price",name:"Цена",type:"number"},
    {id:"amount",name:"Сумма",type:"formula",formulaSourceId:"qty",formulaSecondSourceId:"price",formulaOperator:"*"},
    {id:"legacy",name:"Старый расчёт",type:"formula",formulaSourceId:"qty",formulaFactor:2,formulaOperator:"*"}
  ],rows:[{id:"row",cells:{qty:3,price:1200}}]};
  expect(valueForColumn(table.rows[0],table.columns[2],[table])).toBe(3600);
  expect(valueForColumn(table.rows[0],table.columns[3],[table])).toBe(6);
});

test("estimate screen generates configured formula from quantity and price",()=>{
  const preset=SCREEN_PRESETS.find(item=>item.id==="client-work");
  expect(preset).toBeDefined();
  const result=instantiatePreset(preset!,[]);
  const estimate=result.newTables.find(table=>table.name==="Работа · Смета");
  expect(estimate).toBeDefined();
  const formula=estimate!.columns.find(col=>col.name==="Сумма");
  const qty=estimate!.columns.find(col=>col.name==="Количество");
  const price=estimate!.columns.find(col=>col.name==="Цена");
  expect(formula).toMatchObject({formulaSourceId:qty?.id,formulaSecondSourceId:price?.id,formulaOperator:"*"});
});

test("screen templates wire real relations between lessons, projects and resources",()=>{
  for(const [template,source,field,target] of [
    ["learning","Обучение · Уроки","Направление","Обучение · Направления"],
    ["social","Блоги · Публикации","Ресурс","Блоги · Ресурсы"],
    ["client-work","Работа · Заказы","Клиент","Работа · Клиенты"],
    ["client-work","Работа · Оплаты","Заказ","Работа · Заказы"]
  ]){
    const preset=SCREEN_PRESETS.find(item=>item.id===template)!;
    const created=instantiatePreset(preset,[]);
    const table=created.newTables.find(item=>item.name===source)!;
    const targetTable=created.newTables.find(item=>item.name===target)!;
    const relation=table.columns.find(item=>item.name===field);
    expect(relation?.type).toBe("relation");
    expect((relation as typeof relation & {relationTableId?:string})?.relationTableId).toBe(targetTable.id);
  }
});

test("project templates provide reverse links and paid amounts without duplicate rows",()=>{
  const preset=SCREEN_PRESETS.find(item=>item.id==="client-work")!;
  const created=instantiatePreset(preset,[]);
  const orders=created.newTables.find(table=>table.name==="Работа · Заказы")!;
  const payments=created.newTables.find(table=>table.name==="Работа · Оплаты")!;
  const relatedPayments=orders.columns.find(col=>col.name==="Оплаты") as typeof orders.columns[number]&{backlinkSourceTableId?:string;backlinkSourceColumnId?:string};
  const link=payments.columns.find(col=>col.name==="Заказ") as typeof payments.columns[number]&{relationTableId?:string};
  const paid=orders.columns.find(col=>col.name==="Оплачено") as typeof orders.columns[number]&{rollupRelationId?:string;rollupTargetId?:string;rollupAggregate?:string};
  const amount=payments.columns.find(col=>col.name==="Сумма")!;
  expect(relatedPayments).toMatchObject({type:"backlink",backlinkSourceTableId:payments.id,backlinkSourceColumnId:link.id});
  expect(paid).toMatchObject({type:"rollup",rollupRelationId:relatedPayments.id,rollupTargetId:amount.id,rollupAggregate:"sum"});
  const budget=orders.columns.find(col=>col.name==="Бюджет")!;
  const remaining=orders.columns.find(col=>col.name==="Осталось")!;
  const orderRow={id:"order-1",cells:{[orders.columns[0].id]:"Сайт",[budget.id]:13000}};
  const paymentRow={id:"payment-1",cells:{[link.id]:"order-1",[amount.id]:4000,[payments.columns[0].id]:"Первая оплата"}};
  const all=[
    {...orders,rows:[orderRow]},
    {...payments,rows:[paymentRow]}
  ] as TableData[];
  expect(valueForColumn(orderRow,paid,all)).toBe(4000);
  expect(valueForColumn(orderRow,remaining,all)).toBe(9000);
});
