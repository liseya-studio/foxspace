import readExcelFile from "read-excel-file/browser";
import type { StoredItem } from "./storage";
import { importDelimitedFile } from "./importDelimited";

/**
 * Each populated worksheet is imported as a separate table.
 * Original workbook stays in IndexedDB; the imported tables use the existing local table format.
 */
export async function importWorkbook(item:StoredItem):Promise<string[]>{
  if(!item.blob)throw Error("Файл Excel недоступен");
  if(item.size>8*1024*1024)throw Error("Книга больше 8 МБ: импортируйте меньший XLSX");
  const sheets=await readExcelFile(item.blob);
  if(!Array.isArray(sheets)||!sheets.length)throw Error("В книге Excel нет листов");
  const imported:string[]=[];
  const base=item.name.replace(/\.xlsx$/i,"");
  for(const sheet of sheets){
    if(!sheet||!Array.isArray(sheet.data)||sheet.data.length<2)continue;
    const rows=sheet.data as (string|number|boolean|Date|null|undefined)[][];
    if(rows.length>10001||Math.max(...rows.map(r=>r.length))>100)throw Error("Лимит: 10 000 строк и 100 столбцов на лист");
    const quote=(value:unknown)=>{
      const converted=value instanceof Date
        ?value.getFullYear()+"-"+String(value.getMonth()+1).padStart(2,"0")+"-"+String(value.getDate()).padStart(2,"0")
        :String(value??"");
      return '"'+converted.replaceAll('"','""')+'"';
    };
    const csv=rows.map(row=>row.map(quote).join(";")).join("\n");
    const title=base+(sheets.length>1?" — "+sheet.sheet:"");
    const file:StoredItem={...item,name:title+".csv",blob:new Blob([csv],{type:"text/csv"}),size:new Blob([csv]).size};
    const table=await importDelimitedFile(file);
    imported.push(table.name);
  }
  if(!imported.length)throw Error("Не найдено листов с заголовками и записями");
  return imported;
}
