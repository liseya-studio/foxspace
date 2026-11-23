import type {ImportedCell} from "./excelImport";

/** Extract Excel's existing list-validation options without uploading the file.
 * Supports inline lists and explicit cell ranges. Named/formula-based lists
 * remain importable as data, with choices inferred from their observed values. */
const decoder=new TextDecoder();
function columnIndex(letters:string):number{
 return [...letters.toUpperCase()].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
}
function normalizePath(path:string):string{
 const parts:string[]=[];
 for(const part of path.split("/")){if(part==="..")parts.pop();else if(part&&part!==".")parts.push(part);}
 return parts.join("/");
}
async function zipXml(file:File,names:string[]):Promise<Record<string,Document>>{
 if(file.size>25*1024*1024)throw Error("Размер файла превышает 25 МБ.");
 const buffer=await file.arrayBuffer(),bytes=new Uint8Array(buffer),view=new DataView(buffer);
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-66000);i--){
   if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 }
 if(end<0)throw Error("Файл не является корректным XLSX.");
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
 const requested=new Set(names),result:Record<string,Document>={};
 let cursor=offset;
 for(let i=0;i<count&&cursor<bytes.length;i++){
   if(view.getUint32(cursor,true)!==0x02014b50)break;
   const method=view.getUint16(cursor+10,true),size=view.getUint32(cursor+20,true);
   const nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
   const localOffset=view.getUint32(cursor+42,true);
   const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));
   cursor+=46+nameLength+extra+comment;
   if(!requested.has(name))continue;
   if(size>8*1024*1024)throw Error("XML-часть Excel слишком большая.");
   if(view.getUint32(localOffset,true)!==0x04034b50)continue;
   const dataStart=localOffset+30+view.getUint16(localOffset+26,true)+view.getUint16(localOffset+28,true);
   const compressed=bytes.slice(dataStart,dataStart+size);
   let decoded:Uint8Array;
   if(method===0)decoded=compressed;
   else if(method===8){
     // XLSX uses ZIP raw DEFLATE. No remote services or file uploads involved.
     const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
     decoded=new Uint8Array(await new Response(stream).arrayBuffer());
   }else continue;
   if(decoded.length>12*1024*1024)throw Error("Слишком большой XML-лист.");
   const doc=new DOMParser().parseFromString(decoder.decode(decoded),"application/xml");
   if(!doc.getElementsByTagName("parsererror").length)result[name]=doc;
 }
 return result;
}
function nodes(doc:Document|Element,local:string):Element[]{
 return Array.from(doc.getElementsByTagNameNS("*",local));
}
function formulaText(node:Element):string{
 return Array.from(node.childNodes).filter(child=>child.nodeType===1&&(child as Element).localName==="formula1").map(child=>child.textContent??"")[0]?.trim()??"";
}
function directOptions(formula:string):string[]{
 if(!(formula.startsWith('"')&&formula.endsWith('"')))return [];
 return [...new Set(formula.slice(1,-1).replaceAll('""','"').split(",").map(x=>x.trim()).filter(Boolean))];
}
function validatedColumn(sqref:string):number[]{
 const result=new Set<number>();
 for(const segment of sqref.trim().split(/\s+/)){
   const match=segment.match(/^\$?([A-Z]{1,3})\$?\d+(?::\$?([A-Z]{1,3})\$?\d+)?$/i);
   if(!match)continue;
   const first=columnIndex(match[1]),last=columnIndex(match[2]??match[1]);
   for(let index=first;index<=last&&index<150;index++)if(index>=0)result.add(index);
 }
 return [...result];
}
export function columnValidationOptions(xml:string):Record<number,string[]>{
 const doc=new DOMParser().parseFromString(xml,"application/xml");
 const data:Record<number,string[]>={};
 for(const item of nodes(doc,"dataValidation")){
   if(item.getAttribute("type")!=="list")continue;
   const opts=directOptions(formulaText(item));
   for(const idx of validatedColumn(item.getAttribute("sqref")??""))data[idx]=[...new Set([...(data[idx]??[]),...opts])];
 }
 return data;
}
async function sheetLocation(file:File,sheetName:string):Promise<string>{
 const core=await zipXml(file,["xl/workbook.xml","xl/_rels/workbook.xml.rels"]);
 const workbook=core["xl/workbook.xml"],rels=core["xl/_rels/workbook.xml.rels"];
 if(!workbook||!rels)throw Error("Некорректная структура книги Excel.");
 const sheet=nodes(workbook,"sheet").find(item=>item.getAttribute("name")===sheetName);
 const id=sheet?.getAttribute("r:id")??sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
 const rel=nodes(rels,"Relationship").find(item=>item.getAttribute("Id")===id);
 if(!rel)throw Error("Лист Excel не найден: "+sheetName);
 const target=rel.getAttribute("Target")??"";
 const path=target.startsWith("/")?target.slice(1):normalizePath("xl/"+target);
 if(!path.startsWith("xl/worksheets/"))throw Error("Некорректный путь листа Excel.");
 return path;
}
export async function listWorkbookSheets(file:File):Promise<string[]>{
 const workbook=(await zipXml(file,["xl/workbook.xml"]))["xl/workbook.xml"];
 if(!workbook)throw Error("Книга Excel не содержит описания листов.");
 return nodes(workbook,"sheet").map(node=>node.getAttribute("name")??"").filter(Boolean);
}
function excelDate(value:number):string{
 const epoch=Date.UTC(1899,11,30);
 return new Date(epoch+Math.round(value*86400000)).toISOString().slice(0,10);
}
export async function readWorkbookSheet(file:File,sheetName:string):Promise<ImportedCell[][]>{
 const path=await sheetLocation(file,sheetName);
 const parts=await zipXml(file,[path,"xl/sharedStrings.xml","xl/styles.xml"]);
 const document=parts[path];
 if(!document)throw Error("Не удалось прочитать лист "+sheetName);
 const shared=parts["xl/sharedStrings.xml"]?nodes(parts["xl/sharedStrings.xml"],"si").map(si=>nodesChildText(si)): [];
 const styles=parts["xl/styles.xml"];
 const formatNodes=styles?nodes(styles,"numFmt"):[];
 const customDates=new Set(formatNodes.filter(x=>/[dmy]/i.test((x.getAttribute("formatCode")??"").replace(/"[^"]*"/g,""))).map(x=>Number(x.getAttribute("numFmtId"))));
 const styleXfs=styles?nodes(styles,"cellXfs")[0]:undefined;
 const xfs=styleXfs?Array.from(styleXfs.children):[];
 const datedFormats=new Set([14,15,16,17,22,27,30,36,45,46,47,50,57]);
 const result:ImportedCell[][]=[];
 for(const row of nodes(document,"row")){
   const index=Number(row.getAttribute("r"))||result.length+1;
   if(index>50001)throw Error("Максимум 50 000 строк для импорта.");
   while(result.length<index)result.push([]);
   const target=result[index-1];
   for(const cell of Array.from(row.children)){
     if(cell.localName!=="c")continue;
     const ref=cell.getAttribute("r")??"";
     const match=ref.match(/^([A-Z]+)\d+$/i);
     if(!match)continue;
     const col=columnIndex(match[1]);
     if(col>=150)throw Error("Максимум 150 колонок для импорта.");
     const type=cell.getAttribute("t")??"";
     const valueNode=Array.from(cell.children).find(child=>child.localName==="v");
     const text=valueNode?.textContent??"";
     let value:ImportedCell=null;
     if(type==="inlineStr"){
       const inline=Array.from(cell.children).find(child=>child.localName==="is");
       value=inline?nodesChildText(inline):"";
     }else if(type==="s")value=shared[Number(text)]??"";
     else if(type==="b")value=text==="1";
     else if(type==="str"||type==="e")value=text;
     else if(text!==""){
       const numeric=Number(text);
       if(Number.isFinite(numeric)){
         const style=xfs[Number(cell.getAttribute("s")??0)];
         const fmt=Number(style?.getAttribute("numFmtId")??0);
         value=datedFormats.has(fmt)||customDates.has(fmt)?excelDate(numeric):numeric;
       }else value=text;
     }
     target[col]=value;
   }
 }
 // Trailing empty XML rows are omitted, while empty cells inside rows remain aligned.
 while(result.length&&result[result.length-1].every(v=>v===undefined||v===null))result.pop();
 return result;
}
function nodesChildText(element:Element):string{
 return nodes(element,"t").map(node=>node.textContent??"").join("");
}
export async function readExcelDropdowns(file:File,sheetName:string):Promise<Record<number,string[]>>{
 const path=await sheetLocation(file,sheetName);
 const sheetDoc=(await zipXml(file,[path]))[path];
 if(!sheetDoc)return {};
 const out:Record<number,string[]>={};
 for(const validation of nodes(sheetDoc,"dataValidation")){
   if(validation.getAttribute("type")!=="list")continue;
   const formula=formulaText(validation);
   let options=directOptions(formula);
   if(!options.length){
     const match=formula.match(/^(?:'((?:[^']|'')+)'!|([^!]+)!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i);
     if(match){
       const refSheet=(match[1]?.replaceAll("''","'")??match[2]??sheetName).trim();
       const col=columnIndex(match[3]),lastCol=columnIndex(match[5]??match[3]);
       const firstRow=Math.max(1,Number(match[4])),lastRow=Number(match[6]??match[4]);
       if(lastRow-firstRow<=1000&&lastCol-col<=20&&refSheet){
         const cells:ImportedCell[][]=await readWorkbookSheet(file,refSheet);
         options=[...new Set(cells.slice(firstRow-1,lastRow).flatMap(row=>row.slice(col,lastCol+1)).map(value=>String(value??"").trim()).filter(Boolean))];
       }
     }
   }
   for(const index of validatedColumn(validation.getAttribute("sqref")??"")){
     out[index]=[...new Set([...(out[index]??[]),...options])].slice(0,200);
   }
 }
 return out;
}
