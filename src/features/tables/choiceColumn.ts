import {splitMultiple,encodedMultiple} from "./excelImport";

export type ChoiceKind="text"|"select"|"multiselect";
type Col={id:string;name:string;type:string;options?:string[]};
type Row={id:string;cells:Record<string,string|number|boolean>};
type Table={columns:Col[];rows:Row[]};
const normalize=(value:unknown)=>String(value??"").trim();

/** Change a field between text, single- and multi-choice without overwriting
 * records. A lossy multi-to-single conversion is rejected explicitly. */
export function changeChoiceColumn<T extends Table>(
  table:T,columnId:string,kind:ChoiceKind,requested:string[]
):T{
 const current=table.columns.find(col=>col.id===columnId);
 if(!current||!["text","select","multiselect"].includes(current.type))throw Error("Этот тип поля нельзя изменить таким способом.");
 const options=[...new Set(requested.map(normalize).filter(Boolean))];
 const changed:Row[]=table.rows.map(row=>{
   const raw=row.cells[columnId];
   let next:string;
   if(kind==="multiselect")next=encodedMultiple(raw);
   else if(current.type==="multiselect"){
     const selected=splitMultiple(raw);
     if(kind==="select"&&selected.length>1)throw Error("Нельзя превратить несколько выбранных значений в одно без потери данных. Сначала измените тип на «Текст».");
     next=kind==="text"?selected.join("; "):(selected[0]??"");
   }else next=normalize(raw);
   return {...row,cells:{...row.cells,[columnId]:next}};
 });
 if(kind!=="text"){
   for(const row of changed){
     const vals=kind==="multiselect"?splitMultiple(row.cells[columnId]):[normalize(row.cells[columnId])];
     for(const value of vals)if(value&&!options.includes(value))options.push(value);
   }
   if(options.length>200)throw Error("В поле больше 200 уникальных вариантов. Используйте текстовый тип.");
 }
 const columns=table.columns.map(column=>column.id===columnId?{...column,type:kind,options:kind==="text"?undefined:options}:column);
 return {...table,columns,rows:changed} as T;
}
