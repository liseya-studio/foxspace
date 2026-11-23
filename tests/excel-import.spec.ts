import {test,expect} from "@playwright/test";
import {deflateRawSync} from "node:zlib";
import {createImportDraft,mergeExcelIntoTable,splitMultiple} from "../src/features/tables/excelImport";

function crc32(data:Buffer):number{
 let crc=0xffffffff;
 for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function makeZip(files:Record<string,string>):Buffer{
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const [name,text] of Object.entries(files)){
   const bytes=Buffer.from(text),compressed=deflateRawSync(bytes),filename=Buffer.from(name),checksum=crc32(bytes);
   const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(8,8);
   header.writeUInt32LE(checksum,14);header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
   local.push(header,filename,compressed);
   const index=Buffer.alloc(46);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(8,10);index.writeUInt32LE(checksum,16);index.writeUInt32LE(compressed.length,20);index.writeUInt32LE(bytes.length,24);index.writeUInt16LE(filename.length,28);index.writeUInt32LE(offset,42);
   central.push(index,filename);offset+=header.length+filename.length+compressed.length;
 }
 const dir=Buffer.concat(central),tail=Buffer.alloc(22);tail.writeUInt32LE(0x06054b50);tail.writeUInt16LE(Object.keys(files).length,8);tail.writeUInt16LE(Object.keys(files).length,10);tail.writeUInt32LE(dir.length,12);tail.writeUInt32LE(offset,16);
 return Buffer.concat([...local,dir,tail]);
}
const workbook='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Заказы" sheetId="1" r:id="rId1"/></sheets></workbook>';
const relationships='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
'<row r="1"><c r="A1" t="inlineStr"><is><t>Заказ</t></is></c><c r="B1" t="inlineStr"><is><t>Статус</t></is></c><c r="C1" t="inlineStr"><is><t>Теги</t></is></c><c r="D1" t="inlineStr"><is><t>Цена</t></is></c><c r="E1" t="inlineStr"><is><t>Готово</t></is></c></row>'+
'<row r="2"><c r="A2" t="inlineStr"><is><t>Монтаж</t></is></c><c r="B2" t="inlineStr"><is><t>В работе</t></is></c><c r="C2" t="inlineStr"><is><t>Срочно; Видео</t></is></c><c r="D2"><v>2500</v></c><c r="E2" t="b"><v>1</v></c></row>'+
'<row r="3"><c r="A3" t="inlineStr"><is><t>Сайт</t></is></c><c r="B3" t="inlineStr"><is><t>Новый</t></is></c><c r="C3" t="inlineStr"><is><t>Дизайн</t></is></c><c r="D3"><v>12000</v></c><c r="E3" t="b"><v>0</v></c></row>'+
'</sheetData><dataValidations count="2"><dataValidation type="list" sqref="B2:B400"><formula1>"Новый,В работе,Готово"</formula1></dataValidation><dataValidation type="list" sqref="C2:C400"><formula1>"Срочно,Видео,Дизайн"</formula1></dataValidation></dataValidations></worksheet>';
const xlsx=makeZip({"xl/workbook.xml":workbook,"xl/_rels/workbook.xml.rels":relationships,"xl/worksheets/sheet1.xml":sheet});

test("Excel importer retains columns, dropdown choices, multi-choice and values",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.getByRole("button",{name:"Файлы и таблицы"}).click();
 await page.locator(".fox-files-tabs button").filter({hasText:"Таблицы"}).click();
 await page.getByRole("button",{name:"Импорт Excel",exact:true}).click();
 await page.locator(".fox-excel-dialog input[type=file]").setInputFiles({name:"orders.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:xlsx});
 const dialog=page.getByRole("dialog",{name:"Импорт Excel"});
 await expect(dialog.getByRole("combobox",{name:"Тип поля Статус"})).toHaveValue("select");
 await expect(dialog.getByRole("combobox",{name:"Тип поля Теги"})).toHaveValue("multiselect");
 await expect(dialog.getByRole("textbox",{name:"Варианты Статус"})).toHaveValue("Новый\nВ работе\nГотово");
 await expect(dialog.getByRole("textbox",{name:"Варианты Теги"})).toHaveValue("Срочно\nВидео\nДизайн");
 await dialog.getByRole("button",{name:"Импортировать 2 строк"}).click();
 const tables=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-tables-v1")??"[]"));
 expect(tables).toHaveLength(1);
 expect(tables[0].columns.map((c:{name:string})=>c.name)).toEqual(["Заказ","Статус","Теги","Цена","Готово"]);
 expect(tables[0].rows).toHaveLength(2);
 const tags=tables[0].columns.find((c:{name:string})=>c.name==="Теги");
 expect(JSON.parse(tables[0].rows[0].cells[tags.id])).toEqual(["Срочно","Видео"]);
 const price=tables[0].columns.find((c:{name:string})=>c.name==="Цена");
 expect(tables[0].rows[0].cells[price.id]).toBe(2500);
 const status=tables[0].columns.find((c:{name:string})=>c.name==="Статус");
 expect(status.options).toContain("Готово");
 await page.getByTitle("Открыть запись").first().click();
 await page.locator(".table-record-panel .fox-multi-choice summary").click();
 await expect(page.locator(".table-record-panel .fox-multi-choice").getByRole("checkbox",{name:"Видео"})).toBeChecked();
});

test("import existing table keeps old entries, merges options by column name",()=>{
 let n=0;const id=()=>String(++n);
 const draft=createImportDraft("Заявки",[
  ["Заказ","Статус","Теги","Цена"],
  ["Монтаж","Новый","Срочно; Видео",1200],
  ["Сайт","Готово","Дизайн",8500]
 ],{1:["Новый","Готово"],2:["Срочно","Видео","Дизайн"]},id);
 expect(draft.fields.map(f=>f.type)).toEqual(["text","select","multiselect","number"]);
 const first=mergeExcelIntoTable(draft,undefined,id);
 const next=mergeExcelIntoTable(draft,first,id);
 expect(next.rows).toHaveLength(4);
 expect(next.columns).toHaveLength(4);
 expect(next.columns.find(c=>c.name==="Теги")?.options).toContain("Срочно");
 expect(splitMultiple(next.rows[0].cells[next.columns[2].id])).toEqual(["Срочно","Видео"]);
});

test("Files hub quick Excel import retains dropdown options across all sheets",async({page})=>{
 await page.goto("/");
 await page.evaluate(()=>localStorage.clear());
 await page.reload();
 await page.getByRole("button",{name:"Файлы и таблицы"}).click();
 await page.locator(".fox-file-header-actions input[type=file][accept*='.xlsx']").setInputFiles({name:"quick.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:xlsx});
 await expect(page.locator(".table-title-row h2")).toContainText("quick");
 const tables=await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-tables-v1")??"[]"));
 expect(tables).toHaveLength(1);
 expect(tables[0].columns.find((c:{name:string})=>c.name==="Статус").options).toEqual(["Новый","В работе","Готово"]);
 expect(tables[0].columns.find((c:{name:string})=>c.name==="Теги").type).toBe("multiselect");
 expect(tables[0].rows).toHaveLength(2);
});
