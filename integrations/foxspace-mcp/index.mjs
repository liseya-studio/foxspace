import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import {FILE,listCollection,listTables,getTableRecord,listTableRecords,getTableImage} from "./core.mjs";
import {stat} from "node:fs/promises";

const profileId = process.env.FOXSPACE_AGENT_ID ?? "";

const server=new McpServer({name:"foxspace-local",version:"0.1.0"});
const output=(value)=>({content:[{type:"text",text:JSON.stringify(value,null,2)}]});
const safe=async(fn)=>{try{return output(await fn());}catch(e){return {isError:true,content:[{type:"text",text:e.message}]};}};
server.tool("foxspace_status","Inspect the local Fox Space bridge. Never claims cloud access.",{},async()=>safe(async()=>{
 const s=await stat(FILE);
 return {connected:true,updatedAt:s.mtime.toISOString(),writeEnabled:false, profileConfigured:Boolean(profileId),mode:"local-stdio",warning:"Only for local desktop sessions; not reachable from mobile/web ChatGPT."};
}));
server.tool("foxspace_list","Read Fox Space projects, goals, tasks, finance, publications or trackers.",{collection:z.enum(["projects","goals","tasks","transactions","publications","trackers"]),limit:z.number().int().min(1).max(100).optional(),offset:z.number().int().min(0).optional()},async({collection,limit=50,offset=0})=>safe(async()=>{
 const items=await listCollection(collection,FILE,profileId);
 if(!Array.isArray(items))throw Error("Invalid collection");
 return {collection,total:items.length,items:items.slice(offset,offset+limit)};
}));
server.tool("foxspace_get","Read a single Fox Space object by ID.",{collection:z.enum(["projects","goals","tasks","transactions","publications","trackers"]),id:z.string().min(1)},async({collection,id})=>safe(async()=>{
 const items=await listCollection(collection,FILE,profileId);const item=items.find(x=>x.id===id);
 if(!item)throw Error("Not found");return item;
}));
server.tool("foxspace_tables","List local Fox Space databases including column IDs and image column types.",{},async()=>safe(()=>listTables(FILE,profileId)));
server.tool("foxspace_table_records","Read structured records of a local Fox Space table. Image cells contain file IDs.",{tableId:z.string().min(1),offset:z.number().int().min(0).optional(),limit:z.number().int().min(1).max(100).optional()},async(args)=>safe(()=>listTableRecords(args,FILE,profileId)));
server.tool("foxspace_table_record","Read complete fields for one record, preserving long text and image references.",{tableId:z.string().min(1),rowId:z.string().min(1)},async(args)=>safe(()=>getTableRecord(args,FILE,profileId)));
server.tool("foxspace_table_image","Read the actual image attached to a specific record and image column; local macOS only.",{tableId:z.string().min(1),rowId:z.string().min(1),columnId:z.string().min(1)},async(args)=>{
 try{const photo=await getTableImage(args,FILE,profileId);return {content:[{type:"text",text:JSON.stringify({fileId:photo.fileId,name:photo.name,mime:photo.mime})},{type:"image",data:photo.dataBase64,mimeType:photo.mime}]};}
 catch(e){return {isError:true,content:[{type:"text",text:e instanceof Error?e.message:String(e)}]};}
});
const transport=new StdioServerTransport();
await server.connect(transport);
