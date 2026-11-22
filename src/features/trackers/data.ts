export const TRACKERS_KEY="fox-trackers-v1";
export type FieldType="number"|"text"|"boolean"|"select";
export type TrackerField={id:string;label:string;type:FieldType;unit?:string;options?:string[];required?:boolean};
export type TrackerTemplate={id:string;name:string;category:string;description:string;fields:TrackerField[]};
export type TrackerEntry={id:string;date:string;values:Record<string,string|number|boolean>;note:string;createdAt:string;updatedAt:string};
export type Tracker={id:string;templateId:string;name:string;category:string;description:string;fields:TrackerField[];entries:TrackerEntry[];createdAt:string;updatedAt:string};
export type TrackersData={version:1;trackers:Tracker[]};
export const TRACKER_TEMPLATES:TrackerTemplate[]=[
{id:"health",name:"Самочувствие",category:"Здоровье",description:"Ежедневные наблюдения и общее состояние",fields:[{id:"energy",label:"Энергия",type:"number",unit:"/10"},{id:"mood",label:"Настроение",type:"number",unit:"/10"},{id:"sleep",label:"Сон",type:"number",unit:"ч"},{id:"symptoms",label:"Наблюдения",type:"text"}]},
{id:"body",name:"Вес и параметры",category:"Здоровье",description:"Динамика измерений тела",fields:[{id:"weight",label:"Вес",type:"number",unit:"кг"},{id:"waist",label:"Талия",type:"number",unit:"см"},{id:"hips",label:"Бёдра",type:"number",unit:"см"},{id:"chest",label:"Грудь",type:"number",unit:"см"}]},
{id:"nutrition",name:"Питание",category:"Здоровье",description:"Питание, калории и макронутриенты",fields:[{id:"calories",label:"Калории",type:"number",unit:"ккал"},{id:"protein",label:"Белки",type:"number",unit:"г"},{id:"fat",label:"Жиры",type:"number",unit:"г"},{id:"carbs",label:"Углеводы",type:"number",unit:"г"},{id:"water",label:"Вода",type:"number",unit:"мл"}]},
{id:"training",name:"Тренировки",category:"Здоровье",description:"Упражнения, объём и нагрузка",fields:[{id:"workout",label:"Тренировка",type:"text"},{id:"duration",label:"Длительность",type:"number",unit:"мин"},{id:"sets",label:"Подходы",type:"number"},{id:"reps",label:"Повторения",type:"number"},{id:"load",label:"Нагрузка",type:"number",unit:"кг"}]},
{id:"cycle",name:"Цикл и наблюдения",category:"Личное",description:"Календарь дат и личные заметки",fields:[{id:"phase",label:"Фаза / отметка",type:"select",options:["Менструация","Фолликулярная","Овуляция","Лютеиновая","Другое"]},{id:"symptoms",label:"Наблюдения",type:"text"},{id:"wellbeing",label:"Самочувствие",type:"number",unit:"/10"}]},
{id:"relationships",name:"Отношения",category:"Личное",description:"События, впечатления и записи",fields:[{id:"event",label:"Событие",type:"text"},{id:"mood",label:"Эмоциональная оценка",type:"number",unit:"/10"},{id:"important",label:"Важное событие",type:"boolean"}]},
{id:"learning",name:"Обучение",category:"Развитие",description:"Занятия и динамика обучения",fields:[{id:"subject",label:"Предмет / навык",type:"text"},{id:"duration",label:"Время занятия",type:"number",unit:"мин"},{id:"progress",label:"Прогресс",type:"number",unit:"%"},{id:"completed",label:"Занятие завершено",type:"boolean"}]},
{id:"habits",name:"Привычки",category:"Развитие",description:"Регулярность и выполнение привычек",fields:[{id:"habit",label:"Привычка",type:"text"},{id:"done",label:"Выполнено",type:"boolean"},{id:"quantity",label:"Количество",type:"number"}]}
];
export const emptyTrackers=():TrackersData=>({version:1,trackers:[]});
export function readTrackers():TrackersData{try{const raw=localStorage.getItem(TRACKERS_KEY);if(!raw)return emptyTrackers();const value=JSON.parse(raw);return {version:1,trackers:Array.isArray(value.trackers)?value.trackers:[]};}catch{return emptyTrackers();}}
export function saveTrackers(value:TrackersData){localStorage.setItem(TRACKERS_KEY,JSON.stringify(value));window.dispatchEvent(new Event("fox-trackers-updated"));}
export const trackerId=()=>crypto.randomUUID();
export const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
