export const TRACKERS_KEY="fox-trackers-v1";
export type FieldKind="number"|"text"|"boolean";
export type TrackerField={id:string;label:string;kind:FieldKind;unit?:string};
export type TrackerEntry={id:string;date:string;title:string;values:Record<string,string|number|boolean>;note:string;createdAt:string};
export type Tracker={id:string;name:string;description:string;category:string;icon:string;fields:TrackerField[];entries:TrackerEntry[];createdAt:string;updatedAt:string;archived?:boolean};
export type TrackersData={version:1;trackers:Tracker[]};
const f=(id:string,label:string,kind:FieldKind="number",unit=""):TrackerField=>({id,label,kind,unit});
export const TRACKER_TEMPLATES:Omit<Tracker,"id"|"entries"|"createdAt"|"updatedAt">[]=[
{name:"Здоровье и самочувствие",description:"Вес, параметры тела, сон и самочувствие",category:"Личное",icon:"heart-pulse",fields:[f("weight","Вес","number","кг"),f("chest","Грудь","number","см"),f("waist","Талия","number","см"),f("hips","Бёдра","number","см"),f("sleep","Сон","number","ч"),f("mood","Самочувствие","text")]},
{name:"Питание",description:"Питание, калории и макронутриенты",category:"Личное",icon:"utensils",fields:[f("calories","Калории","number","ккал"),f("protein","Белки","number","г"),f("fat","Жиры","number","г"),f("carbs","Углеводы","number","г"),f("water","Вода","number","мл"),f("food","Что ел(а)","text")]},
{name:"Тренировки",description:"Упражнения, нагрузка и спортивный прогресс",category:"Личное",icon:"dumbbell",fields:[f("exercise","Упражнение","text"),f("sets","Подходы","number"),f("reps","Повторения","number"),f("weight","Вес / нагрузка","number","кг"),f("duration","Длительность","number","мин")]},
{name:"Цикл и наблюдения",description:"Календарь цикла, даты и личные наблюдения",category:"Личное",icon:"calendar-heart",fields:[f("phase","Фаза / день цикла","text"),f("symptoms","Наблюдения","text"),f("intensity","Интенсивность","text")]},
{name:"Отношения и события",description:"Дневник, важные события и совместные планы",category:"Личное",icon:"heart",fields:[f("event","Событие","text"),f("mood","Эмоции","text"),f("rating","Оценка дня","number","/10")]},
{name:"Обучение",description:"Языки, занятия и учебный прогресс",category:"Развитие",icon:"graduation-cap",fields:[f("subject","Язык / предмет","text"),f("duration","Время занятия","number","мин"),f("topic","Тема","text"),f("result","Результат","text")]},
{name:"Привычки",description:"Ежедневная регулярность и выполнение привычек",category:"Личное",icon:"repeat",fields:[f("habit","Привычка","text"),f("completed","Выполнено","boolean"),f("streak","Серия","number","дней")]},
];
export const emptyTrackers=():TrackersData=>({version:1,trackers:[]});
export function readTrackers():TrackersData{try{const value=JSON.parse(localStorage.getItem(TRACKERS_KEY)||"null");return value&&Array.isArray(value.trackers)?{version:1,trackers:value.trackers}:emptyTrackers();}catch{return emptyTrackers();}}
export function saveTrackers(value:TrackersData){localStorage.setItem(TRACKERS_KEY,JSON.stringify(value));window.dispatchEvent(new Event("fox-trackers-updated"));}
export const trackerId=()=>crypto.randomUUID();
export const trackerDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
