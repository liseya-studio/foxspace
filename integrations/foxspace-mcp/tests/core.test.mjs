import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {decodeSnapshot,listCollection,createTask,updateTaskStatus} from "../core.mjs";
test("decode snapshot validates shape",()=>{assert.throws(()=>decodeSnapshot("[]"));assert.deepEqual(decodeSnapshot("{}"),{});});
test("read and guarded writes with task audit",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"fox-space-mcp-")),file=join(dir,"workspace.json");
 try{
 await writeFile(file,JSON.stringify({"fox-notes-tasks-v1":JSON.stringify({tasks:[],notes:[]})}));
 assert.deepEqual(await listCollection("tasks",file),[]);
 const previous=process.env.FOXSPACE_ALLOW_WRITES;
 delete process.env.FOXSPACE_ALLOW_WRITES;
 await assert.rejects(()=>createTask({title:"Test"},file),/Writes disabled/);
 process.env.FOXSPACE_ALLOW_WRITES="1";
 try{
  const task=await createTask({title:"Test"},file);
  assert.equal((await listCollection("tasks",file))[0].title,"Test");
  await updateTaskStatus({taskId:task.id,status:"done"},file);
  assert.equal((await listCollection("tasks",file))[0].status,"done");
  const saved=JSON.parse(await readFile(file,"utf8"));
  assert.equal(JSON.parse(saved["fox-audit-log-v1"]).length,2);
 }finally{if(previous===undefined)delete process.env.FOXSPACE_ALLOW_WRITES;else process.env.FOXSPACE_ALLOW_WRITES=previous;}
 }finally{await rm(dir,{recursive:true,force:true});}
});
