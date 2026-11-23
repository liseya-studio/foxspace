import type { GridLayout } from "../editor/gridLayout";

/**
 * A workspace template is a snapshot of page composition, not table records.
 * References to existing databases remain intact; internal page references
 * are remapped to the newly created pages when installing the snapshot.
 */
export type TemplatePage = {
  id: string;
  parentId?: string;
  name: string;
  icon?: string;
  tableId?: string;
  widgets: Array<{id:string;[key:string]:unknown}>;
  layout?: GridLayout;
};
export type WorkspaceTemplate = {
  id: string;
  name: string;
  icon?: string;
  sourceTableId?: string;
  widgets: TemplatePage["widgets"];
  layout?: GridLayout;
  /** Optional: absent for templates saved by older Fox Space versions. */
  pages?: TemplatePage[];
};
export type WorkspacePage = {
  id: string;
  name: string;
  icon?: string;
  tableId?: string;
  parentId?: string;
};
export type WorkspaceSnapshot = {
  pages: WorkspacePage[];
  widgetStore: Record<string,TemplatePage["widgets"]>;
  gridStore: Record<string,GridLayout>;
};

const clone = <T,>(value:T):T=>structuredClone(value);

/** Descendants are ordered parent-first and cycles cannot trap the traversal. */
export function collectPageTree(rootId:string,pages:WorkspacePage[]):WorkspacePage[]{
  const byId=new Map(pages.map(page=>[page.id,page]));
  if(!byId.has(rootId))return [];
  const queue=[rootId],visited=new Set<string>(),result:WorkspacePage[]=[];
  while(queue.length){
    const id=queue.shift()!;
    if(visited.has(id))continue;
    visited.add(id);
    const page=byId.get(id);
    if(!page)continue;
    result.push(page);
    for(const child of pages)if(child.parentId===id&&!visited.has(child.id))queue.push(child.id);
  }
  return result;
}

export function captureWorkspaceTemplate(
  rootId:string,
  name:string,
  pages:WorkspacePage[],
  widgets:WorkspaceSnapshot["widgetStore"],
  grids:WorkspaceSnapshot["gridStore"],
  createId:()=>string,
):WorkspaceTemplate{
  const tree=collectPageTree(rootId,pages);
  if(!tree.length)throw new Error("Корневая страница не найдена");
  const first=tree[0];
  const snapshots=tree.map(page=>({
    ...clone(page),
    parentId:page.id===rootId?undefined:page.parentId,
    widgets:clone(widgets[page.id]??[]),
    layout:grids[page.id]?clone(grids[page.id]):undefined
  }));
  return {
    id:createId(),name,icon:first.icon,sourceTableId:first.tableId,
    widgets:clone(snapshots[0].widgets),
    layout:snapshots[0].layout?clone(snapshots[0].layout):undefined,
    pages:snapshots,
  };
}

/** Produces new page/widget IDs, maps the page tree, and preserves grid positions. */
export function instantiateWorkspaceTemplate(
  template:WorkspaceTemplate,
  createId:()=>string,
):WorkspaceSnapshot{
  const source:TemplatePage[]=template.pages?.length
    ? template.pages
    : [{id:"legacy-root",name:template.name,icon:template.icon,tableId:template.sourceTableId,
      widgets:template.widgets??[],layout:template.layout}];
  const idMap=new Map(source.map(page=>[page.id,createId()]));
  const installed:WorkspaceSnapshot={pages:[],widgetStore:{},gridStore:{}};
  for(const page of source){
    const newPageId=idMap.get(page.id)!;
    const widgetIds=new Map(page.widgets.map(widget=>[widget.id,createId()]));
    const parentId=page.parentId?idMap.get(page.parentId):undefined;
    installed.pages.push({
      id:newPageId,name:page.name,icon:page.icon,tableId:page.tableId,
      ...(parentId?{parentId}:{})
    });
    installed.widgetStore[newPageId]=page.widgets.map(widget=>{
      const copy=clone(widget);
      copy.id=widgetIds.get(widget.id)!;
      // Only remap explicit internal page references, not database record IDs.
      for(const key of ["screenId","targetScreenId","pageId"]){
        if(typeof copy[key]==="string"&&idMap.has(copy[key] as string))copy[key]=idMap.get(copy[key] as string)!;
      }
      return copy;
    });
    if(page.layout){
      const positions:GridLayout["positions"]={};
      for(const [oldWidgetId,position] of Object.entries(page.layout.positions)){
        const newWidgetId=widgetIds.get(oldWidgetId);
        if(newWidgetId)positions[newWidgetId]=clone(position);
      }
      installed.gridStore[newPageId]={settings:clone(page.layout.settings),positions};
    }
  }
  return installed;
}

/** Write both stores or restore both previous values if quota/security fails. */
export function persistWorkspaceSnapshot(
  storage:Pick<Storage,"getItem"|"setItem"|"removeItem">,
  snapshot:WorkspaceSnapshot,
  widgetKey="fox-editor-widgets-v1",
  gridKey="fox-screen-grid-v1",
){
  const previousWidgets=storage.getItem(widgetKey);
  const previousGrid=storage.getItem(gridKey);
  const parse=(raw:string|null):Record<string,unknown>=>{
    if(!raw)return {};
    const value=JSON.parse(raw);
    if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Некорректное хранилище экрана");
    return value;
  };
  const widgetStore={...parse(previousWidgets),...snapshot.widgetStore};
  const gridStore={...parse(previousGrid),...snapshot.gridStore};
  try{
    storage.setItem(widgetKey,JSON.stringify(widgetStore));
    storage.setItem(gridKey,JSON.stringify(gridStore));
  }catch(error){
    if(previousWidgets===null)storage.removeItem(widgetKey);else storage.setItem(widgetKey,previousWidgets);
    if(previousGrid===null)storage.removeItem(gridKey);else storage.setItem(gridKey,previousGrid);
    throw error;
  }
}
