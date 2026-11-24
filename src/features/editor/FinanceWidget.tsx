import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDownRight, ArrowUpRight, Plus, X, Wallet, CalendarClock, Target, HandCoins, Clock3, Eye, EyeOff } from "lucide-react";
import type { TableData } from "../tables/values";

export type FinanceKind = "balance"|"trend"|"income"|"expense"|"expenseCategories"|"payments"|"goals"|"incomeCategories"|"debts"|"recent";
type Cell = string|number|boolean;
type RecordRow = TableData["rows"][number];
type FinanceProps = {kind:FinanceKind;tables:TableData[];onCreated?:()=>void;background?:"mountains"|"sunset"|"plain"};
type EntryType = "income"|"expense"|"payment"|"debt"|"goal";
const money=(num:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(num)+" ₽";
const normalize=(value:unknown)=>String(value??"").trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
const getField=(table:TableData, row:RecordRow, names:string[]):string=>{
  const column=table.columns.find(c=>names.some(name=>normalize(c.name)===normalize(name)));
  return column?String(row.cells[column.id]??""):"";
};
const readAmount=(table:TableData,row:RecordRow,keys:string[]=["Сумма"])=>{
  const raw=getField(table,row,keys).replace(/\s/g,"").replace(",",".");
  const value=Number(raw);return Number.isFinite(value)?Math.abs(value):0;
};
const transactionType=(table:TableData,row:RecordRow)=>{
  const str=normalize(getField(table,row,["Тип операции","Тип","Доход/расход"]));
  return str.includes("доход")||str.includes("поступ")||str==="income"?"income":str.includes("расход")||str.includes("списан")||str==="expense"?"expense":null;
};
const findTable=(tables:TableData[],part:string)=>tables.find(t=>normalize(t.name).includes(normalize(part)));
const monthKey=(date:string)=>/^\d{4}-\d{2}/.test(date)?date.slice(0,7):"";
const monthLabel=(key:string)=>new Date(key+"-01T12:00:00").toLocaleDateString("ru-RU",{month:"short"}).replace(".","");
const shortDate=(iso:string)=>{const date=new Date(iso+"T12:00:00");return Number.isNaN(date.getTime())?"—":date.toLocaleDateString("ru-RU",{day:"numeric",month:"short"});};
const signed=(sum:number,type:"income"|"expense")=>(type==="expense"?"− " : "+ ")+money(sum);
const PALETTE=["#f06432","#ff966c","#ffc0a6","#e5c8b9","#b7a7a0","#f7dfd4","#a5c69b"];
type FinanceForm={name:string;amount:string;date:string;category:string;period:string;direction:string;next:string;target:string;current:string};
const localDate=()=>{const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,"0"),String(now.getDate()).padStart(2,"0")].join("-");};
const newForm=():FinanceForm=>({name:"",amount:"",date:localDate(),category:"",period:"мес",direction:"owe",next:"",target:"",current:""});
const formTitles:Record<EntryType,string>={income:"Добавить доход",expense:"Добавить расход",payment:"Добавить обязательный платёж",debt:"Добавить долг",goal:"Добавить финансовую цель"};
const iconFor=(name:string)=>name.trim().slice(0,1).toLocaleUpperCase("ru")||"•";

