import { saveDownload } from "../desktop/integration";

export type SpreadsheetValue=string|number|boolean|undefined|null;
type ZipFile={name:string;data:Uint8Array};
const encoder=new TextEncoder();
function concat(parts:Uint8Array[]):Uint8Array{const size=parts.reduce((sum,p)=>sum+p.length,0);const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;}
function crc32(bytes:Uint8Array):number{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zipStore(files:ZipFile[]):Uint8Array{
 const local:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const file of files){const name=encoder.encode(file.name),data=file.data,crc=crc32(data);
  const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);v.setUint16(10,0,true);v.setUint16(12,0,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);v.setUint16(28,0,true);header.set(name,30);
  local.push(header,data);
  const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,0,true);c.setUint16(14,0,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,offset,true);entry.set(name,46);central.push(entry);
  offset+=header.length+data.length;
 }
 const centralBytes=concat(central),localBytes=concat(local),end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);v.setUint16(4,0,true);v.setUint16(6,0,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralBytes.length,true);v.setUint32(16,localBytes.length,true);v.setUint16(20,0,true);
 return concat([localBytes,centralBytes,end]);
}
function xml(value:string){return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");}
function columnName(index:number){let n=index+1,out="";while(n){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26);}return out;}
function cellXml(value:SpreadsheetValue,ref:string):string{
 if(typeof value==="number"&&Number.isFinite(value))return `<c r="${ref}"><v>${value}</v></c>`;
 if(typeof value==="boolean")return `<c r="${ref}" t="b"><v>${value?1:0}</v></c>`;
 const text=value===null||value===undefined?"":String(value);
 return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
}
export async function downloadXlsx(name:string,headers:string[],rows:SpreadsheetValue[][],columns?:{type:string;options?:string[]}[]):Promise<void>{
 if(headers.length>16384||rows.length>1048575)throw new Error("Таблица превышает лимиты Excel");
 const safeName=(name.trim()||"Fox Space").replace(/[\\/*?:\[\]]/g," ").slice(0,31)||"Fox Space";
 const sheetRows=[headers,...rows].map((row,rowIndex)=>`<row r="${rowIndex+1}">${headers.map((_,colIndex)=>cellXml(row[colIndex],columnName(colIndex)+(rowIndex+1))).join("")}</row>`).join("");
 // Store validation choices on an auxiliary hidden worksheet. Inline lists
 // silently break at Excel's 255-character limit and cannot contain commas.
 const choiceColumns=(columns??[]).map((column,index)=>({column,index,options:[...new Set((column.options??[]).map(v=>v.trim()).filter(Boolean))]}))
   .filter(item=>["select","multiselect"].includes(item.column.type)&&item.options.length>0);
 const lists=choiceColumns.map(({index},i)=>`<dataValidation type="list" allowBlank="1" showDropDown="0" sqref="${columnName(index)}2:${columnName(index)}1048576"><formula1>FoxChoices_${i+1}</formula1></dataValidation>`);
 const validations=lists.length?`<dataValidations count="${lists.length}">${lists.join("")}</dataValidations>`:"";
 const names=choiceColumns.map(({options},i)=>`<definedName name="FoxChoices_${i+1}">'_FoxSpace_Choices'!$${columnName(i)}$1:$${columnName(i)}$${options.length}</definedName>`).join("");
 const hiddenRows=choiceColumns.length?Array.from({length:Math.max(...choiceColumns.map(({options})=>options.length))},(_,row)=>
  `<row r="${row+1}">${choiceColumns.map(({options},col)=>row<options.length?cellXml(options[row],columnName(col)+(row+1)):"").join("")}</row>`).join(""):"";
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData>${validations}</worksheet>`;
 const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(safeName)}" sheetId="1" r:id="rId1"/>${choiceColumns.length?'<sheet name="_FoxSpace_Choices" sheetId="2" state="hidden" r:id="rId2"/>':""}</sheets>${names?"<definedNames>"+names+"</definedNames>":""}</workbook>`;
 const files:ZipFile[]=[
 {name:"[Content_Types].xml",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>${choiceColumns.length?'<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>':""}</Types>`)},
 {name:"_rels/.rels",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
 {name:"xl/workbook.xml",data:encoder.encode(workbook)},
 {name:"xl/_rels/workbook.xml.rels",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>${choiceColumns.length?'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>':""}</Relationships>`)},
 {name:"xl/worksheets/sheet1.xml",data:encoder.encode(sheet)},
 ...(choiceColumns.length?[{name:"xl/worksheets/sheet2.xml",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${hiddenRows}</sheetData></worksheet>`)}]:[])
 ];
 const bytes=zipStore(files);const buffer=new ArrayBuffer(bytes.byteLength);new Uint8Array(buffer).set(bytes);
 const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
 await saveDownload(blob,(name.trim()||"table")+".xlsx");
}
