export type GridSettings={columns:number;rows:number;gap:number;rowHeight:number};
export type Rect={x:number;y:number;w:number;h:number};
export type GridLayout={settings:GridSettings;positions:Record<string,Rect>};
export type GridWidget={id:string;width:number;height:number;financeColumn?:number;financeRow?:number;financeRowSpan?:number};
export const GRID_KEY="fox-screen-grid-v1";
export const DEFAULT_GRID:GridSettings={columns:12,rows:12,gap:12,rowHeight:64};
const clamp=(n:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,Math.round(Number.isFinite(n)?n:lo)));
export function normalizeSettings(input:Partial<GridSettings>={}):GridSettings{return {columns:clamp(Number(input.columns??12),4,24),rows:clamp(Number(input.rows??12),4,60),gap:clamp(Number(input.gap??12),0,32),rowHeight:clamp(Number(input.rowHeight??64),40,140)};}
export function normalizeRect(rect:Rect,settings:GridSettings):Rect{
 const w=clamp(Number(rect.w),1,settings.columns),h=clamp(Number(rect.h),1,settings.rows);
 return {x:clamp(Number(rect.x),0,settings.columns-w),y:clamp(Number(rect.y),0,settings.rows-h),w,h};
}
export function intersects(a:Rect,b:Rect){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function fits(rect:Rect,positions:Record<string,Rect>,settings:GridSettings,except?:string){
 if(rect.x<0||rect.y<0||rect.w<1||rect.h<1||rect.x+rect.w>settings.columns||rect.y+rect.h>settings.rows)return false;
 return Object.entries(positions).every(([id,other])=>id===except||!intersects(rect,other));
}
export function nextSlot(w:number,h:number,positions:Record<string,Rect>,settings:GridSettings):Rect|null{
 const width=clamp(w,1,settings.columns),height=clamp(h,1,settings.rows);
 for(let y=0;y<=settings.rows-height;y++)for(let x=0;x<=settings.columns-width;x++){
  const rect={x,y,w:width,h:height};if(fits(rect,positions,settings))return rect;
 }
 return null;
}
export function preferredRect(widget:GridWidget,settings:GridSettings):Rect{
 const w=clamp(Number(widget.width)||6,1,settings.columns);
 const h=clamp(Math.ceil((Number(widget.height)||205)/(settings.rowHeight+settings.gap)),1,settings.rows);
 if(widget.financeRow){const y=widget.financeRow===4?5:widget.financeRow===3?2:widget.financeRow-1;const span=widget.financeRowSpan??(widget.financeRow>=3?3:1);return {x:(widget.financeColumn??1)-1,y,w,h:span};}
 return {x:0,y:0,w,h};
}
export function reconcileGrid(layout:GridLayout|undefined,widgets:GridWidget[]):GridLayout{
 let settings=normalizeSettings(layout?.settings);
 if(!layout?.settings){const legacyColumns=Math.max(12,...widgets.map(w=>(w.financeColumn??1)+(w.financeColumn?Math.max(1,w.width)-1:0)));settings=normalizeSettings({...settings,columns:legacyColumns,rowHeight:widgets.some(w=>w.financeColumn)?105:settings.rowHeight});}
 const output:Record<string,Rect>={};
 for(const widget of widgets){
  const candidate=layout?.positions?.[widget.id]??preferredRect(widget,settings);
  const wanted=normalizeRect(candidate,settings);
  let placed=fits(wanted,output,settings)?wanted:nextSlot(wanted.w,wanted.h,output,settings);
  while(!placed&&settings.rows<60){settings={...settings,rows:Math.min(60,settings.rows+4)};placed=nextSlot(wanted.w,wanted.h,output,settings);}
  if(placed)output[widget.id]=placed;
 }
 return {settings,positions:output};
}
export function reposition(layout:GridLayout,id:string,rect:Rect):GridLayout|null{
 if(!Number.isInteger(rect.x)||!Number.isInteger(rect.y)||!Number.isInteger(rect.w)||!Number.isInteger(rect.h))return null;
 const position=rect;
 if(!fits(position,layout.positions,layout.settings,id))return null;
 return {...layout,positions:{...layout.positions,[id]:position}};
}
export function updateGridSettings(layout:GridLayout,widgets:GridWidget[],patch:Partial<GridSettings>):GridLayout{
 return reconcileGrid({settings:normalizeSettings({...layout.settings,...patch}),positions:layout.positions},widgets);
}
export function readGridStore():Record<string,GridLayout>{try{const item=JSON.parse(localStorage.getItem(GRID_KEY)||"{}");return item&&typeof item==="object"&&!Array.isArray(item)?item:{};}catch{return {};}}
