export type WidgetPreset = { type:string; title:string; source?:string; column?:string; label?:string; body?:string; width?:number; height?:number; aggregate?:string; startDate?:string; financeKind?:string; financeRow?:number; financeColumn?:number; financeRowSpan?:number; };
export type TablePreset = { key:string; title:string; columns:[string,string][]; aliases?:string[] };
export type ScreenPreset = {id:string;name:string;icon:string;description:string;group:"Личное"|"Творчество"|"Работа";tables:TablePreset[];widgets:WidgetPreset[]};
const columns=(...values:string[]):[string,string][]=>values.map(value=>{const [name,type="text"]=value.split("|");return [name,type];});
const table=(key:string,title:string,fields:string[],aliases:string[]=[]):TablePreset=>({key,title,columns:columns(...fields),aliases});
const widget=(type:string,title:string,source?:string,other:Partial<WidgetPreset>={}):WidgetPreset=>({type,title,source,...other});
const head=(title:string,body:string):WidgetPreset=>widget("heading",title,undefined,{body,width:12,height:110});
export const SCREEN_PRESETS:ScreenPreset[]=[
{id:"finance",name:"Мои финансы",icon:"finance",group:"Личное",description:"Доходы, расходы, баланс, платежи, долги и финансовые цели.",tables:[
table("money","ФИНАНСЫ (ОПЕРАЦИИ)",["Товар","Сумма|number","Валюта","Дата|date","Категория","Тип операции"]),
table("bills","ФИНАНСЫ (ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ)",["Платёж","Сумма|number","Категория","Дата|date","Периодичность","Следующий платёж|date"]),
table("debts","ФИНАНСЫ (ДОЛГИ)",["Кому","Сумма|number","Валюта","Срок|date","Статус","Направление"]),
table("goals","ФИНАНСЫ (ЦЕЛИ)",["Цель","Накоплено|number","Сумма|number","Срок|date"]),
table("shopping","Финансы (список покупок)",["Покупка","Стоимость|number","Приоритет","Куплено|checkbox"])],
widgets:[
widget("finance","Текущий баланс","money",{financeKind:"balance",financeRow:1,financeColumn:1,financeRowSpan:2,width:4,height:220}),
widget("finance","Динамика за 6 месяцев","money",{financeKind:"trend",financeRow:1,financeColumn:5,financeRowSpan:2,width:5,height:220}),
widget("finance","Доходы","money",{financeKind:"income",financeRow:1,financeColumn:10,width:4,height:105}),
widget("finance","Расходы","money",{financeKind:"expense",financeRow:2,financeColumn:10,width:4,height:105}),
widget("finance","Расходы по категориям","money",{financeKind:"expenseCategories",financeRow:3,financeColumn:1,width:4,height:310}),
widget("finance","Обязательные платежи","bills",{financeKind:"payments",financeRow:3,financeColumn:5,width:5,height:310}),
widget("finance","Финансовые цели","goals",{financeKind:"goals",financeRow:3,financeColumn:10,width:4,height:310}),
widget("finance","Доходы по категориям","money",{financeKind:"incomeCategories",financeRow:4,financeColumn:1,width:4,height:295}),
widget("finance","Долги","debts",{financeKind:"debts",financeRow:4,financeColumn:5,width:5,height:295}),
widget("finance","Последние операции","money",{financeKind:"recent",financeRow:4,financeColumn:10,width:4,height:295})
]},
{id:"travel",name:"Путешествия",icon:"✈",group:"Личное",description:"Карта посещённых стран, маршруты, даты и сборы.",tables:[
table("trips","Путешествия (поездки)",["Флаг","Страна","ISO A3","Дата въезда|date","Дата выезда|date","Статус","Город","Количество городов|number"]),
table("plans","Путешествия · Планы",["Место","Страна","Дата|date","Бюджет|number","Статус"]),
table("packing","Путешествия · Сборы",["Предмет","Поездка","Собрано|checkbox"])],
widgets:[head("Карта путешествий","Нажмите на страну, чтобы увидеть её статус, флаг и количество посещённых городов."),widget("worldmap","Интерактивная карта","trips",{width:12,height:490}),widget("counter","Записи о поездках","trips",{width:4}),widget("counter","Планы поездок","plans",{width:4}),widget("timeline","Хронология поездок","trips",{column:"Дата въезда",label:"Страна",width:8}),widget("list","Куда поеду","plans",{label:"Место",width:4}),widget("table","Реестр путешествий","trips",{width:12})]},
{id:"relationship",name:"Наши отношения",icon:"♡",group:"Личное",description:"Дни вместе, важные даты, общие планы и воспоминания.",tables:[
table("dates","Отношения · Важные даты",["Событие","Дата|date","Повторяется","Описание"]),
table("memories","Отношения · Воспоминания",["Момент","Дата|date","Место","Описание"]),
table("plans","Отношения · Наши планы",["План","Дата|date","Статус","Комментарий"])],
widgets:[head("Наша история","Всё важное о ваших отношениях в одном месте."),widget("datecount","Мы вместе",undefined,{width:6,height:215}),widget("counter","Совместные моменты","memories",{width:6}),widget("timeline","Важные даты","dates",{column:"Дата",label:"Событие"}),widget("list","Планы вдвоём","plans",{label:"План"}),widget("table","Наши воспоминания","memories",{width:12})]},
{id:"health",name:"Здоровье и тренировки",icon:"✚",group:"Личное",description:"Вес, измерения, питание, самочувствие и спорт.",tables:[
table("measure","Показатели",["Дата|date","Вес|number","Грудь|number","Талия|number","Бедра|number"]),
table("food","Дневник питания",["Дата|date","Приём пищи","Калории|number","Белки|number","Жиры|number","Углеводы|number"]),
table("workouts","Здоровье · Тренировки",["Тренировка","Дата|date","Длительность, мин|number","Тип нагрузки","Самочувствие"]),
table("wellness","Здоровье · Самочувствие",["Дата|date","Настроение","Сон, ч|number","Состояние","Заметки"])],
widgets:[head("Моё самочувствие","Личные записи и динамика — без автоматических медицинских заключений."),widget("counter","Записей о самочувствии","wellness",{width:4}),widget("counter","Тренировок","workouts",{width:4}),widget("line","Динамика веса","measure",{column:"Вес",width:8}),widget("list","Тренировки","workouts",{label:"Тренировка",width:4}),widget("table","Дневник питания","food",{width:12}),widget("table","Самочувствие","wellness",{width:12})]},
{id:"fanfiction",name:"Мои фанфики",icon:"✎",group:"Творчество",description:"Фанфики, сюжеты, персонажи, главы и публикации.",tables:[
table("stories","Фанфики · Проекты",["Название","Пейринг","Жанр","Статус","Глав|number","Описание","Дата обновления|date"],["Процессники"]),
table("characters","Фанфики · Персонажи",["Имя","Произведение","Роль","Возраст|number","Внешность","Характер","Мотивация","Связи","Референс"]),
table("plots","Фанфики · Сюжеты",["Идея","Фанфик","Этап","Конфликт","Поворот","Финал"]),
table("chapters","Фанфики · Главы",["Фанфик","Глава","Статус","Дата выхода|date","Слов|number","Заметки"]),
table("posts","Фанфики · Публикации",["Работа","Площадка","Формат","Дата|date","Статус","Просмотры|number"])],
widgets:[head("Моя писательская", "Работы, персонажи, линии сюжета и план публикаций."),widget("counter","Всего работ","stories",{width:4}),widget("counter","Персонажей","characters",{width:4}),widget("counter","Глав","chapters",{width:4}),widget("table","Каталог фанфиков","stories",{width:12}),widget("recordcards","Карточки персонажей","characters",{label:"Имя",width:12,height:340}),widget("list","Банк сюжетов","plots",{label:"Идея"}),widget("timeline","Публикации","posts",{column:"Дата",label:"Работа"}),widget("table","План глав","chapters",{width:12})]},
{id:"content",name:"Контент и статистика",icon:"◫",group:"Творчество",description:"TikTok, Telegram, VK и YouTube: календарь, идеи и показатели.",tables:[
table("posts","Контент · Публикации",["Название","Площадка","Дата|date","Статус","Просмотры|number","Реакции|number"]),
table("ideas","Банк идей",["Идея","Площадка","Формат","Статус","Приоритет"]),
table("stats","Контент · Статистика",["Площадка","Период","Просмотры|number","Подписчики|number","Реакции|number"])],
widgets:[head("Контент-план","Планируйте и анализируйте публикации по площадкам."),widget("counter","Публикаций","posts",{width:4}),widget("counter","Идей","ideas",{width:4}),widget("bars","Просмотры","stats",{column:"Просмотры",label:"Площадка"}),widget("donut","Площадки","posts",{label:"Площадка"}),widget("timeline","Календарь публикаций","posts",{column:"Дата",label:"Название"}),widget("list","Банк идей","ideas",{label:"Идея"}),widget("table","Публикации","posts",{width:12})]},
{id:"work",name:"Работа и проекты",icon:"▣",group:"Работа",description:"Проекты, клиенты, задачи, прайс и результаты.",tables:[
table("projects","Проекты",["Название","Клиент","Статус","Дедлайн|date","Бюджет|number"]),
table("services","Прайс",["Услуга","Стоимость|number","Срок","Описание"]),
table("leads","Работа · Заявки",["Заказчик","Услуга","Сумма|number","Статус","Дата|date"])],
widgets:[head("Мои проекты","Заявки, сроки, стоимость работы и рабочие задачи."),widget("counter","Проектов","projects",{width:4}),widget("counter","Заявок","leads",{width:4}),widget("metric","Стоимость заказов","leads",{column:"Сумма",width:4}),widget("table","Проекты","projects",{width:12}),widget("tasklist","Ближайшие задачи",undefined,{width:6}),widget("list","Прайс","services",{width:6})]},
{id:"media",name:"Книги и фильмы",icon:"◈",group:"Личное",description:"Библиотека, списки к просмотру и собственные заметки.",tables:[
table("books","Книги",["Название","Автор","Жанр","Статус","Оценка|number","Впечатления"]),
table("movies","Фильмы",["Название","Жанр","Статус","Оценка|number","Впечатления"])],
widgets:[head("Моя медиатека","Что читаю, смотрю и планирую."),widget("counter","Книг","books",{width:4}),widget("counter","Фильмов","movies",{width:4}),widget("list","Читаю","books",{label:"Название"}),widget("list","Смотрю","movies",{label:"Название"}),widget("table","Книжная полка","books",{width:12}),widget("table","Список фильмов","movies",{width:12})]}
];
export type StoredWidget = {id:string;type:string;title:string;tableId?:string;columnId?:string;labelColumnId?:string;body?:string;width:number;height:number;aggregate?:string;filter:Record<string,string>;limit:number;target:number;startDate?:string;financeKind?:string;financeRow?:number;financeColumn?:number;financeRowSpan?:number};
export function instantiatePreset(preset:ScreenPreset,available:{id:string;name:string;columns:{id:string;name:string;type:string}[]}[]){
 const existing=[...available];
 const newTables:{id:string;name:string;columns:{id:string;name:string;type:string}[];rows:unknown[];updatedAt:string}[]=[];
 const ids=new Map<string,string>();
 for(const schema of preset.tables){
   const norm=(text:string)=>text.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]/gi,"");
   const matches=existing.filter(tab=>[schema.title,...(schema.aliases??[])].some(name=>norm(tab.name)===norm(name)||norm(tab.name).endsWith(norm(name))));
   const found=matches[0];
   if(found){ids.set(schema.key,found.id);continue;}
   const table={id:crypto.randomUUID(),name:schema.title,columns:schema.columns.map(([name,type])=>({id:crypto.randomUUID(),name,type})),rows:[],updatedAt:new Date().toISOString()};
   newTables.push(table);existing.push(table);ids.set(schema.key,table.id);
 }
 const widgets:StoredWidget[]=preset.widgets.map(def=>{
   const tab=existing.find(item=>item.id===ids.get(def.source??""));
   const find=(name?:string)=>tab?.columns.find(col=>col.name.toLocaleLowerCase("ru")===name?.toLocaleLowerCase("ru"))?.id;
   return {id:crypto.randomUUID(),type:def.type,title:def.title,tableId:tab?.id,columnId:find(def.column),labelColumnId:find(def.label),body:def.body??"",width:def.width??6,height:def.height??205,aggregate:def.aggregate??"sum",filter:{},limit:8,target:100,startDate:def.startDate,financeKind:def.financeKind,financeRow:def.financeRow,financeColumn:def.financeColumn,financeRowSpan:def.financeRowSpan};
 });
 return {newTables,widgets,primaryTableId:ids.values().next().value as string|undefined};
}
