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
widgets:[head("Моя медиатека","Что читаю, смотрю и планирую."),widget("counter","Книг","books",{width:4}),widget("counter","Фильмов","movies",{width:4}),widget("list","Читаю","books",{label:"Название"}),widget("list","Смотрю","movies",{label:"Название"}),widget("table","Книжная полка","books",{width:12}),widget("table","Список фильмов","movies",{width:12})]},
{id:"lifestyle",name:"Лайфстайл — общий обзор",icon:"⌂",group:"Личное",description:"Личный дашборд: цели, привычки, планы, задачи и дневник.",tables:[
table("habits","Лайфстайл · Привычки",["Привычка","Дата|date","Выполнено|checkbox","Категория"]),
table("goals","Лайфстайл · Цели",["Цель","Категория","Прогресс|number","Статус","Срок|date"]),
table("journal","Лайфстайл · Дневник",["Запись","Дата|date","Настроение","Описание"]),
table("events","Лайфстайл · События",["Событие","Дата|date","Категория","Статус"])],
widgets:[head("Мой лайфстайл","Самое важное из личных баз данных в одном пространстве."),
widget("counter","Цели","goals",{width:3}),widget("counter","Привычки","habits",{width:3}),
widget("counter","События","events",{width:3}),widget("taskcount","Мои задачи",undefined,{width:3}),
widget("progress","Прогресс по целям","goals",{column:"Прогресс",width:6}),
widget("timeline","Ближайшие события","events",{column:"Дата",label:"Событие",width:6}),
widget("tasklist","Задачи",undefined,{width:6}),widget("list","Последние записи","journal",{label:"Запись",width:6}),
widget("table","Привычки","habits",{width:12})]},
{id:"learning",name:"Обучение и языки",icon:"▤",group:"Личное",description:"Направления, уроки, словарь, тесты и прогресс, включая подробные страницы направлений.",tables:[
table("subjects","Обучение · Направления",["Название","Категория","Статус|select","Уровень","Всего уроков|number","Пройдено уроков|number","Уроки|backlink","Слова|backlink","Тесты|backlink"]),
table("lessons","Обучение · Уроки",["Урок","Направление|relation","Тема","Статус|select","Дата|date","Заметки"]),
table("words","Обучение · Слова",["Слово","Направление|relation","Перевод","Тема","Изучено|checkbox"]),
table("tests","Обучение · Тесты",["Название","Направление|relation","Дата|date","Результат|number","Уровень"]),
table("materials","Обучение · Материалы",["Название","Направление|relation","Тип","Ссылка","Заметки"])],
widgets:[head("Мои направления","Уроки, результаты и учебные материалы."),
widget("counter","Направления","subjects",{width:4}),widget("counter","Уроки","lessons",{width:4}),widget("counter","Тесты","tests",{width:4}),
widget("gallery","Направления обучения","subjects",{label:"Название",width:12,height:340}),
widget("bars","Результаты тестов","tests",{column:"Результат",label:"Название",width:6}),
widget("list","Последние уроки","lessons",{label:"Урок",width:6}),
widget("table","Словарь","words",{width:12}),
widget("table","Учебные материалы","materials",{width:12})]},
{id:"planner",name:"Планировщик задач",icon:"☑",group:"Работа",description:"Задачи, календарные события, категории и ближайшие дедлайны.",tables:[
table("events","Планировщик · События",["Название","Дата|date","Время","Категория","Проект|project","Статус|select"]),
table("milestones","Планировщик · Этапы",["Этап","Проект|project","Дедлайн|date","Прогресс|number","Статус|select"])],
widgets:[head("Задачи и календарь","Единый обзор задач, событий и сроков."),
widget("taskcount","Всего задач",undefined,{width:4}),
widget("counter","События","events",{width:4}),
widget("counter","Этапы","milestones",{width:4}),
widget("tasklist","Ближайшие задачи",undefined,{width:6,height:340}),
widget("calendar","Календарь событий","events",{column:"Дата",label:"Название",width:12,height:440}),
widget("table","Расписание","events",{width:12}),
widget("table","Этапы проектов","milestones",{width:12})]},
{id:"documents",name:"Заметки и документы",icon:"▤",group:"Работа",description:"Единый каталог документов, ссылок, изображений, тегов и заметок.",tables:[
table("library","Документы · Каталог",["Название","Проект|project","Тип","Теги","Ссылка","Описание","Фото|image","Дата изменения|date"]),
table("links","Документы · Ссылки",["Название","URL","Категория","Проект|project","Теги"])],
widgets:[head("Заметки и документы","Каталог материалов и быстрый доступ к последним заметкам."),
widget("counter","Документы","library",{width:4}),
widget("counter","Ссылки","links",{width:4}),
widget("noteslist","Последние заметки",undefined,{width:4}),
widget("gallery","Документы — галерея","library",{width:12,height:390}),
widget("table","Каталог документов","library",{width:12,height:390}),
widget("list","Полезные ссылки","links",{label:"Название",width:6}),
widget("noteslist","Заметки","",{width:6})]},
{id:"social",name:"Блоги и ресурсы",icon:"▥",group:"Творчество",description:"Аккаунты, публикации, очередь, статистика и идеи по нескольким проектам.",tables:[
table("resources","Блоги · Ресурсы",["Ресурс","Проект|project","Платформа","Ссылка","Подписчики|number","Статус|select","Публикации|backlink"]),
table("posts","Блоги · Публикации",["Название","Ресурс|relation","Проект|project","Тип","Дата|date","Статус|select","Просмотры|number","Реакции|number"]),
table("metrics","Блоги · Метрики",["Дата|date","Ресурс|relation","Подписчики|number","Охват|number","Вовлечённость|number","Переходы|number"]),
table("ideas","Блоги · Банк идей",["Идея","Проект|project","Тип","Статус","Приоритет"])],
widgets:[head("Блоги и ресурсы","Общая аналитика, очередь публикаций и контент."),
widget("counter","Ресурсы","resources",{width:3}),widget("counter","Публикации","posts",{width:3}),
widget("metric","Охват","metrics",{column:"Охват",width:3}),
widget("metric","Переходы","metrics",{column:"Переходы",width:3}),
widget("line","Рост аудитории","metrics",{column:"Подписчики",label:"Дата",width:8,height:320}),
widget("donut","Публикации по площадкам","resources",{label:"Платформа",width:4,height:320}),
widget("gallery","Ресурсы","resources",{label:"Ресурс",width:12}),
widget("calendar","Очередь публикаций","posts",{column:"Дата",label:"Название",width:12,height:410}),
widget("list","Банк идей","ideas",{label:"Идея",width:6}),
widget("table","Все публикации","posts",{width:12})]},
{id:"client-work",name:"Работа — заказы и клиенты",icon:"▣",group:"Работа",description:"Клиенты, проекты, сметы, услуги, платежи и заявки из разных источников.",tables:[
table("clients","Работа · Клиенты",["Имя","Компания","Контакт","Источник","Статус","Заметки","Заказы|backlink"]),
table("orders","Работа · Заказы",["Название","Проект|project","Клиент|relation","Категория","Источник","Дедлайн|date","Статус|select","Бюджет|number","Прогресс|number","Смета|backlink","Оплаты|backlink","Оплачено|rollup"]),
table("services","Работа · Услуги",["Услуга","Категория","Цена|number","Описание"]),
table("orderitems","Работа · Смета",["Заказ|relation","Услуга","Количество|number","Цена|number","Сумма|formula"]),
table("payments","Работа · Оплаты",["Заказ|relation","Дата|date","Сумма|number","Статус"]),
table("leads","Работа · Лиды",["Клиент|relation","Источник","Дата|date","Запрос","Статус"])],
widgets:[head("Рабочий стол","Заказы, деньги и текущие сроки в одном месте."),
widget("counter","Заказы","orders",{width:3}),widget("counter","Клиенты","clients",{width:3}),
widget("metric","Стоимость заказов","orders",{column:"Бюджет",width:3}),
widget("metric","Оплаты","payments",{column:"Сумма",width:3}),
widget("kanban","Заказы по статусам","orders",{width:8,height:370}),
widget("timeline","Ближайшие дедлайны","orders",{column:"Дедлайн",label:"Название",width:4,height:370}),
widget("table","Сметы","orderitems",{width:6}),
widget("list","Услуги и прайс","services",{label:"Услуга",width:6}),
widget("table","Контакты клиентов","clients",{width:12})]}

];
export type StoredWidget = {id:string;type:string;title:string;tableId?:string;columnId?:string;labelColumnId?:string;body?:string;width:number;height:number;aggregate?:string;filter:Record<string,string>;limit:number;target:number;startDate?:string;financeKind?:string;financeRow?:number;financeColumn?:number;financeRowSpan?:number};
type PresetColumn = {id:string;name:string;type:string;options?:string[];formulaSourceId?:string;formulaSecondSourceId?:string;formulaOperator?:string};
function createPresetColumns(fields:[string,string][],existing:PresetColumn[]=[]):PresetColumn[]{
  const added:PresetColumn[]=fields.map(([name,type])=>({id:crypto.randomUUID(),name,type,...(type==="select"?{options:["Новый","В работе","Готово"]}:{})}));
  const all=[...existing,...added];
  // A line-item amount is calculated directly from quantity and unit price.
  for(const column of added){
    if(column.type!=="formula"||column.name.toLocaleLowerCase("ru")!=="сумма")continue;
    const quantity=all.find(item=>item.type==="number"&&item.name.toLocaleLowerCase("ru")==="количество");
    const price=all.find(item=>item.type==="number"&&item.name.toLocaleLowerCase("ru")==="цена");
    if(quantity&&price){column.formulaSourceId=quantity.id;column.formulaSecondSourceId=price.id;column.formulaOperator="*";}
  }
  return added;
}
export function instantiatePreset(preset:ScreenPreset,available:{id:string;name:string;columns:{id:string;name:string;type:string}[]}[]){
 const existing=[...available];
 const newTables:{id:string;name:string;columns:{id:string;name:string;type:string}[];rows:unknown[];updatedAt:string}[]=[];
 const ids=new Map<string,string>();
 const updatedTables:typeof available=[];
 for(const schema of preset.tables){
   const norm=(text:string)=>text.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]/gi,"");
   const matches=existing.filter(tab=>[schema.title,...(schema.aliases??[])].some(name=>norm(tab.name)===norm(name)||norm(tab.name).endsWith(norm(name))));
   const found=matches[0];
   if(found){
     // Reuse an existing base without touching its records. Extend the schema
     // non-destructively if the selected screen needs additional fields.
     const missing=schema.columns.filter(([name])=>!found.columns.some(col=>norm(col.name)===norm(name)));
     if(missing.length){
       const updated={...found,columns:[...found.columns,...createPresetColumns(missing,found.columns)]};
       existing[existing.findIndex(tab=>tab.id===found.id)]=updated;
       updatedTables.push(updated);
     }
     ids.set(schema.key,found.id);continue;
   }
   const table={id:crypto.randomUUID(),name:schema.title,columns:createPresetColumns(schema.columns),rows:[],updatedAt:new Date().toISOString()};
   newTables.push(table);existing.push(table);ids.set(schema.key,table.id);
 }
 // Resolve semantic relations after every table has an ID. Existing non-relation
 // fields are intentionally left unchanged to protect previously entered values.
 const targets:Record<string,Record<string,string>>={
   learning:{ "lessons.Направление":"subjects", "words.Направление":"subjects", "tests.Направление":"subjects", "materials.Направление":"subjects" },
   social:{ "posts.Ресурс":"resources", "metrics.Ресурс":"resources" },
   "client-work":{ "orders.Клиент":"clients", "orderitems.Заказ":"orders", "payments.Заказ":"orders", "leads.Клиент":"clients" }
 };
 for(const [source,targetKey] of Object.entries(targets[preset.id]??{})){
   const split=source.indexOf(".");
   const sourceKey=source.slice(0,split),field=source.slice(split+1);
   const table=existing.find(item=>item.id===ids.get(sourceKey));
   const targetId=ids.get(targetKey);
   if(!table||!targetId)continue;
   const column=table.columns.find(item=>item.name===field&&item.type==="relation");
   if(!column)continue;
   const patched={...table,columns:table.columns.map(item=>item.id===column.id?{...item,relationTableId:targetId}:item)};
   existing[existing.findIndex(item=>item.id===table.id)]=patched;
   const createdIndex=newTables.findIndex(item=>item.id===table.id);
   if(createdIndex>=0)newTables[createdIndex]={...newTables[createdIndex],columns:patched.columns};
   else{
     const prior=updatedTables.findIndex(item=>item.id===table.id);
     if(prior>=0)updatedTables[prior]=patched;
     else updatedTables.push(patched);
   }
 }

 // Create readable reverse links without copying any records into the target.
 // Schema links are attached only where these fields were explicitly declared.
 const backlinks:Record<string,[string,string,string,string][]> = {
   learning:[
     ["subjects","Уроки","lessons","Направление"],
     ["subjects","Слова","words","Направление"],
     ["subjects","Тесты","tests","Направление"]
   ],
   social:[["resources","Публикации","posts","Ресурс"]],
   "client-work":[
     ["clients","Заказы","orders","Клиент"],
     ["orders","Смета","orderitems","Заказ"],
     ["orders","Оплаты","payments","Заказ"]
   ]
 };
 const reverseByKey=new Map<string,string>();
 for(const [destinationKey,display,sourceKey,forwardName] of backlinks[preset.id]??[]){
   const dest=existing.find(item=>item.id===ids.get(destinationKey));
   const source=existing.find(item=>item.id===ids.get(sourceKey));
   const link=source?.columns.find(item=>item.name===forwardName&&item.type==="relation");
   const backward=dest?.columns.find(item=>item.name===display&&item.type==="backlink");
   if(!dest||!source||!link||!backward)continue;
   const columns=dest.columns.map(col=>col.id===backward.id?{...col,backlinkSourceTableId:source.id,backlinkSourceColumnId:link.id}:col);
   const patched={...dest,columns};
   existing[existing.findIndex(table=>table.id===dest.id)]=patched;
   const newIndex=newTables.findIndex(table=>table.id===dest.id);
   if(newIndex>=0)newTables[newIndex]={...newTables[newIndex],columns};
   else{
     const idx=updatedTables.findIndex(table=>table.id===dest.id);
     if(idx>=0)updatedTables[idx]=patched;else updatedTables.push(patched);
   }
   reverseByKey.set(destinationKey+"."+display,backward.id);
 }
 if(preset.id==="client-work"){
   const order=existing.find(table=>table.id===ids.get("orders"));
   const payments=existing.find(table=>table.id===ids.get("payments"));
   const paid=order?.columns.find(col=>col.name==="Оплачено"&&col.type==="rollup");
   const amount=payments?.columns.find(col=>col.name==="Сумма"&&col.type==="number");
   const link=reverseByKey.get("orders.Оплаты");
   if(order&&paid&&amount&&link){
     const columns=order.columns.map(col=>col.id===paid.id?{...col,rollupRelationId:link,rollupTargetId:amount.id,rollupAggregate:"sum"}:col);
     const patched={...order,columns};
     existing[existing.findIndex(table=>table.id===order.id)]=patched;
     const idx=newTables.findIndex(table=>table.id===order.id);
     if(idx>=0)newTables[idx]={...newTables[idx],columns};
     else{
       const updatedIndex=updatedTables.findIndex(table=>table.id===order.id);
       if(updatedIndex>=0)updatedTables[updatedIndex]=patched;else updatedTables.push(patched);
     }
   }
 }
 const widgets:StoredWidget[]=preset.widgets.map(def=>{
   const tab=existing.find(item=>item.id===ids.get(def.source??""));
   const find=(name?:string)=>tab?.columns.find(col=>col.name.toLocaleLowerCase("ru")===name?.toLocaleLowerCase("ru"))?.id;
   return {id:crypto.randomUUID(),type:def.type,title:def.title,tableId:tab?.id,columnId:find(def.column),labelColumnId:find(def.label),body:def.body??"",width:def.width??6,height:def.height??205,aggregate:def.aggregate??"sum",filter:{},limit:8,target:100,startDate:def.startDate,financeKind:def.financeKind,financeRow:def.financeRow,financeColumn:def.financeColumn,financeRowSpan:def.financeRowSpan};
 });
 return {newTables,updatedTables,widgets,primaryTableId:ids.values().next().value as string|undefined};
}
