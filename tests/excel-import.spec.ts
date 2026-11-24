import {readFile} from "node:fs/promises";
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

test("Excel export round-trips long dropdown lists and comma-containing options",async({page})=>{
 await page.goto("/");
 const options=["Видео, монтаж","Очень длинный вариант ".repeat(15),"Дизайн"];
 const promise=page.waitForEvent("download");
 await page.evaluate(async choices=>{
  const {downloadXlsx}=await import("/src/features/tables/xlsx.ts");
  downloadXlsx("Тест",["Задача","Категория"],[["Монтаж","Видео, монтаж"]],[{type:"text"},{type:"select",options:choices}]);
 },options);
 const download=await promise;
 const path=await download.path();
 if(!path)throw Error("Export file missing");
 const bytes=Array.from(await readFile(path));
 const result=await page.evaluate(async data=>{
  const {listWorkbookSheets,readExcelDropdowns,readWorkbookSheet}=await import("/src/features/tables/excelValidation.ts");
  const file=new File([new Uint8Array(data)],"export.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  return {sheets:await listWorkbookSheets(file),choices:await readExcelDropdowns(file,"Тест"),rows:await readWorkbookSheet(file,"Тест")};
 },bytes);
 expect(result.sheets).toContain("Тест");
 expect(result.choices[1]).toEqual(options.map(option=>option.trim()));
 expect(result.rows[1][1]).toBe("Видео, монтаж");
});

test("Excel time-only number formats are not misread as calendar dates",async({page})=>{
 await page.goto("/");
 const timeFile=await page.evaluate(async()=>{
  const {readWorkbookSheet}=await import("/src/features/tables/excelValidation.ts");
  const workbook='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Время" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const files={
   "xl/workbook.xml":workbook,"xl/_rels/workbook.xml.rels":rels,
   "xl/styles.xml":'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="45"/></cellXfs></styleSheet>',
   "xl/worksheets/sheet1.xml":'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Длительность</t></is></c></row><row r="2"><c r="A2" s="1"><v>0.5</v></c></row></sheetData></worksheet>'
  };
  const local=[],central=[];let offset=0;
  for(const [name,body] of Object.entries(files)){
   const bytes=new TextEncoder().encode(body),filename=new TextEncoder().encode(name),crc=(data)=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;},sum=crc(bytes);
   const h=new Uint8Array(30+filename.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint32(14,sum,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,filename.length,true);h.set(filename,30);local.push(h,bytes);
   const c=new Uint8Array(46+filename.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x0800,true);w.setUint32(16,sum,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,filename.length,true);w.setUint32(42,offset,true);c.set(filename,46);central.push(c);offset+=h.length+bytes.length;
  }
  const join=(parts)=>{const length=parts.reduce((n,x)=>n+x.length,0),out=new Uint8Array(length);let at=0;for(const x of parts){out.set(x,at);at+=x.length;}return out;};
  const dir=join(central),tail=new Uint8Array(22),dv=new DataView(tail.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files?Object.keys(files).length:0,true);dv.setUint16(10,Object.keys(files).length,true);dv.setUint32(12,dir.length,true);dv.setUint32(16,offset,true);
  const blob=join([...local,dir,tail]);
  return await readWorkbookSheet(new File([blob],"time.xlsx"),"Время");
 });
 expect(timeFile[1][0]).toBe(0.5);
});

test("Files hub import preserves formula columns and extends existing dropdown choices",async({page})=>{
 await page.goto("/");
 const result=await page.evaluate(async()=>{
  localStorage.setItem("fox-tables-v1",JSON.stringify([{
   id:"existing",name:"Финансы",updatedAt:"2026-01-01T00:00:00.000Z",
   columns:[
    {id:"formula-total",name:"Итого",type:"formula",formulaSourceId:"amount",formulaFactor:1,formulaOperator:"*"},
    {id:"status",name:"Статус",type:"select",options:["Новый"]},
    {id:"tags",name:"Теги",type:"multiselect",options:["Видео"]}
   ],rows:[]
  }]));
  const {persistImportedTables}=await import("/src/features/files/importDelimited.ts");
  persistImportedTables([{
   id:"incoming",name:"Финансы",updatedAt:"2026-11-24T00:00:00.000Z",
   columns:[
    {id:"total-in",name:"Итого",type:"number"},
    {id:"status-in",name:"Статус",type:"text"},
    {id:"tags-in",name:"Теги",type:"text"}
   ],
   rows:[{id:"new",cells:{"total-in":250,"status-in":"Отложен","tags-in":"Видео; Монтаж"}}]
  }]);
  return JSON.parse(localStorage.getItem("fox-tables-v1")||"[]")[0];
 });
 expect(result.columns.find((column:{id:string})=>column.id==="formula-total").type).toBe("formula");
 expect(result.columns.some((column:{name:string;type:string})=>column.name==="Итого (Импорт 2)"&&column.type==="number")).toBeTruthy();
 expect(result.columns.find((column:{id:string})=>column.id==="status").options).toEqual(["Новый","Отложен"]);
 expect(result.columns.find((column:{id:string})=>column.id==="tags").options).toEqual(["Видео","Видео","Монтаж"]);
 const tags=result.columns.find((column:{id:string})=>column.id==="tags");
 expect(JSON.parse(result.rows[0].cells[tags.id])).toEqual(["Видео","Монтаж"]);
});