function AddEntry({kind,tables,onClose,onCreated}:{kind:EntryType;tables:TableData[];onClose:()=>void;onCreated?:()=>void}){
  const [form,setForm]=useState<FinanceForm>(newForm);
  const [error,setError]=useState("");
  const input=(field:keyof FinanceForm)=>(event:ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setForm(prev=>({...prev,[field]:event.target.value}));
  const moneyTable=findTable(tables,"ФИНАНСЫ (ОПЕРАЦИИ)");
  const paymentTable=findTable(tables,"ФИНАНСЫ (ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ)");
  const debtTable=findTable(tables,"ФИНАНСЫ (ДОЛГИ)");
  const goalTable=findTable(tables,"ФИНАНСЫ (ЦЕЛИ)");
  const table=(kind==="income"||kind==="expense"?moneyTable:kind==="payment"?paymentTable:kind==="debt"?debtTable:goalTable);
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!table){setError("Не найдена таблица источника. Создайте финансовый шаблон заново или подключите таблицу в редакторе.");return;}
    const rows=JSON.parse(localStorage.getItem("fox-tables-v1")??"[]") as TableData[];
    const target=rows.find(t=>t.id===table.id);
    if(!target){setError("Исходная таблица недоступна.");return;}
    const amount=Number(form.amount.replace(",","."));
    if(kind!=="goal"&&!(amount>0)){setError("Укажите сумму больше нуля.");return;}
    const cells:Record<string,Cell>={};
    const values:Record<string,Cell>=(kind==="income"||kind==="expense")
      ?{"Товар":form.name,"Сумма":amount,"Валюта":"RUB","Дата":form.date,"Категория":form.category||"Без категории","Тип операции":kind==="income"?"Доход":"Расход"}
      :kind==="payment"
      ?{"Платёж":form.name,"Сумма":amount,"Категория":form.category,"Дата":form.next||form.date,"Периодичность":form.period,"Следующий платёж":form.next||form.date}
      :kind==="debt"
      ?{"Кому":form.name,"Сумма":amount,"Валюта":"RUB","Срок":form.next,"Статус":form.direction==="owe"?"Я должна":"Должны мне","Направление":form.direction==="owe"?"Мой долг":"Должны мне"}
      :{"Цель":form.name,"Накоплено":Number(form.current.replace(",","."))||0,"Сумма":Number(form.target.replace(",","."))||0,"Срок":form.next};
    for(const col of target.columns)if(Object.prototype.hasOwnProperty.call(values,col.name))cells[col.id]=values[col.name];
    const next=rows.map(row=>row.id===target.id?{...row,updatedAt:new Date().toISOString(),rows:[...row.rows,{id:crypto.randomUUID(),cells}]}:row);
    try{localStorage.setItem("fox-tables-v1",JSON.stringify(next));window.dispatchEvent(new Event("fox-tables-updated"));onCreated?.();onClose();}
    catch{setError("Не удалось сохранить запись. Проверьте свободное место браузера.");}
  }
  return <div className="finance-modal-shade" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="finance-modal" role="dialog" aria-modal="true" aria-label={formTitles[kind]}>
      <header><h3>{formTitles[kind]}</h3><button type="button" aria-label="Закрыть" onClick={onClose}><X size={18}/></button></header>
      <form onSubmit={submit}>
        <label>{kind==="goal"?"Название цели":kind==="debt"?"Кому / кто":kind==="payment"?"Название платежа":"Название операции"}<input required autoFocus value={form.name} onChange={input("name")} placeholder="Введите название"/></label>
        {kind==="debt"&&<label>Направление<select value={form.direction} onChange={input("direction")}><option value="owe">Я должна</option><option value="owed">Должны мне</option></select></label>}
        {kind==="goal"?<>
          <label>Целевая сумма, ₽<input required type="number" min="1" step="0.01" value={form.target} onChange={input("target")}/></label>
          <label>Уже накоплено, ₽<input type="number" min="0" step="0.01" value={form.current} onChange={input("current")}/></label>
        </>:<label>Сумма, ₽<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={input("amount")}/></label>}
        {(kind==="income"||kind==="expense"||kind==="payment")&&<label>Категория<input value={form.category} onChange={input("category")} placeholder="Например, продукты"/></label>}
        {(kind==="income"||kind==="expense")&&<label>Дата<input type="date" value={form.date} onChange={input("date")} required/></label>}
        {kind==="payment"&&<><label>Периодичность<select value={form.period} onChange={input("period")}><option value="нед">Каждую неделю</option><option value="мес">Каждый месяц</option><option value="год">Каждый год</option><option value="раз">Разовый платёж</option></select></label><label>Следующий платёж<input type="date" value={form.next} onChange={input("next")} required/></label></>}
        {(kind==="goal"||kind==="debt")&&<label>{kind==="goal"?"Желаемый срок (необязательно)":"Срок возврата (необязательно)"}<input type="date" value={form.next} onChange={input("next")}/></label>}
        {error&&<p className="finance-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose}>Отмена</button><button type="submit">Добавить</button></footer>
      </form>
    </section>
  </div>;
}

