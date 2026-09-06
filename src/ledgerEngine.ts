import type { Expense, ExpenseParticipant, Settlement, SplitType, Trip, TripMember } from "./types";

export const splitLabels: Record<SplitType, string> = { equal: "均分", exact: "按金额", percentage: "按比例", shares: "按份数", personal: "个人" };
export function membersOf(trip: Trip): TripMember[] {
  return trip.members?.length ? trip.members : [{ id: `${trip.id}:me`, name: "我", avatar: "🙂", isMe: true }];
}
export function currencyCode(currency: string): string {
  const code = ({ "€": "EUR", "£": "GBP", "¥": "CNY", "￥": "CNY", "$": "USD" } as Record<string,string>)[currency.trim()] || currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("请选择三位币种代码，例如 EUR、CHF");
  return code;
}
export function currencyDigits(currency: string): number { return new Intl.NumberFormat("en", { style:"currency", currency:currencyCode(currency) }).resolvedOptions().maximumFractionDigits!; }
export function minor(amount: number, currency: string): number {
  const value = Number(amount), scale = 10 ** currencyDigits(currency);
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * scale)) || Math.abs(value * scale - Math.round(value * scale)) > 0.00001) throw new Error("金额精度不正确或数值过大");
  return Math.round(value * scale);
}
export function money(amount: number, currency: string) { return `${currencyCode(currency)} ${amount.toFixed(currencyDigits(currency))}`; }
export function normalizeExpense(expense: Expense, members: TripMember[]): Expense {
  const me = members.find(member => member.isMe) || members[0];
  return { ...expense, paidBy: expense.paidBy || me.id, splitType: expense.splitType || "personal",
    participants: expense.participants !== undefined ? expense.participants : [{ memberId: expense.paidBy || me.id }],
    transactionType: expense.transactionType || (expense.amount < 0 ? "refund" : "expense"), amount: Math.abs(expense.amount) };
}

