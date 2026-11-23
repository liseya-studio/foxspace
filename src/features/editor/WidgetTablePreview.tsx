import {useMemo,useState} from "react";
import {Check, Image as ImageIcon, Search} from "lucide-react";
import {formatCell, valueForColumn, type TableData,type TableRow} from "../tables/values";

type Props={
  table:TableData;
  tables:TableData[];
  rows:TableRow[];
  limit:number;
  onOpenRecord?:(rowId:string)=>void;
};

/** A real, interactive table view. The empty sample row is visual guidance,
 * never saved as a user record or included in metrics. */
export default function WidgetTablePreview({table,tables,rows,limit,onOpenRecord}:Props){
  const [query,setQuery]=useState("");
  const [sortColumn,setSortColumn]=useState("");
  const [direction,setDirection]=useState<"asc"|"desc">("asc");
  const [columnSelections,setColumnSelections]=useState<Record<string,string[]>>({});
  const columnIds=columnSelections[table.id]??table.columns.slice(0,6).map(column=>column.id);
  const columns=table.columns.filter(column=>columnIds.includes(column.id));
  const changeColumn=(id:string,checked:boolean)=>setColumnSelections(previous=>{
    const current=previous[table.id]??table.columns.slice(0,6).map(column=>column.id);
    const next=checked?[...new Set([...current,id])]:current.filter(value=>value!==id);
    return {...previous,[table.id]:next.length?next:current};
  });
  const matching=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase("ru");
    const filtered=normalized?rows.filter(row=>columns.some(column=>String(valueForColumn(row,column,tables)??"").toLocaleLowerCase("ru").includes(normalized))):rows;
    const selected=table.columns.find(col=>col.id===sortColumn);
    if(!selected)return filtered;
    return [...filtered].sort((a,b)=>{
      const x=valueForColumn(a,selected,tables),y=valueForColumn(b,selected,tables);
      const compare=typeof x==="number"&&typeof y==="number"?x-y:String(x??"").localeCompare(String(y??""),"ru",{numeric:true});
      return direction==="asc"?compare:-compare;
    });
  },[query,rows,columns,sortColumn,direction,tables,table.columns]);
  const shown=matching.slice(0,limit);
  return <div className="fox-widget-table-view">
    <div className="fox-widget-toolbar">
      <label className="fox-widget-toolbar-search"><Search size={14}/><input aria-label="Поиск по таблице" placeholder="Поиск..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select aria-label="Сортировка таблицы" value={sortColumn} onChange={e=>setSortColumn(e.target.value)}>
        <option value="">Без сортировки</option>
        {table.columns.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}
      </select>
      {sortColumn&&<button type="button" className="fox-widget-sort-direction" title="Направление сортировки" aria-label="Направление сортировки" onClick={()=>setDirection(d=>d==="asc"?"desc":"asc")}>{direction==="asc"?"↑":"↓"}</button>}
      <details className="fox-widget-column-picker"><summary>Поля ({columns.length})</summary><div className="fox-widget-column-options">{table.columns.map(col=><label key={col.id}><input type="checkbox" checked={columnIds.includes(col.id)} onChange={e=>changeColumn(col.id,e.target.checked)}/><span>{col.name}</span></label>)}</div></details>
      <span className="fox-widget-toolbar-count">{query.trim()?matching.length+" из "+rows.length:rows.length} записей</span>
    </div>
    <div className="fox-widget-table-scroll"><table><thead><tr>{columns.map(c=><th key={c.id}>{c.name}</th>)}</tr></thead><tbody>
      {shown.map(row=><tr key={row.id} onClick={()=>onOpenRecord?.(row.id)} style={{cursor:onOpenRecord?"pointer":undefined}}>{columns.map(col=>{
        const value=valueForColumn(row,col,tables);
        return <td key={col.id} title={col.type==="image"?(value?"Фото":"Нет фото"):String(value??"")}>{col.type==="image"?<span className="fox-widget-image-cell"><ImageIcon size={13}/>{value?"Фото":"Нет фото"}</span>:col.type==="checkbox"?<span role="img" aria-label={value?"Да":"Нет"} className={"fox-widget-check"+(value?" checked":"")}>{value&&<Check size={12}/>}</span>:(col.type==="select"||col.type==="multiselect")?<span className="fox-widget-table-tag">{formatCell(value)}</span>:formatCell(value)}</td>;
      })}</tr>)}
      {!rows.length&&<tr className="fox-widget-table-skeleton" aria-label="Пример оформления строки">{columns.map((column,index)=><td key={column.id}>{column.type==="checkbox"?<span className="fox-widget-check"/>:<span style={{width:index===0?"80%":index%2?"55%":"70%"}}/>}</td>)}</tr>}
    </tbody></table></div>
    {!rows.length&&<p className="fox-widget-data-hint">Пример строки · добавьте записи в таблицу, чтобы увидеть свои данные</p>}
    {!!rows.length&&!shown.length&&<p className="fox-widget-data-hint">По запросу ничего не найдено</p>}
  </div>;
}
