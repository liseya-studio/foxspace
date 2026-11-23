import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,readFile,rm,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {decodeSnapshot,listCollection,createTask,updateTaskStatus,listTables,listTableRecords,getTableRecord,getTableImage} from "../core.mjs";
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

test("table image fields resolve full metadata and return image bytes",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"foxspace-image-")),file=join(dir,"workspace.json"),fileId="ab12-xy";
 try{
  const imageBytes=Buffer.from("89504e470d0a1a0a00000000","hex");
  const row={id:"record1",cells:{name:"Рекламный пост",description:"Очень длинный текст рекламы",photo:fileId}};
  const table={id:"posts",name:"Рекламные посты",columns:[{id:"name",name:"Название",type:"text"},{id:"description",name:"Текст",type:"text"},{id:"photo",name:"Обложка",type:"image"}],rows:[row]};
  await mkdir(join(dir,"files"));await writeFile(join(dir,"files",fileId+".bin"),imageBytes);
  await writeFile(file,JSON.stringify({"fox-tables-v1":JSON.stringify([table]),"fox-native-files-index-v1":JSON.stringify([{id:fileId,name:"photo.png",kind:"file",mime:"image/png"}])}));
  assert.equal((await listTables(file))[0].columns[2].type,"image");
  const records=await listTableRecords({tableId:"posts"},file);
  assert.equal(records.rows[0].fields["Обложка"].value,fileId);
  const detail=await getTableRecord({tableId:"posts",rowId:"record1"},file);
  assert.equal(detail.fields[1].value,"Очень длинный текст рекламы");
  const image=await getTableImage({tableId:"posts",rowId:"record1",columnId:"photo"},file);
  assert.equal(Buffer.from(image.dataBase64,"base64").toString("hex"),imageBytes.toString("hex"));
  await assert.rejects(()=>getTableImage({tableId:"posts",rowId:"record1",columnId:"name"},file),/Image column not found/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("choice fields expose structured options and selected values without changing raw cells",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"foxspace-choice-")),file=join(dir,"workspace.json");
 try{
  const table={id:"tasks",name:"Задачи",columns:[
   {id:"name",name:"Название",type:"text"},
   {id:"status",name:"Статус",type:"select",options:["Новый","Готово"]},
   {id:"tags",name:"Теги",type:"multiselect",options:["Видео","Срочно","Дизайн"]}
  ],rows:[{id:"one",cells:{name:"Монтаж",status:"Готово",tags:'["Видео","Срочно"]'}}]};
  await writeFile(file,JSON.stringify({"fox-tables-v1":JSON.stringify([table])}));
  const schema=await listTables(file);
  assert.deepEqual(schema[0].columns[1].options,["Новый","Готово"]);
  assert.deepEqual(schema[0].columns[2].options,["Видео","Срочно","Дизайн"]);
  const record=await getTableRecord({tableId:"tasks",rowId:"one"},file);
  const tags=record.fields.find(field=>field.name==="Теги");
  assert.equal(tags.value,'["Видео","Срочно"]');
  assert.deepEqual(tags.selectedOptions,["Видео","Срочно"]);
  const list=await listTableRecords({tableId:"tasks"},file);
  assert.deepEqual(list.rows[0].fields["Теги"].selectedOptions,["Видео","Срочно"]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
