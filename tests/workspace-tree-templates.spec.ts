import {test,expect} from "@playwright/test";
import {
  collectPageTree,captureWorkspaceTemplate,instantiateWorkspaceTemplate,persistWorkspaceSnapshot
} from "../src/features/templates/workspaceTreeTemplates";

const pages=[
  {id:"root",name:"Рабочее пространство",tableId:"projects"},
  {id:"child",name:"Проекты",parentId:"root",tableId:"projects"},
  {id:"sub",name:"Сметы",parentId:"child",tableId:"orders"},
  {id:"other",name:"Личная страница"}
];
const widgets={
  root:[{id:"w1",type:"table",tableId:"projects",targetScreenId:"child"}],
  child:[{id:"w2",type:"metric",tableId:"orders"}],
  sub:[{id:"w3",type:"counter",tableId:"orders"}]
};
const grids={
  root:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{w1:{x:0,y:0,w:6,h:3}}},
  child:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{w2:{x:1,y:2,w:4,h:3}}},
  sub:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{w3:{x:0,y:0,w:12,h:2}}}
};

test("tree capture includes only descendants and installs independent widget IDs",()=>{
  let i=0;const next=()=>`generated-${++i}`;
  expect(collectPageTree("root",pages).map(page=>page.id)).toEqual(["root","child","sub"]);
  const template=captureWorkspaceTemplate("root","Мой рабочий сетап",pages,widgets,grids,next);
  expect(template.pages).toHaveLength(3);
  expect(template.pages?.map(p=>p.name)).toEqual(["Рабочее пространство","Проекты","Сметы"]);
  const installed=instantiateWorkspaceTemplate(template,next);
  expect(installed.pages).toHaveLength(3);
  const [root,child,sub]=installed.pages;
  expect(root.parentId).toBeUndefined();
  expect(child.parentId).toBe(root.id);
  expect(sub.parentId).toBe(child.id);
  expect(root.tableId).toBe("projects");
  expect(installed.widgetStore[root.id][0].tableId).toBe("projects");
  expect(installed.widgetStore[root.id][0].targetScreenId).toBe(child.id);
  expect(installed.widgetStore[root.id][0].id).not.toBe("w1");
  expect(installed.gridStore[child.id].positions[installed.widgetStore[child.id][0].id]).toEqual(grids.child.positions.w2);
  // Capturing a template never mutates its source pages or layout.
  expect(pages[1].parentId).toBe("root");
  expect(widgets.root[0].targetScreenId).toBe("child");
});
test("old single-page templates remain installable",()=>{
  let counter=0;const next=()=>String(++counter);
  const installed=instantiateWorkspaceTemplate({
    id:"old",name:"Предыдущий шаблон",widgets:[{id:"old-w",type:"table",tableId:"main"}],
    layout:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{"old-w":{x:1,y:1,w:6,h:3}}}
  },next);
  expect(installed.pages).toHaveLength(1);
  expect(installed.widgetStore[installed.pages[0].id][0].tableId).toBe("main");
});
test("cycles and orphan pages do not hang tree traversal",()=>{
  const loop=[{id:"a",name:"A",parentId:"b"},{id:"b",name:"B",parentId:"a"},{id:"orphan",name:"Orphan",parentId:"missing"}];
  expect(collectPageTree("a",loop).map(page=>page.id)).toEqual(["a","b"]);
});
test("all screen stores are restored when a write fails",()=>{
  const original=new Map([["fox-editor-widgets-v1",'{"kept":[1]}'],["fox-screen-grid-v1",'{"kept":{"positions":{}}}']]);
  let writes=0;
  const fake={
    getItem:(key:string)=>original.get(key)??null,
    setItem:(key:string,value:string)=>{if(++writes===2)throw Error("quota");original.set(key,value);},
    removeItem:(key:string)=>{original.delete(key);}
  };
  const snapshot={pages:[],widgetStore:{new:[{id:"x"}]},gridStore:{new:{settings:{columns:12,rows:12,gap:8,rowHeight:64},positions:{}}}};
  expect(()=>persistWorkspaceSnapshot(fake,snapshot)).toThrow("quota");
  expect(original.get("fox-editor-widgets-v1")).toBe('{"kept":[1]}');
  expect(original.get("fox-screen-grid-v1")).toBe('{"kept":{"positions":{}}}');
});
