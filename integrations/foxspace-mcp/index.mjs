import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import {FILE,readWorkspace,listCollection,createTask,updateTaskStatus} from "./core.mjs";
import {stat} from "node:fs/promises";

const server=new McpServer({name:"foxspace-local",version:"0.1.0"});
const output=(value)=>({content:[{type:"text",text:JSON.stringify(value,null,2)}]});
const safe=async(fn)=>{try{return output(await fn());}catch(e){return {isError:true,content:[{type:"text",text:e.message}]};}};
server.tool("foxspace_status","Inspect the local Fox Space bridge. Never claims cloud access.",{},async()=>safe(async()=>{
 const s=await stat(FILE);
 return {connected:true,workspaceFile:FILE,updatedAt:s.mtime.toISOString(),writeEnabled:process.env.FOXSPACE_ALLOW_WRITES==="1",mode:"local-stdio",warning:"Only for local desktop sessions; not reachable from mobile/web ChatGPT."};
}));
server.tool("foxspace_list","Read Fox Space projects, goals, tasks, finance, publications or trackers.",{collection:z.enum(["projects","goals","tasks","transactions","publications","trackers"]),limit:z.number().int().min(1).max(100).optional(),offset:z.number().int().min(0).optional()},async({collection,limit=50,offset=0})=>safe(async()=>{
 const items=await listCollection(collection);
 if(!Array.isArray(items))throw Error("Invalid collection");
 return {collection,total:items.length,items:items.slice(offset,offset+limit)};
}));
server.tool("foxspace_get","Read a single Fox Space object by ID.",{collection:z.enum(["projects","goals","tasks","transactions","publications","trackers"]),id:z.string().min(1)},async({collection,id})=>safe(async()=>{
 const items=await listCollection(collection);const item=items.find(x=>x.id===id);
 if(!item)throw Error("Not found");return item;
}));
server.tool("foxspace_create_task","Create a task on the local Mac (requires explicit local write enablement).",{title:z.string().min(1).max(300),description:z.string().max(20000).optional(),dueDate:z.string().optional(),projectId:z.string().optional()},async(args)=>safe(()=>createTask(args)));
server.tool("foxspace_set_task_status","Update task state locally (requires explicit local write enablement).",{taskId:z.string().min(1),status:z.enum(["todo","in_progress","done"])},async(args)=>safe(()=>updateTaskStatus(args)));
const transport=new StdioServerTransport();
await server.connect(transport);
