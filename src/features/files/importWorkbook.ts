import readExcelFile from "read-excel-file/browser";
import type { StoredItem } from "./storage";
import { parseDelimitedFile, persistImportedTables, type ImportedTable } from "./importDelimited";

/**
 * Convert all populated Excel sheets locally in the browser.
 * The workbook and its rows never leave the user's browser.
 * Existing table data is not changed if parsing any sheet fails.
 */
export async function importWorkbook(item:StoredItem):Promise<string[]>{
  if(!item.blob)throw Error("Файл Excel недоступен");
  if(item.size>8*1024*1024)throw Error("Книга больше 8 МБ. Импортируйте меньший XLSX.");
  const sheets=await readExcelFile(item.blob);
  if(!Array.isArray(sheets)||!sheets.length)throw Error("В книге Excel нет листов");
  const base=item.name.replace(/\.xlsx$/i,"");
  const imported:ImportedTable[]=[];
  const quote=(value:unknown):string=>{
    const converted=value instanceof Date
      ?value.getFullYear()+"-"+String(value.getMonth()+1).padStart(2,"0")+"-"+String(value.getDate()).padStart(2,"0")
      :String(value??"");
    return '"'+converted.replaceAll('"','""')+'"';
  };
  for(const sheet of sheets){
    if(!sheet||!Array.isArray(sheet.data))continue;
    const rows=(sheet.data as (string|number|boolean|Date|null|undefined)[][])
      .filter(row=>Array.isArray(row)&&row.some(value=>value!==null&&value!==undefined&&String(value).trim()!==""));
    // Blank and header-only sheets are intentionally skipped, not fabricated.
    if(rows.length<2)continue;
    const width=Math.max(...rows.map(row=>row.length));
    if(rows.length>10001||width>200)throw Error("Лист «"+sheet.sheet+"»: лимит 10 000 строк и 200 столбцов.");
    const csv=rows.map(row=>Array.from({length:width},(_,i)=>quote(row[i])).join(";")).join("\n");
    const title=base+(sheets.length>1?" — "+sheet.sheet:"");
    const blob=new Blob([csv],{type:"text/csv"});
    const file:StoredItem={...item,name:title+".csv",blob,size:blob.size};
    const table=await parseDelimitedFile(file);
    imported.push(table);
  }
  if(!imported.length)throw Error("Не найдено листов с заголовками и записями.");
  persistImportedTables(imported);
  return imported.map(table=>table.name);
}
