type Kind="bars"|"line"|"donut";

/** Layout-only skeletons for an unconfigured chart. These are not analytics or records. */
export default function EmptyChartPreview({kind}:{kind:Kind}){
  return <div className={"fox-chart-preview fox-chart-preview-"+kind} aria-label="Образец оформления графика без данных">
    {kind==="bars"&&<div className="fox-chart-preview-bars">{[72,44,83,58,96,65].map((height,index)=><span key={index} style={{height:height+"%"}}/>)}</div>}
    {kind==="line"&&<svg viewBox="0 0 320 142" role="img" aria-label="Контур линейного графика"><path d="M12 20H308M12 70H308M12 120H308" stroke="currentColor" opacity=".12" strokeDasharray="3 5"/><path d="M12 116 C48 96 60 110 93 72 S154 65 181 87 S240 18 308 37" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" opacity=".25"/></svg>}
    {kind==="donut"&&<div className="fox-chart-preview-donut"/>}
    <small>Образец оформления · появится после добавления данных</small>
  </div>;
}
