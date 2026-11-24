import type { StoredItem } from "./storage";

type Column={id:string;name:string;type:string;options?:string[]};
export type ImportedTable={id:string;name:string;columns:Column[];rows:{id:string;cells:Record<string,string|number|boolean>}[];updatedAt:string};
function splitRecords(input:string,separator:string):string[][]{
  const rows:string[][]=[];
  let row:string[]=[];
  let field="";
  let quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quoted=false;
      else field+=ch;
    }else{
      if(ch==='"'&&field==="")quoted=true;
      else if(ch===separator){row.push(field);field="";}
      else if(ch==="\n"){row.push(field.replace(/\r$/,""));rows.push(row);row=[];field="";}
      else field+=ch;
    }
    if(rows.length>10001)throw Error("Слишком много строк: максимум 10 000");
  }
  if(quoted)throw Error("Некорректное CSV: незакрытая кавычка");
  if(field||row.length){row.push(field.replace(/\r$/,""));rows.push(row);}
  return rows;
}
function guessDelimiter(text:string):string{
  const line=text.split(/\r?\n/,1)[0]??"";
  return [";",",","\t"].sort((a,b)=>line.split(b).length-line.split(a).length)[0];
}
function cellType(values:string[]):Column["type"]{
  const filled=values.map(v=>v.trim()).filter(Boolean);
  if(!filled.length)return "text";
  if(filled.every(v=>/^(true|false|да|нет)$/i.test(v)))return "checkbox";
  if(filled.every(v=>/^\d{4}-\d{2}-\d{2}$/.test(v)))return "date";
  if(filled.every(v=>/^-?(?:\d+)(?:[.,]\d+)?$/.test(v)))return "number";
  return "text";
}
export async function parseDelimitedFile(item:StoredItem):Promise<ImportedTable>{
  if(!item.blob)throw Error("Содержимое файла не найдено");
  if(item.size>8*1024*1024)throw Error("Файл больше 8 МБ: импортируйте меньший CSV");
  const text=(await item.blob.text()).replace(/^\uFEFF/,"");
  const delimiter=item.name.toLowerCase().endsWith(".tsv")?"\t":guessDelimiter(text);
  const records=splitRecords(text,delimiter).filter(row=>row.some(v=>v.trim()));
  if(records.length<1)throw Error("CSV пуст");
  const header=records[0];
  if(header.length>200)throw Error("В таблице может быть не более 200 колонок");
  if(records.length<2)throw Error("В файле нет записей");
  const names=new Set<string>();
  const columns:Column[]=header.map((rawName,index)=>{
    const original=rawName.trim()||"Поле "+(index+1);
    let name=original,suffix=2;
    while(names.has(name.toLocaleLowerCase("ru")))name=original+" ("+(suffix++)+")";
    names.add(name.toLocaleLowerCase("ru"));
    const values=records.slice(1).map(row=>row[index]??"");
    return {id:crypto.randomUUID(),name,type:cellType(values)};
  });
  const rows=records.slice(1).map(record=>{
    const cells:Record<string,string|number|boolean>={};
    columns.forEach((column,index)=>{
      const raw=(record[index]??"").trim();
      cells[column.id]=column.type==="number"?(raw?Number(raw.replace(",",".")):0):column.type==="checkbox"?/^(true|да)$/i.test(raw):raw;
    });
    return {id:crypto.randomUUID(),cells};
  });
  const table:ImportedTable={id:crypto.randomUUID(),name:item.name.replace(/\.(csv|tsv)$/i,""),columns,rows,updatedAt:new Date().toISOString()};
  return table;
}
export function persistImportedTables(tables:ImportedTable[]):void{
  if(!tables.length)return;
  let existing:ImportedTable[]=[];
  try{
    const parsed=JSON.parse(localStorage.getItem("fox-tables-v1")??"[]") as ImportedTable[];
    if(Array.isArray(parsed))existing=parsed;
  }catch{/* first import */}
  const normalize=(name:string)=>name.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]/gi,"");
  const next=[...existing];
  const incomingNames=new Set<string>();
  for(const imported of tables){
    const name=normalize(imported.name);
    if(incomingNames.has(name))throw Error("Два листа с одинаковым названием: «"+imported.name+"». Импорт отменён.");
    incomingNames.add(name);
    const matches=next.map((tab,index)=>({tab,index})).filter(({tab})=>{
      const oldName=normalize(tab.name);
      return oldName===name;
    });
    // An already populated table is never overwritten without explicit action.
    if(matches.some(({tab})=>tab.rows.length>0)){
      throw Error("Таблица «"+imported.name+"» уже содержит записи. Импорт остановлен, чтобы не потерять данные.");
    }
    if(matches.length>1)throw Error("Несколько пустых таблиц совпадают с «"+imported.name+"». Переименуйте лишние перед импортом.");
    if(matches.length===0){next.push(imported);continue;}
    const match=matches[0];
    const columns=[...match.tab.columns];
    const mapped=new Map<string,string>();
    for(const column of imported.columns){
      let target=columns.find(item=>normalize(item.name)===normalize(column.name));
      // Never map imported scalar values into computed, relation, image, person,
      // project, rollup, or backlink fields, even when their names match.
      if(target&&!["text","number","date","checkbox","select","multiselect"].includes(target.type))target=undefined;
      if(!target){
        let importedName=column.name,suffix=2;
        while(columns.some(item=>normalize(item.name)===normalize(importedName)))importedName=column.name+" (Импорт "+(suffix++)+")";
        target={...column,name:importedName};
        columns.push(target);
      }else if(target.type==="text"&&column.type!=="text"){
        // Imported column types can improve an empty placeholder's initial type.
        target={...target,type:column.type,options:column.options??target.options};
        const at=columns.findIndex(item=>item.id===target!.id);
        columns[at]=target;
      }
      if(target.type==="select"||target.type==="multiselect"){
        const observed=imported.rows.flatMap(row=>{
          const raw=row.cells[column.id];
          if(raw===undefined||raw===null||String(raw).trim()==="")return [];
          if(target!.type==="multiselect"){
            try{const parsed=JSON.parse(String(raw));if(Array.isArray(parsed))return parsed.map(String).filter(Boolean);}catch{/* delimited text */}
            return String(raw).split(/[;,|\n]/).map(value=>value.trim()).filter(Boolean);
          }
          return [String(raw).trim()];
        });
        const merged=[...new Set([...(target.options??[]),...(column.options??[]),...observed])];
        const position=columns.findIndex(item=>item.id===target!.id);
        columns[position]={...target,options:merged};
      }
      mapped.set(column.id,target.id);
    }
    const rows=imported.rows.map(row=>({
      id:row.id,
      cells:Object.fromEntries(Object.entries(row.cells).map(([id,value])=>{
        const target=columns.find(column=>column.id===mapped.get(id));
        if(target?.type==="multiselect"&&value!==undefined&&value!==null){
          try{const parsed=JSON.parse(String(value));if(Array.isArray(parsed))return [mapped.get(id)??id,JSON.stringify(parsed)];}catch{/* delimiter-based input */}
          return [mapped.get(id)??id,JSON.stringify(String(value).split(/[;,|\n]/).map(part=>part.trim()).filter(Boolean))];
        }
        return [mapped.get(id)??id,value];
      }))
    }));
    next[match.index]={...match.tab,columns,rows,updatedAt:new Date().toISOString()};
  }
  try{localStorage.setItem("fox-tables-v1",JSON.stringify(next));}
  catch{throw Error("Недостаточно места в браузере для импорта. Попробуйте уменьшить объём файла.");}
  window.dispatchEvent(new Event("fox-tables-updated"));
}
export async function importDelimitedFile(item:StoredItem):Promise<ImportedTable>{
  const table=await parseDelimitedFile(item);
  persistImportedTables([table]);
  return table;
}
