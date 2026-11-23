import {test} from "@playwright/test";

test("diagnose pointer movement for editable grid",async({page})=>{
  await page.goto("/");
  await page.evaluate(()=>localStorage.clear());
  await page.reload();
  await page.locator(".dock-add").click();
  await page.locator(".fox-global-create-items button").filter({hasText:"Экран"}).click();
  await page.getByRole("button",{name:"Действия с экраном"}).click();
  await page.getByRole("button",{name:"Редактировать экран"}).click();
  await page.locator(".fox-editor-library button").filter({hasText:"Текст"}).click();
  await page.evaluate(()=>{
    const w=window as typeof window&{__foxDiagnostic?:unknown};
    const log:{type:string;target:string;x:number;y:number;buttons:number}[]=[];
    w.__foxDiagnostic=log;
    for(const type of ["pointerdown","pointermove","pointerup"])document.addEventListener(type,(e)=>{
      const event=e as PointerEvent;
      if(log.length<25)log.push({type,target:(event.target as HTMLElement)?.className?.toString()?.slice(0,100)??"",x:event.clientX,y:event.clientY,buttons:event.buttons});
    },{capture:true});
  });
  const handle=page.locator(".fox-widget").first().locator(".fox-grid-drag-handle");
  const box=await handle.boundingBox();
  if(!box)throw Error("Missing drag handle");
  console.log("DRAG START",JSON.stringify(box));
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2+220,{steps:9});
  await page.mouse.up();
  console.log("DRAG EVENTS",await page.evaluate(()=>(window as typeof window&{__foxDiagnostic?:unknown}).__foxDiagnostic));
  console.log("GRID",await page.evaluate(()=>JSON.parse(localStorage.getItem("fox-screen-grid-v1")??"{}")));
});
