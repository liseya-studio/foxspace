import type { StoredItem } from "./storage";

type Column={id:string;name:string;type:"text"|"number"|"date"|"checkbox"};
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
  const columns:Column[]=header.map((name,index)=>{
    const values=records.slice(1).map(row=>row[index]??"");
    return {id:crypto.randomUUID(),name:name.trim()||"Поле "+(index+1),type:cellType(values)};
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
  const names=new Set(existing.map(table=>table.name.toLocaleLowerCase("ru")));
  const seen=new Set<string>();
  for(const table of tables){
    const name=table.name.toLocaleLowerCase("ru");
    if(names.has(name)||seen.has(name))throw Error("Таблица «"+table.name+"» уже существует. Импорт отменён, чтобы не перезаписать ваши данные.");
    seen.add(name);
  }
  try{localStorage.setItem("fox-tables-v1",JSON.stringify([...existing,...tables]));}
  catch{throw Error("Недостаточно места в браузере для импорта. Попробуйте уменьшить объём файла.");}
  window.dispatchEvent(new Event("fox-tables-updated"));
}
export async function importDelimitedFile(item:StoredItem):Promise<ImportedTable>{
  const table=await parseDelimitedFile(item);
  persistImportedTables([table]);
  return table;
}