export default function FinanceWidget({kind,tables,onCreated,background="mountains"}:FinanceProps){
  const [adding,setAdding]=useState<EntryType|null>(null);
  const [balanceVisible,setBalanceVisible]=useState(true);
  const transactions=findTable(tables,"ФИНАНСЫ (ОПЕРАЦИИ)");
  const bills=findTable(tables,"ФИНАНСЫ (ОБЯЗАТЕЛЬНЫЕ ПЛАТЕЖИ)");
  const debts=findTable(tables,"ФИНАНСЫ (ДОЛГИ)");
  const goals=findTable(tables,"ФИНАНСЫ (ЦЕЛИ)");
  const income=transactions?.rows.filter(row=>transactionType(transactions,row)==="income")??[];
  const expense=transactions?.rows.filter(row=>transactionType(transactions,row)==="expense")??[];
  const total=(rows:RecordRow[],table?:TableData)=>table?rows.reduce((sum,row)=>sum+readAmount(table,row),0):0;
  const inTotal=total(income,transactions),outTotal=total(expense,transactions);
  const currentMonth=new Date().toISOString().slice(0,7);
  const inMonth=total(income.filter(r=>monthKey(getField(transactions!,r,["Дата"]))===currentMonth),transactions);
  const outMonth=total(expense.filter(r=>monthKey(getField(transactions!,r,["Дата"]))===currentMonth),transactions);
  const button=(entry:EntryType)=><button type="button" className="finance-add" title={formTitles[entry]} aria-label={formTitles[entry]} onClick={event=>{event.stopPropagation();setAdding(entry);}}><Plus size={18}/></button>;
  const empty=(text:string)=><p className="finance-empty">{text}</p>;
  let content:ReactNode=null;
  if(kind==="balance")content=<div className="finance-balance">
    <div className="finance-balance-heading"><span>Текущий баланс</span><button aria-label={balanceVisible?"Скрыть баланс":"Показать баланс"} onClick={()=>setBalanceVisible(v=>!v)}>{balanceVisible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>
    <strong>{balanceVisible?money(inTotal-outTotal):"••••••"}</strong><small>По записанным операциям · ₽</small>
    <span className="finance-balance-footer"><Wallet size={15}/> {income.length+expense.length?"Доходы − расходы":"Добавьте первую операцию"}</span>
  </div>;
  if(kind==="income"||kind==="expense")content=<div className={"finance-kpi "+kind}>
    <span className="finance-kpi-icon">{kind==="income"?<ArrowUpRight size={25}/>:<ArrowDownRight size={25}/>}</span>
    <div><span>{kind==="income"?"Доходы":"Расходы"}</span><strong>{money(kind==="income"?inMonth:outMonth)}</strong><small>За текущий месяц</small></div>
    {button(kind)}
  </div>;
  if(kind==="trend"){
    const now=new Date();const months=Array.from({length:6},(_,i)=>{const date=new Date(now.getFullYear(),now.getMonth()-5+i,1);return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");});
    const series=months.map(month=>({month,income:total(income.filter(row=>monthKey(getField(transactions!,row,["Дата"]))===month),transactions),expense:total(expense.filter(row=>monthKey(getField(transactions!,row,["Дата"]))===month),transactions)}));
    const max=Math.max(1,...series.flatMap(item=>[item.income,item.expense]));
    content=<div className="finance-trend"><div className="finance-key"><span><i/> Доходы</span><span><i/> Расходы</span></div>
      <div className="finance-plot">{series.map(m=><div key={m.month} className="finance-plot-month"><div className="finance-plot-bars"><span title={"Доходы: "+money(m.income)} style={{height:(m.income/max*100)+"%"}}/><span title={"Расходы: "+money(m.expense)} style={{height:(m.expense/max*100)+"%"}}/></div><small>{monthLabel(m.month)}</small></div>)}</div>
      {!income.length&&!expense.length&&<span className="finance-chart-hint">График появится после добавления операций</span>}
    </div>;
  }
  if(kind==="expenseCategories"||kind==="incomeCategories"){
    const rows=(kind==="expenseCategories"?expense:income).filter(row=>monthKey(getField(transactions!,row,["Дата"]))===currentMonth);
    const sums=new Map<string,number>();
    if(transactions)for(const row of rows){const name=getField(transactions,row,["Категория"])||"Без категории";sums.set(name,(sums.get(name)||0)+readAmount(transactions,row));}
    const data=[...sums].sort((a,b)=>b[1]-a[1]);const sum=[...sums.values()].reduce((a,b)=>a+b,0);
    let running=0;
    const gradient=data.map(([_,v],i)=>{const begin=running;running+=v/Math.max(1,sum)*100;return PALETTE[i%PALETTE.length]+" "+begin+"% "+running+"%";}).join(", ");
    content=<div className="finance-categories"><div className="finance-category-ring" style={{background:data.length?"conic-gradient("+gradient+")":undefined}}><div><strong>{money(sum)}</strong><small>в этом месяце</small></div></div><div className="finance-category-legend">{data.slice(0,6).map(([name,value],i)=><div key={name}><i style={{background:PALETTE[i%PALETTE.length]}}/><span title={name}>{name}</span><b>{Math.round(value/Math.max(1,sum)*100)}%</b></div>)}{!data.length&&empty("Пока нет операций по категориям")}</div></div>;
  }
  if(kind==="payments"){
    content=<div className="finance-card-stack">{(bills?.rows??[]).slice().sort((a,b)=>getField(bills!,a,["Следующий платёж","Дата"]).localeCompare(getField(bills!,b,["Следующий платёж","Дата"]))).slice(0,6).map(row=><div className="finance-entry" key={row.id}><span className="finance-entry-icon"><CalendarClock size={18}/></span><div><b>{getField(bills!,row,["Платёж"])||"Платёж"}</b><small>{getField(bills!,row,["Периодичность"])||"раз"} · {shortDate(getField(bills!,row,["Следующий платёж","Дата"]))}</small></div><strong>{money(readAmount(bills!,row))}</strong></div>)}{!bills?.rows.length&&empty("Добавьте обязательные платежи, чтобы видеть суммы и следующие даты.")}</div>;
  }
  if(kind==="goals"){
    content=<div className="finance-card-stack">{(goals?.rows??[]).slice(0,5).map(row=>{const target=readAmount(goals!,row,["Сумма"]);const current=readAmount(goals!,row,["Накоплено"]);const percent=target?Math.min(100,current/target*100):0;return <div className="finance-goal" key={row.id}><div><span className="finance-entry-icon"><Target size={18}/></span><b>{getField(goals!,row,["Цель"])||"Без названия"}</b><strong>{money(target)}</strong></div><div className="finance-goal-track"><i style={{width:percent+"%"}}/></div><small>{money(current)} · {Math.round(percent)}%</small></div>;})}{!goals?.rows.length&&empty("Пока нет финансовых целей. Нажмите «+», чтобы создать первую.")}</div>;
  }
  if(kind==="debts"){
    content=<div className="finance-card-stack">{(debts?.rows??[]).slice(0,6).map(row=>{const direction=normalize(getField(debts!,row,["Направление","Статус"]));const owed=direction.includes("мне");return <div className={"finance-debt "+(owed?"positive":"negative")} key={row.id}><span className="finance-debt-avatar">{iconFor(getField(debts!,row,["Кому"]))}</span><div><b>{getField(debts!,row,["Кому"])||"Без имени"}</b><small>{owed?"Должны мне":"Мой долг"}{getField(debts!,row,["Срок"])?" · до "+shortDate(getField(debts!,row,["Срок"])):""}</small></div><strong>{(owed?"+ ":"− ")+money(readAmount(debts!,row))}</strong></div>;})}{!debts?.rows.length&&empty("Пока долгов нет. Добавьте запись с указанием направления.")}</div>;
  }
  if(kind==="recent"){
    const sorted=(transactions?.rows??[]).slice().sort((a,b)=>getField(transactions!,b,["Дата"]).localeCompare(getField(transactions!,a,["Дата"]))).slice(0,6);
    content=<div className="finance-card-stack">{sorted.map(row=>{const type=transactionType(transactions!,row);return <div className="finance-entry finance-transaction" key={row.id}><span className="finance-entry-icon">{type==="income"?<ArrowUpRight size={18}/>:<ArrowDownRight size={18}/>}</span><div><b>{getField(transactions!,row,["Товар"])||"Операция"}</b><small>{shortDate(getField(transactions!,row,["Дата"]))}{getField(transactions!,row,["Категория"])?" · "+getField(transactions!,row,["Категория"]):""}</small></div><strong className={type==="income"?"positive":"negative"}>{signed(readAmount(transactions!,row),type==="income"?"income":"expense")}</strong></div>;})}{!sorted.length&&empty("Здесь будут последние доходы и расходы.")}</div>;
  }
  const createKind:Record<string,EntryType|undefined>={payments:"payment",goals:"goal",debts:"debt"};
  const labels:Record<FinanceKind,string>={balance:"Текущий баланс",trend:"Динамика за 6 месяцев",income:"Доходы",expense:"Расходы",expenseCategories:"Расходы по категориям",payments:"Обязательные платежи",goals:"Финансовые цели",incomeCategories:"Доходы по категориям",debts:"Долги",recent:"Последние операции"};
  return <div className={"finance-widget-inner finance-kind-"+kind+(kind==="balance"?" finance-background-"+background:"")}>
    {!["balance","income","expense"].includes(kind)&&<div className="finance-widget-title"><h3>{labels[kind]}</h3>{createKind[kind]&&button(createKind[kind]!)}</div>}
    {content}
    {adding&&createPortal(<AddEntry kind={adding} tables={tables} onClose={()=>setAdding(null)} onCreated={onCreated}/>,document.body)}
  </div>;
}
