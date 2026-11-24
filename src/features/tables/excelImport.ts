import {listWorkbookSheets,readWorkbookSheet} from "./excelValidation";

export type ImportedCell=string|number|boolean|Date|null|undefined;
export type ImportType="text"|"number"|"date"|"checkbox"|"select"|"multiselect";
export type ImportField={id:string;name:string;type:ImportType;options:string[];index:number;source:"excel"|"inferred"|"manual"};
export type ImportDraft={sheet:string;fields:ImportField[];rows:ImportedCell[][];warnings:string[]};
export type ImportTable={
 id:string;name:string;updatedAt?:string;
 columns:{id:string;name:string;type:string;options?:string[]}[];
 rows:{id:string;cells:Record<string,string|number|boolean>}[];
 history?:{id:string;at:string;summary:string}[];
};
const MAX_ROWS=50000,MAX_COLS=150;
const normalize=(value:unknown)=>String(value??"").trim();
const clean=(value:ImportedCell):string=>value instanceof Date ? [value.getFullYear(),String(value.getMonth()+1).padStart(2,"0"),String(value.getDate()).padStart(2,"0")].join("-"):normalize(value);
const knownSelect=/(статус|приоритет|категор|тип|площадк|канал|этап|раздел|status|priority|category|platform|stage|format|состояние|проект.*статус)/i;
const maybeMultiple=/(теги|метки|категории|участники|жанры|навыки|платформы|тематик|пейринги|tags|labels|skills|genres|channels|topics)/i;
export function splitMultiple(raw:unknown):string[]{
 if(Array.isArray(raw))return [...new Set(raw.map(normalize).filter(Boolean))];
 const text=normalize(raw);if(!text)return [];
 try{const json=JSON.parse(text);if(Array.isArray(json))return [...new Set(json.map(normalize).filter(Boolean))];}catch{ /* delimiter-based Excel input */ }
 return [...new Set(text.split(/\s*[;,|\n]\s*/).map(v=>v.trim()).filter(Boolean))];
}
export function encodedMultiple(value:unknown):string{
 return JSON.stringify(splitMultiple(value));
}
export function displayMultiple(value:unknown):string{
 return splitMultiple(value).join(", ");
}
export function inferExcelFields(matrix:ImportedCell[][],overrides:Record<number,string[]>={},createId:()=>string=()=>crypto.randomUUID()):ImportField[]{
 if(!matrix.length||!matrix[0]?.length)throw Error("Excel: отсутствует строка заголовков.");
 const names=new Set<string>();
 return matrix[0].slice(0,MAX_COLS).map((raw,index)=>{
   let name=clean(raw)||"Колонка "+(index+1);
   const original=name;let suffix=2;
   while(names.has(name.toLocaleLowerCase("ru")))name=original+" ("+suffix+++")";
   names.add(name.toLocaleLowerCase("ru"));
   const sample=matrix.slice(1,1001).map(row=>row[index]).filter(v=>v!==null&&v!==undefined&&clean(v)!=="");
   const distinct=[...new Set(sample.map(clean))];
   const excelOptions=[...new Set((overrides[index]??[]).map(normalize).filter(Boolean))];
   let type:ImportType="text";
   if(excelOptions.length)type=maybeMultiple.test(name)?"multiselect":"select";
   else if(sample.length && sample.every(v=>typeof v==="boolean"))type="checkbox";
   else if(sample.length && sample.every(v=>typeof v==="number"))type="number";
   else if(sample.length && sample.every(v=>v instanceof Date || /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(clean(v))))type="date";
   else if(maybeMultiple.test(name)&&sample.length&&sample.some(v=>/[;,|\n]/.test(clean(v))))type="multiselect";
   else if(knownSelect.test(name)&&sample.length&&distinct.length<=24)type="select";
   const options=excelOptions.length?excelOptions:
     type==="multiselect"?[...new Set(sample.flatMap(v=>splitMultiple(v)))].slice(0,200):
     type==="select"?distinct.slice(0,200):[];
   return {id:createId(),name,type,index,options,source:excelOptions.length?"excel":"inferred"};
 });
}
export function createImportDraft(sheet:string,matrix:ImportedCell[][],overrides:Record<number,string[]>={},createId:()=>string=()=>crypto.randomUUID()):ImportDraft{
 if(!matrix.length||!matrix[0]?.length)throw Error("Пустой Excel-лист: первая строка должна содержать заголовки.");
 if(matrix[0].length>MAX_COLS)throw Error("Excel содержит больше 150 колонок.");
 if(matrix.length-1>MAX_ROWS)throw Error("За один импорт можно загрузить до 50 000 строк.");
 const fields=inferExcelFields(matrix,overrides,createId);
 const rows=matrix.slice(1).filter(row=>row.some(v=>clean(v)!==""));
 return {sheet,fields,rows,warnings:[]};
}
function toCell(value:ImportedCell,field:ImportField):string|number|boolean{
 if(value===null||value===undefined||clean(value)==="")return field.type==="checkbox"?false:"";
 if(field.type==="multiselect")return encodedMultiple(value);
 if(field.type==="number"){const n=typeof value==="number"?value:Number(clean(value).replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:clean(value);}
 if(field.type==="checkbox")return value===true||["true","1","да","yes","✓","✔"].includes(clean(value).toLowerCase());
 if(field.type==="date")return clean(value).slice(0,10);
 return clean(value);
}
export function mergeExcelIntoTable(draft:ImportDraft,existing:ImportTable|undefined,createId:()=>string=()=>crypto.randomUUID()):ImportTable{
 const now=new Date().toISOString();
 const table:ImportTable=existing?{...existing,columns:[...existing.columns],rows:[...existing.rows],history:[...(existing.history??[])]}:{id:createId(),name:draft.sheet||"Импорт Excel",columns:[],rows:[],history:[]};
 const mapping=new Map<number,string>();
 for(const field of draft.fields){
   // A workbook can contain historical entries outside its current validation list.
   // Keep both declared choices and actual imported values available for editing.
   const observed=field.type==="multiselect"
     ?draft.rows.flatMap(row=>splitMultiple(row[field.index]))
     :field.type==="select"?draft.rows.map(row=>clean(row[field.index])).filter(Boolean):[];
   const fieldOptions=[...new Set([...field.options,...observed])];
   let col=table.columns.find(c=>c.name.toLocaleLowerCase("ru")===field.name.toLocaleLowerCase("ru"));
   // Imported scalar cells must never overwrite formula, relation, rollup, image,
   // person, project, or backlink columns. Create a separate import field instead.
   if(col&&!["text","number","date","checkbox","select","multiselect"].includes(col.type))col=undefined;
   if(!col){
     let importedName=field.name,suffix=2;
     while(table.columns.some(item=>item.name.toLocaleLowerCase("ru")===importedName.toLocaleLowerCase("ru")))importedName=field.name+" (Импорт "+suffix+++ ")";
     col={id:createId(),name:importedName,type:field.type,options:field.type==="select"||field.type==="multiselect"?fieldOptions:undefined};
     table.columns.push(col);
   }else if(col.type==="select"||col.type==="multiselect"){
     const observed=col.type==="multiselect"?draft.rows.flatMap(row=>splitMultiple(row[field.index])):draft.rows.map(row=>clean(row[field.index])).filter(Boolean);
     col={...col,options:[...new Set([...(col.options??[]),...observed,...fieldOptions])]};
     table.columns=table.columns.map(item=>item.id===col!.id?col!:item);
   }else if(col.type==="text"&&(field.type==="select"||field.type==="multiselect")){
     // Upgrade only an entirely empty text column. Never rewrite existing user data.
     const empty=table.rows.every(row=>row.cells[col!.id]===undefined||row.cells[col!.id]===null||row.cells[col!.id]==="");
     if(empty){
       col={...col,type:field.type,options:fieldOptions};
       table.columns=table.columns.map(item=>item.id===col!.id?col!:item);
     }
   }
   mapping.set(field.index,col.id);
 }
 const columnById=new Map(table.columns.map(c=>[c.id,c]));
 for(const raw of draft.rows){
   const cells:Record<string,string|number|boolean>={};
   for(const field of draft.fields){
     const colId=mapping.get(field.index)!;
     const target=columnById.get(colId)!;
     cells[colId]=toCell(raw[field.index],{...field,type:target.type as ImportType});
   }
   table.rows.push({id:createId(),cells});
 }
 table.updatedAt=now;
 table.history=[...(table.history??[]),{id:createId(),at:now,summary:(existing?"Добавлено":"Импортировано")+" "+draft.rows.length+" строк из Excel · "+draft.sheet}].slice(-300);
 return table;
}
export async function readExcelSheet(file:File,sheet:string):Promise<ImportedCell[][]>{
 return readWorkbookSheet(file,sheet);
}
export async function listExcelSheets(file:File):Promise<string[]>{
 return listWorkbookSheets(file);
}
