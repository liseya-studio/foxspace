import { test, expect } from "@playwright/test";
import { relationIds, valueForColumn, aggregateRows, filterRows, type TableData } from "../src/features/tables/values";

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
