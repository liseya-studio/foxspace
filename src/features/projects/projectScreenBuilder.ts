import type { WorkspaceSnapshot } from "../templates/workspaceTreeTemplates";

export type ProjectTable={
  id:string;
  name:string;
  columns:{id:string;name:string;type:string}[];
};

type Category="tasks"|"materials"|"finance"|"other";
function classify(name:string):Category{
  const title=name.toLocaleLowerCase("ru");
  if(/файл|документ|медиа|материал|референс|фото|изображен|asset|media|file|document/.test(title))return "materials";
  if(/финанс|смет|плат[её]ж|оплат|бюджет|расход|доход|invoice|payment|finance|expense|transaction|заказ/.test(title))return "finance";
  if(/задач|этап|дедлайн|план|task|milestone|todo|sprint/.test(title))return "tasks";
  return "other";
}

/**
 * Project workspaces use live views into existing tables. All widget filters
 * target the selected project's stable ID; no table or record is cloned.
 */
export function createProjectWorkspace(
  projectId:string,
  projectName:string,
  tables:ProjectTable[],
  createId:()=>string,
):WorkspaceSnapshot{
  const rootId=createId();
  const categories=[
    {key:"tasks" as const,name:"Задачи и этапы"},
    {key:"materials" as const,name:"Файлы и материалы"},
    {key:"finance" as const,name:"Финансы и сметы"}
  ];
  const pages=[{id:rootId,name:projectName,icon:"▣"},...categories.map(item=>({id:createId(),name:item.name,parentId:rootId,icon:"▤"}))];
  const widgetStore:WorkspaceSnapshot["widgetStore"]={};
  const gridStore:WorkspaceSnapshot["gridStore"]={};
  const connected=tables.flatMap(table=>table.columns
    .filter(column=>column.type==="project")
    .map(column=>({table,column,category:classify(table.name)})));
  const base=(type:string,title:string,body?:string)=>({
    id:createId(),type,title,body:body??"",width:12,height:type==="heading"?110:185,
    filter:{},limit:8,target:100,aggregate:"sum"
  });
  widgetStore[rootId]=[
    base("heading",projectName,"Обзор проекта, связанных таблиц и материалов"),
    ...connected.slice(0,9).map(({table,column})=>({
      ...base("counter",table.name),tableId:table.id,width:4,height:185,
      filter:{columnId:column.id,operator:"equals",value:projectId}
    }))
  ];
  if(connected.length===0)widgetStore[rootId].push(
    base("text","Подключите базу данных",
      "Добавьте в существующую таблицу поле типа «Проект» и выберите этот проект. Связанные данные автоматически появятся после обновления рабочего экрана.")
  );
  for(let index=0;index<categories.length;index++){
    const section=categories[index],page=pages[index+1];
    const matching=connected.filter(value=>value.category===section.key);
    widgetStore[page.id]=[
      base("heading",section.name,"Данные проекта из общих таблиц Fox Space"),
      ...matching.map(({table,column})=>({
        ...base("table",table.name),tableId:table.id,height:330,
        filter:{columnId:column.id,operator:"equals",value:projectId}
      }))
    ];
    if(!matching.length){
      widgetStore[page.id].push(base("text","Пока нет связанных таблиц",
        section.key==="materials"
        ?"Создайте таблицу материалов или документов и добавьте поле «Проект». Файлы можно хранить в таблице как изображения и вложения."
        :section.key==="finance"
        ?"Свяжите таблицу заказов, смет, платежей или расходов с этим проектом через поле «Проект»."
        :"Свяжите таблицу задач или этапов с этим проектом через поле «Проект»."));
    }
  }
  return {pages,widgetStore,gridStore};
}
