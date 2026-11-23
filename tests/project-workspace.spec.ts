import {test,expect} from "@playwright/test";
import {createProjectWorkspace} from "../src/features/projects/projectScreenBuilder";

test("project workspace produces child pages and live filtered database widgets",()=>{
  let counter=0;
  const next=()=>`generated-${++counter}`;
  const tables=[
    {id:"tasks",name:"Задачи команды",columns:[{id:"taskProject",name:"Проект",type:"project"},{id:"title",name:"Задача",type:"text"}]},
    {id:"media",name:"Документы и материалы",columns:[{id:"mediaProject",name:"Проект",type:"project"}]},
    {id:"payments",name:"Оплаты",columns:[{id:"paymentProject",name:"Проект",type:"project"}]},
    {id:"other",name:"Финансы общей кассы",columns:[{id:"name",name:"Название",type:"text"}]}
  ];
  const result=createProjectWorkspace("project-42","Мой продукт",tables,next);
  expect(result.pages).toHaveLength(4);
  const [root,...children]=result.pages;
  expect(children.map(page=>page.parentId)).toEqual([root.id,root.id,root.id]);
  expect(children.map(page=>page.name)).toEqual(["Задачи и этапы","Файлы и материалы","Финансы и сметы"]);
  const expected=[
    {table:"tasks",page:children[0].id,column:"taskProject"},
    {table:"media",page:children[1].id,column:"mediaProject"},
    {table:"payments",page:children[2].id,column:"paymentProject"}
  ];
  for(const link of expected){
    const widget=result.widgetStore[link.page].find(item=>item.tableId===link.table);
    expect(widget).toBeDefined();
    expect(widget?.filter).toEqual({columnId:link.column,operator:"equals",value:"project-42"});
  }
  expect(result.widgetStore[root.id].filter(item=>item.type==="counter")).toHaveLength(3);
  expect(Object.values(result.widgetStore).flat().some(item=>item.tableId==="other")).toBe(false);
});

test("empty project creates reusable sections without adding fake records",()=>{
  let counter=0;
  const result=createProjectWorkspace("p","Новый проект",[],()=>`id-${++counter}`);
  expect(result.pages).toHaveLength(4);
  for(const page of result.pages){
    const widgets=result.widgetStore[page.id];
    expect(widgets.some(widget=>widget.type==="heading")).toBe(true);
    expect(widgets.some(widget=>widget.type==="text")).toBe(true);
  }
  expect(result.gridStore).toEqual({});
});
