import { dateNow, uid, type Publication, type PublicationTemplate, type PublicationVariant } from "../data";

export const publicationStatuses = {
  idea:"Идея",draft:"Подготовка",ready:"Готово",scheduled:"Запланировано",published:"Опубликовано",
} as const;

export const contentFormats = ["Пост","Глава","Переписка","Видео","Короткое видео","Карусель","Сторис","Анонс","Опрос","Мем"];

export function parseHashtags(text:string) {
  const tags=new Map<string,string>();
  for(const raw of text.split(/[\s,;]+/u)){
    const name=raw.replace(/^#+/u,"");
    if(!name||!/^[\p{L}\p{N}][\p{L}\p{N}_]*(?:@[A-Za-z0-9_]+)?$/u.test(name))continue;
    const key=name.toLocaleLowerCase("ru");
    if(!tags.has(key))tags.set(key,"#"+name);
  }
  return [...tags.values()];
}

export function publicationDates(post:Publication,platform:string){
  const dates=new Map<string,string[]>();
  const matching=post.variants.filter(variant=>!platform||variant.platform===platform);
  if(!matching.length && !platform && post.date) dates.set(post.date,[]);
  for(const variant of matching){
    const timestamp=variant.date||post.date;
    if(!timestamp)continue;
    const platforms=dates.get(timestamp)??[];
    if(!platforms.includes(variant.platform))dates.set(timestamp,[...platforms,variant.platform]);
  }
  return [...dates.entries()].sort(([left],[right])=>left.localeCompare(right))
    .map(([timestamp,platforms])=>({timestamp,platforms}));
}

export function newPublication(projectId:string,day=dateNow()):Publication {
  return {id:uid(),title:"",text:"",projectId,date:day+"T12:00",status:"idea",mediaFileIds:[],variants:[]};
}

export function capturePublicationTemplate(post:Publication,name:string):PublicationTemplate {
  const defaults={
    title:post.title,text:post.text,projectId:post.projectId,format:post.format,rubric:post.rubric,
    series:post.series,storyUrl:post.storyUrl,tags:[...(post.tags??[])],audience:post.audience,tier:post.tier,
  };
  const variants=post.variants.map(({platform,text,audience,tier})=>({platform,text,audience,tier}));
  return {id:uid(),name:name.trim(),defaults,variants};
}

export function fromPublicationTemplate(template:PublicationTemplate,projectId:string,day?:string):Publication {
  return {...newPublication(projectId||template.defaults.projectId,day),...template.defaults,
    projectId:projectId||template.defaults.projectId,tags:[...(template.defaults.tags??[])],
    variants:template.variants.map(variant=>({...variant,id:uid(),date:"",url:"",views:0}))};
}

export function selectedPublicationAudience(post:Publication,variant?:PublicationVariant){
  if(variant?.audience)return variant.audience;
  return post.audience??"public";
}
