import { useState, type ReactNode } from "react";
import PlatformIcon from "../icons/PlatformIcon";
import { ChevronDown, ChevronRight, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export type WorkspacePage = { id: string; name: string; parentId?: string; icon?: string };
type Props = {
  pages: WorkspacePage[];
  activeId: string;
  onNavigate: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, parentId?: string) => void;
  collapsed?:boolean;
  onToggle?:()=>void;
};

export default function PageTree({pages,activeId,onNavigate,onAddChild,collapsed=false,onToggle}:Props){
  const [collapsed,setCollapsed]=useState<string[]>([]);
  const byId=new Map(pages.map(page=>[page.id,page]));
  const roots=pages.filter(page=>!page.parentId || !byId.has(page.parentId) || page.parentId===page.id);
  const toggle=(id:string)=>setCollapsed(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
  const descendants=(id:string,seen=new Set<string>()):Set<string>=>{
    if(seen.has(id))return seen;
    seen.add(id);
    for(const child of pages.filter(page=>page.parentId===id))descendants(child.id,seen);
    return seen;
  };
  function draw(page:WorkspacePage,level:number,visited:Set<string>):ReactNode{
    if(visited.has(page.id) || level>32)return null;
    const nextVisited=new Set(visited); nextVisited.add(page.id);
    const children=pages.filter(item=>item.parentId===page.id && item.id!==page.id);
    const expanded=!collapsed.includes(page.id);
    return <div key={page.id} className="fox-tree-group">
      <div className={"fox-tree-line"+(activeId===page.id?" selected":"")} style={{paddingLeft:8+level*15}}>
        {children.length?<button className="fox-tree-expand" type="button" aria-label={expanded?"Свернуть":"Развернуть"} onClick={()=>toggle(page.id)}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>:<span className="fox-tree-placeholder"/>}
        <button type="button" className="fox-tree-page" onClick={()=>onNavigate(page.id)}><PlatformIcon value={page.icon} size={19}/><span>{page.name}</span></button>
        <button type="button" className="fox-tree-add" title="Добавить вложенный экран" aria-label={"Добавить вложенный экран в "+page.name} onClick={()=>{if(!expanded)toggle(page.id);onAddChild(page.id);}}><Plus size={14}/></button>
      </div>
      {expanded&&children.map(child=>draw(child,level+1,nextVisited))}
    </div>;
  }
  return <aside className={"fox-page-tree"+(collapsed?" is-hidden":"")} aria-label="Дерево экранов">
    <div className="fox-tree-header"><strong>{!collapsed&&"Экраны"}</strong><button type="button" title={collapsed?"Показать страницы":"Скрыть страницы"} onClick={onToggle}>{collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}</button></div>
    {!collapsed&&<><div className="fox-tree-scroll">{roots.map(page=>draw(page,0,new Set()))}</div>
    {pages.some(page=>page.parentId&&!roots.some(root=>descendants(root.id).has(page.id)))&&<div className="fox-tree-orphan">Некоторые страницы имеют циклические ссылки. Измените их родительскую страницу.</div>}
    <div className="fox-tree-hint">Добавьте дочерний экран через +. Для переноса выберите родителя в меню экрана.</div></>}
  </aside>;
}
