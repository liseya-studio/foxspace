import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import countries from "world-countries";
import { ZoomIn, ZoomOut, Globe2 } from "lucide-react";
import type { TableData } from "../tables/values";

type Country = { id?:string|number; properties?: {name?:string}; geometry:unknown; type:"Feature" };
const meta=(countries as {ccn3?:string;cca3:string;cca2:string;name:{common:string};flag?:string}[]);
const byNumeric=new Map(meta.map(country=>[String(country.ccn3).padStart(3,"0"),country]));
function displayFlag(alpha2:string){return /^[A-Z]{2}$/.test(alpha2)?Array.from(alpha2).map(char=>String.fromCodePoint(char.charCodeAt(0)+127397)).join(""):"🌐";}
const normalize=(s:unknown)=>String(s??"").trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
const source=world as unknown as Topology;
const shapes=feature(source,source.objects.countries as GeometryCollection) as unknown as {type:"FeatureCollection";features:Country[]};
const projection=geoNaturalEarth1().fitSize([980,490],shapes as never);
const path=geoPath(projection);
export default function WorldTravelMap({table}:{table?:TableData}){
 const [selected,setSelected]=useState<string|null>(null);
 const [zoom,setZoom]=useState(1);
 const [onlyVisited,setOnlyVisited]=useState(false);
 const records=useMemo(()=>{
  if(!table)return new Map<string,{visits:number;cities:Set<string>;count:number;name:string;status:string}>();
  const find=(...names:string[])=>table.columns.find(col=>names.some(name=>normalize(col.name)===normalize(name)))?.id;
  const code=find("ISO A3","Код страны","Код","ISO3"),name=find("Страна","Название страны","Country"),city=find("Город","Города","City"),cityCount=find("Количество городов","Городов"),status=find("Статус","Посещение");
  const result=new Map<string,{visits:number;cities:Set<string>;count:number;name:string;status:string}>();
  for(const row of table.rows){
   const alpha3=normalize(code?row.cells[code]:"");
   const rawName=normalize(name?row.cells[name]:"");
   const country=meta.find(item=>normalize(item.cca3)===alpha3||normalize(item.name.common)===rawName);
   if(!country)continue;
   const id=String(country.ccn3).padStart(3,"0");
   const entry=result.get(id)??{visits:0,cities:new Set<string>(),count:0,name:country.name.common,status:""};
   entry.visits++;
   const place=city?String(row.cells[city]??"").trim():"";
   if(place)entry.cities.add(place);
   const number=Number(cityCount?row.cells[cityCount]:"");
   if(Number.isFinite(number)&&number>0)entry.count=Math.max(entry.count,number);
   if(status&&row.cells[status])entry.status=String(row.cells[status]);
   result.set(id,entry);
  }
  return result;
 },[table]);
 const countryById=(id:string)=>byNumeric.get(id);
 const chosen=selected?countryById(selected):undefined;
 const chosenInfo=selected?records.get(selected):undefined;
 const list=shapes.features.filter(item=>countryById(String(item.id).padStart(3,"0")));
 const countCountries=records.size;
 function handleSelect(id:string){setSelected(id);}
 return <div className="fox-worldmap">
  <div className="fox-worldmap-toolbar"><span><Globe2 size={16}/> {table ? `${countCountries} стран с записями`:"Подключите таблицу путешествий"}</span><div><button type="button" className={onlyVisited?"selected":""} onClick={()=>setOnlyVisited(v=>!v)}>С посещениями</button><button type="button" aria-label="Приблизить карту" onClick={()=>setZoom(v=>Math.min(3,v+.35))}><ZoomIn size={16}/></button><button type="button" aria-label="Отдалить карту" onClick={()=>setZoom(v=>Math.max(1,v-.35))}><ZoomOut size={16}/></button></div></div>
  <div className="fox-worldmap-surface">
   <svg role="img" aria-label="Интерактивная карта стран мира" viewBox="0 0 980 490" preserveAspectRatio="xMidYMid meet"><g style={{transform:`translate(490px,245px) scale(${zoom}) translate(-490px,-245px)`,transformOrigin:"center",transition:"transform .25s ease"}}>
    {list.map(item=>{const id=String(item.id).padStart(3,"0");const info=records.get(id);const shape=path(item as never)||"";return <path key={id} d={shape} className={"fox-worldmap-country"+(info?" visited":"")+(selected===id?" active":"")+(onlyVisited&&!info?" muted":"")} role="button" tabIndex={0} aria-label={countryById(id)?.name.common||id} onClick={()=>handleSelect(id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();handleSelect(id);}}}><title>{countryById(id)?.name.common||item.properties?.name||id}{info?` · ${info.visits} записей`:""}</title></path>;})}
   </g></svg>
  </div>
  <div className="fox-worldmap-details">{chosen?<><span className="fox-worldmap-flag">{displayFlag(chosen.cca2)}</span><div><strong>{new Intl.DisplayNames(["ru"],{type:"region"}).of(chosen.cca2)||chosen.name.common}</strong><small>{chosenInfo?(chosenInfo.status||"Есть записи о поездках"):"Нет записей о посещении"}</small></div><div className="fox-worldmap-metrics"><b>{chosenInfo?.cities.size||chosenInfo?.count||0}</b><small>городов {chosenInfo?.cities.size||chosenInfo?.count?"в данных":"указано"}</small></div><div className="fox-worldmap-metrics"><b>{chosenInfo?.visits??0}</b><small>записей</small></div></>:<><Globe2 size={20}/><span>Выберите страну на карте, чтобы увидеть её флаг, статус и статистику.</span></>}</div>
  {!table&&<div className="fox-worldmap-message">Для раскраски посещённых стран подключите таблицу с колонкой «ISO A3» или «Страна». Карта работает и без данных.</div>}
 </div>;
}
