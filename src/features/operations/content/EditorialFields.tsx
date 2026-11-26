import { contentFormats, parseHashtags } from "./model";
import type { Publication, PublicationAudience } from "../data";

type AccessProps = { audience?:PublicationAudience; tier?:string; onChange:(changes:{audience?:PublicationAudience;tier?:string})=>void; allowInherit?:boolean };

export function AccessFields({audience,tier,onChange,allowInherit}:AccessProps){
  return <div className="fox-editorial-access">
    <label>Доступ<select value={audience??(allowInherit?"":"public")} onChange={event=>onChange({audience:event.target.value as PublicationAudience||undefined,tier:event.target.value==="restricted"?tier:undefined})}>
      {allowInherit&&<option value="">Как в исходной публикации</option>}
      <option value="public">Открытый</option>
      <option value="restricted">По подписке или ограниченный</option>
    </select></label>
    {audience==="restricted"&&<label>Уровень доступа<input value={tier??""} placeholder="Например, «За кулисами»" onChange={event=>onChange({tier:event.target.value})}/></label>}
  </div>;
}

export default function EditorialFields({post,onChange}:{post:Publication;onChange:(patch:Partial<Publication>)=>void}){
  return <fieldset className="fox-editorial-fields">
    <legend>Контент-план</legend>
    <label>Формат<input list="fox-content-formats" placeholder="Пост, глава, видео…" value={post.format??""} onChange={event=>onChange({format:event.target.value})}/>
      <datalist id="fox-content-formats">{contentFormats.map(format=><option key={format} value={format}/>)}</datalist>
    </label>
    <label>Рубрика<input value={post.rubric??""} onChange={event=>onChange({rubric:event.target.value})}/></label>
    <label>Серия или работа<input value={post.series??""} onChange={event=>onChange({series:event.target.value})}/></label>
    <label>Ссылка на работу<input type="url" value={post.storyUrl??""} onChange={event=>onChange({storyUrl:event.target.value})}/></label>
    <label className="fox-editorial-wide">Хэштеги<input defaultValue={(post.tags??[]).join(" ")} placeholder="#рубрика #название_работы" onBlur={event=>{
      const tags=parseHashtags(event.target.value);
      event.target.value=tags.join(" ");
      onChange({tags});
    }}/></label>
    <AccessFields audience={post.audience} tier={post.tier} onChange={onChange}/>
  </fieldset>;
}