// All math uses integer minor units; remainder cents follow stable participant order.
export function calculateExpenseShares(expense: Expense, members: TripMember[]): Array<{memberId:string; amount:number}> {
  const e = normalizeExpense(expense, members), total = minor(e.amount,e.currency), scale = 10 ** currencyDigits(e.currency);
  if (total <= 0) throw new Error("金额必须大于 0");
  if (!members.some(m => m.id === e.paidBy)) throw new Error("请选择有效付款人");
  if (!Object.hasOwn(splitLabels,e.splitType!)) throw new Error("不支持的分账方式");
  const people = e.participants!;
  if (!people.length || new Set(people.map(p=>p.memberId)).size !== people.length || people.some(p=>!members.some(m=>m.id===p.memberId))) throw new Error("请选择有效且不重复的参与人");
  if (e.splitType === "personal" && people.length !== 1) throw new Error("个人消费只能有一位承担人");
  if (e.splitType === "exact") {
    const amounts = people.map(p=>minor(p.amount ?? NaN,e.currency));
    if (amounts.some(v=>v<0)) throw new Error("分摊金额不能小于 0");
    const sum=amounts.reduce((a,b)=>a+b,0);
    if (sum !== total) throw new Error(`合计 ${money(sum/scale,e.currency)} / ${money(e.amount,e.currency)} · ${sum<total?"还差":"超出"} ${money(Math.abs(total-sum)/scale,e.currency)}`);
    return people.map((p,i)=>({memberId:p.memberId,amount:amounts[i]/scale}));
  }
  const weights=people.map(p=>e.splitType==="percentage" ? p.percentage ?? NaN : e.splitType==="shares" ? p.shares ?? NaN : 1);
  if (weights.some(w=>!Number.isFinite(w)||w<0) || !weights.some(w=>w>0)) throw new Error("请填写有效比例或份数");
  const weight=weights.reduce((a,b)=>a+b,0);
  if (!Number.isFinite(weight)) throw new Error("份数或比例数值过大");
  if (e.splitType==="percentage" && Math.abs(weight-100)>0.000001) throw new Error(`比例合计 ${weight}% / 100%`);
  const values=weights.map(w=>total*w/weight), cents=values.map(Math.floor);
  let rest=total-cents.reduce((a,b)=>a+b,0);
  const rank=values.map((v,i)=>({i,remainder:v-cents[i]})).sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
  for(let i=0;rest>0;i++,rest--) cents[rank[i%rank.length].i]++;
  return people.map((p,i)=>({memberId:p.memberId,amount:cents[i]/scale}));
}
export function validateSplit(expense: Expense, members: TripMember[]): string {
  try { calculateExpenseShares(expense,members); return ""; } catch(e) { return (e as Error).message; }
}
export function prepareExpense(expense: Expense, members: TripMember[]): Expense {
  const e=normalizeExpense(expense,members);
  if (!e.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("请填写用途和完整日期");
  const shares=calculateExpenseShares(e,members);
  return { ...e, participants:e.participants!.map(p=>({...p,amount:shares.find(s=>s.memberId===p.memberId)!.amount})), updatedAt:new Date().toISOString(), createdAt:e.createdAt || new Date().toISOString() };
}
export interface CurrencyLedger { currency:string; total:number; paid:Record<string,number>; shares:Record<string,number>; balances:Record<string,number> }
export function calculateMemberBalances(trip: Trip): CurrencyLedger[] {
  const members=membersOf(trip), buckets=new Map<string,CurrencyLedger>();
  function bucket(currency:string) {
    const code=currencyCode(currency);
    if(!buckets.has(code)) buckets.set(code,{currency:code,total:0,paid:Object.fromEntries(members.map(m=>[m.id,0])),shares:Object.fromEntries(members.map(m=>[m.id,0])),balances:Object.fromEntries(members.map(m=>[m.id,0]))});
    return buckets.get(code)!;
  }
  for(const raw of trip.expenses) {
    const e=normalizeExpense(raw,members), b=bucket(e.currency), sign=e.transactionType==="refund"?-1:1, amount=minor(e.amount,e.currency)*sign;
    const shares=calculateExpenseShares(e,members);
    b.total+=amount; b.paid[e.paidBy!]+=amount; b.balances[e.paidBy!]+=amount;
    for(const p of shares){const v=minor(p.amount,e.currency)*sign;b.shares[p.memberId]+=v;b.balances[p.memberId]-=v;}
  }
  for(const s of trip.settlements || []) {
    if(s.fromMemberId===s.toMemberId || !members.some(m=>m.id===s.fromMemberId) || !members.some(m=>m.id===s.toMemberId)) throw new Error("结算记录的成员无效");
    const amount=minor(s.amount,s.currency); if(amount<=0) throw new Error("结算金额须大于0");
    const b=bucket(s.currency); b.balances[s.fromMemberId]+=amount; b.balances[s.toMemberId]-=amount;
  }
  return [...buckets.values()].map(b=>{const scale=10**currencyDigits(b.currency);return {...b,total:b.total/scale,paid:Object.fromEntries(Object.entries(b.paid).map(([k,v])=>[k,v/scale])),shares:Object.fromEntries(Object.entries(b.shares).map(([k,v])=>[k,v/scale])),balances:Object.fromEntries(Object.entries(b.balances).map(([k,v])=>[k,v/scale]))};});
}
export type Debt = Pick<Settlement,"fromMemberId"|"toMemberId"|"amount"|"currency">;
export function simplifyDebts(ledger: CurrencyLedger): Debt[] {
  const creditors=Object.entries(ledger.balances).filter(([,v])=>v>0).map(([id,v])=>({id,v:minor(v,ledger.currency)})).sort((a,b)=>b.v-a.v);
  const debtors=Object.entries(ledger.balances).filter(([,v])=>v<0).map(([id,v])=>({id,v:-minor(v,ledger.currency)})).sort((a,b)=>b.v-a.v);
  const output:Debt[]=[]; let i=0,j=0;
  while(i<debtors.length && j<creditors.length){const amount=Math.min(debtors[i].v,creditors[j].v);output.push({fromMemberId:debtors[i].id,toMemberId:creditors[j].id,amount:amount/10**currencyDigits(ledger.currency),currency:ledger.currency});debtors[i].v-=amount;creditors[j].v-=amount;if(!debtors[i].v)i++;if(!creditors[j].v)j++;}
  // Search smaller groups for the fewest direct payments; use the bounded
  // greedy solution for large groups so the UI never stalls.
  let best=output,visits=0;
  const nodes=Object.entries(ledger.balances).map(([id,v])=>({id,v:minor(v,ledger.currency)})).filter(n=>n.v!==0);
  const memo=new Map<string,number>();
  function search(state:typeof nodes,steps:Debt[]){
    if(++visits>50000||steps.length>=best.length)return;
    const debtor=state.find(n=>n.v<0);if(!debtor){best=steps;return;}
    const key=state.map(n=>n.v).join(",");if((memo.get(key)??Infinity)<=steps.length)return;memo.set(key,steps.length);
    for(const creditor of state.filter(n=>n.v>0)){
      const amount=Math.min(-debtor.v,creditor.v);
      search(state.map(n=>({...n,v:n.id===debtor.id?n.v+amount:n.id===creditor.id?n.v-amount:n.v})),[...steps,{fromMemberId:debtor.id,toMemberId:creditor.id,amount:amount/10**currencyDigits(ledger.currency),currency:ledger.currency}]);
    }
  }
  if(nodes.length<=10)search(nodes,[]);
  return best;
}
export function calculateSettlements(trip:Trip):Debt[]{return calculateMemberBalances(trip).flatMap(simplifyDebts);}
export function expenseImpact(raw:Expense,members:TripMember[]):string {
  const e=normalizeExpense(raw,members), me=members.find(m=>m.isMe)||members[0], shares=calculateExpenseShares(e,members), own=shares.find(p=>p.memberId===me.id)?.amount||0;
  if(e.transactionType==="refund") return "退款 · 已抵消对应分摊";
  if(e.paidBy===me.id){const other=e.amount-own;return other>0?`朋友应承担 ${money(other,e.currency)}`:"个人消费";}
  return own>0?`你应给 ${members.find(m=>m.id===e.paidBy)?.name} ${money(own,e.currency)}`:"这笔不需你承担";
}
export function withParticipants(e:Expense, participants:ExpenseParticipant[]):Expense{return {...e,participants};}
