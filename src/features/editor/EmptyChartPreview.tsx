import {BarChart3, ChartNoAxesCombined, ChartPie} from "lucide-react";

type Kind="bars"|"line"|"donut";
const labels:Record<Kind,string>={
  bars:"Столбчатый график",
  line:"Линейный график",
  donut:"Круговая диаграмма"
};

/** Empty charts must not show fabricated data or pretend to be functioning analytics. */
export default function EmptyChartPreview({kind}:{kind:Kind}){
  const Icon=kind==="bars"?BarChart3:kind==="line"?ChartNoAxesCombined:ChartPie;
  return <div className="fox-chart-empty" role="status" aria-label={labels[kind]+": нет данных"}>
    <span className="fox-chart-empty-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.6}/></span>
    <strong>Пока нет данных</strong>
    <span>Выберите таблицу и поля с записями, чтобы построить {labels[kind].toLocaleLowerCase("ru")}.</span>
  </div>;
}
