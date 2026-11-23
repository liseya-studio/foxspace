import type {StoredItem} from "./storage";
import {persistImportedTables,type ImportedTable} from "./importDelimited";
import {listExcelSheets,readExcelSheet,createImportDraft,mergeExcelIntoTable} from "../tables/excelImport";
import {readExcelDropdowns} from "../tables/excelValidation";

/**
 * Fast import from the Files hub. Uses the same schema-aware XLSX parser
 * as the interactive mapping wizard; unlike the old CSV conversion, dropdown
 * choices, multi-choice columns and types are retained. No workbook bytes leave
 * this device. Existing populated tables are never overwritten.
 */
export async function importWorkbook(item:StoredItem):Promise<string[]>{
 if(!item.blob)throw Error("Файл Excel недоступен");
 if(item.size>25*1024*1024)throw Error("Книга больше 25 МБ. Импортируйте меньший XLSX.");
 const file=new File([item.blob],item.name,{type:item.mime||"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 const sheets=await listExcelSheets(file);
 if(!sheets.length)throw Error("В книге Excel нет листов.");
 const base=item.name.replace(/\.xlsx$/i,"");
 const imported:ImportedTable[]=[];
 for(const sheet of sheets){
   const rows=await readExcelSheet(file,sheet);
   if(!rows.length||!rows[0]?.some(value=>value!==null&&value!==undefined&&String(value).trim()))continue;
   const choices=await readExcelDropdowns(file,sheet).catch(()=>({} as Record<number,string[]>));
   const draft=createImportDraft(sheet,rows,choices,()=>crypto.randomUUID());
   const table=mergeExcelIntoTable(draft,undefined,()=>crypto.randomUUID());
   table.name=base+(sheets.length>1?" — "+sheet:"");
   imported.push(table as ImportedTable);
 }
 if(!imported.length)throw Error("Нет листов с заголовками для импорта.");
 persistImportedTables(imported);
 return imported.map(table=>table.name);
}
