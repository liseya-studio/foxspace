import {readExcelSheet,type ImportedCell} from "./excelImport";

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
function nodes(doc:Document,local:string):Element[]{
 return Array.from(doc.getElementsByTagNameNS("*",local));
}
function formulaText(node:Element):string{
 return Array.from(node.childNodes).filter(child=>child.nodeType===1&&child.localName==="formula1").map(child=>child.textContent??"")[0]?.trim()??"";
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
export async function readExcelDropdowns(file:File,sheetName:string):Promise<Record<number,string[]>>{
 // Discover worksheet path from the standard OOXML workbook relationship.
 const core=await zipXml(file,["xl/workbook.xml","xl/_rels/workbook.xml.rels"]);
 const workbook=core["xl/workbook.xml"],rels=core["xl/_rels/workbook.xml.rels"];
 if(!workbook||!rels)return {};
 const sheet=nodes(workbook,"sheet").find(item=>item.getAttribute("name")===sheetName);
 const id=sheet?.getAttribute("r:id")??sheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships","id");
 const rel=nodes(rels,"Relationship").find(item=>item.getAttribute("Id")===id);
 if(!rel)return {};
 const target=rel.getAttribute("Target")??"";
 const path=target.startsWith("/")?target.slice(1):normalizePath("xl/"+target);
 if(!path.startsWith("xl/worksheets/"))return {};
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
         const cells:ImportedCell[][]=await readExcelSheet(file,refSheet);
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
