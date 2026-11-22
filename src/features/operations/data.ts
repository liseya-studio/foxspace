export const OPS_KEY="fox-operations-v1";
export type Transaction={id:string;title:string;amount:number;kind:"income"|"expense";date:string;category:string;projectId:string;state:"actual"|"planned";repeat:"none"|"monthly"};
export type Publication={id:string;title:string;text:string;projectId:string;date:string;status:"idea"|"draft"|"ready"|"scheduled"|"published";variants:{id:string;platform:string;text:string;url:string;views:number;date:string}[]};
export type Budget={id:string;title:string;month:string;limit:number;projectId:string;category:string};
export type LedgerItem={id:string;title:string;kind:"debt"|"saving"|"goal";target:number;actual:number;deadline:string};
export type Operations={version:1;transactions:Transaction[];publications:Publication[];budgets:Budget[];ledger:LedgerItem[]};
export const emptyOperations=():Operations=>({version:1,transactions:[],publications:[],budgets:[],ledger:[]});
export function readOperations():Operations{const raw=localStorage.getItem(OPS_KEY);if(!raw)return emptyOperations();const value=JSON.parse(raw);return {...emptyOperations(),...value};}
export function saveOperations(data:Operations){localStorage.setItem(OPS_KEY,JSON.stringify(data));window.dispatchEvent(new Event("fox-operations-updated"));}
export const uid=()=>crypto.randomUUID();
export const dateNow=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
export function totals(rows:Transaction[]){return rows.filter(t=>t.state==="actual").reduce((a,t)=>({income:a.income+(t.kind==="income"?t.amount:0),expense:a.expense+(t.kind==="expense"?t.amount:0)}),{income:0,expense:0});}
export function projectTotals(id:string,legacyIncome=0,legacyExpense=0){const t=totals(readOperations().transactions.filter(t=>t.projectId===id));return {income:legacyIncome+t.income,expense:legacyExpense+t.expense};}
export const money=(n:number)=>new Intl.NumberFormat("ru-RU",{style:"currency",currency:"RUB"}).format(n);
export const platforms=["Telegram","VK","X","TikTok","Boosty","Instagram","YouTube"];
