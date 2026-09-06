import type { AssistantOperation, Expense, Trip } from "./types";
import { uid } from "./types";
import { membersOf, prepareExpense } from "./ledgerEngine";

// JSON-schema subset for the new business operations; reject unknown fields, missing
// required values and incorrect JSON types before any write.
type Schema={type:string;required?:string[];properties?:Record<string,Schema>;items?:Schema;enum?:unknown[]};
const str:Schema={type:"string"}, num:Schema={type:"number"};
const participant:Schema={type:"object",required:["memberId"],properties:{memberId:str,amount:num,percentage:num,shares:num}};
const expenseFields:Record<string,Schema>={id:str,title:str,amount:num,currency:str,cityId:str,date:str,category:{type:"string",enum:["交通","餐饮","住宿","门票","购物","其他"]},paidBy:str,splitType:{type:"string",enum:["equal","exact","percentage","shares","personal"]},participants:{type:"array",items:participant},note:str,transactionType:{type:"string",enum:["expense","refund"]},createdAt:str,updatedAt:str};
export const businessSchemas:Record<string,Schema>={
  add_expense:{type:"object",required:["type","expense"],properties:{type:str,expense:{type:"object",required:["title","amount","paidBy","splitType","participants"],properties:expenseFields}}},
  update_expense:{type:"object",required:["type","expenseId","changes"],properties:{type:str,expenseId:str,changes:{type:"object",properties:expenseFields}}},
  add_journal:{type:"object",required:["type","cityId","journal"],properties:{type:str,cityId:str,journal:{type:"object",required:["title","text","date"],properties:{title:str,text:str,date:str}}}},
  add_member:{type:"object",required:["type","name"],properties:{type:str,name:str,avatar:str}},
  delete_record:{type:"object",required:["type","entity","id"],properties:{type:str,entity:{type:"string",enum:["expense","ticket","journal","place","day","city"]},id:str}}
};
function validate(value:unknown,schema:Schema,path:string) {
  if(schema.type==="array"){if(!Array.isArray(value))throw new Error(`${path} 应为列表`);value.forEach(v=>validate(v,schema.items!,path));return;}
  if(schema.type==="object"){
    if(!value||typeof value!=="object"||Array.isArray(value))throw new Error(`${path} 格式不正确`);
    const obj=value as Record<string,unknown>;
    for(const key of schema.required||[])if(!(key in obj))throw new Error(`${path} 缺少 ${key}；请补充付款人和参与人等信息`);
    for(const [key,v] of Object.entries(obj)){if(!schema.properties?.[key])throw new Error(`不支持字段 ${path}.${key}`);validate(v,schema.properties[key],path+"."+key);}
    return;
  }
  if(typeof value!==schema.type||(typeof value==="number"&&!Number.isFinite(value))||(schema.enum&&!schema.enum.includes(value)))throw new Error(`${path} 的值不正确`);
}
export function validateBusinessOperation(op:AssistantOperation){if(!["edit_record","create_trip","open_ticket","open_expense","optimize_route","add_city","add_place","update_place","plan_day","add_expense","update_expense","add_ticket","add_journal","add_member","delete_record"].includes(op.type))throw new Error("助手返回了不支持的操作，未修改资料");const schema=businessSchemas[op.type];if(schema)validate(op,schema,op.type);}
export function expenseFromOperation(trip:Trip,op:AssistantOperation,cityId:string):Expense|null {
  if(op.type!=="add_expense"&&op.type!=="update_expense")return null;
  validateBusinessOperation(op);
  const members=membersOf(trip);
  const resolve=(id:string)=>{const matches=members.filter(m=>m.id===id||m.name===id||(id==="我"&&m.isMe));if(matches.length!==1)throw new Error(`无法确认成员「${id}」，请先添加同行人或使用准确姓名`);return matches[0].id;};
  const original=op.type==="update_expense"?trip.expenses.find(e=>e.id===op.expenseId):undefined;
  if(op.type==="update_expense"&&!original)throw new Error("找不到原始账目，请指明要修改的记录");
  const raw=op.type==="add_expense"?op.expense:op.changes;
  const candidate:Expense={id:original?.id||uid("expense"),cityId,date:new Intl.DateTimeFormat("sv-SE").format(new Date()),currency:"EUR",category:"其他",title:"",amount:0,...original,...raw};
  candidate.id=original?.id||uid("expense");
  if(candidate.cityId&&!trip.cities.some(c=>c.id===candidate.cityId))throw new Error("账单关联城市不存在");
  if(raw.paidBy!==undefined)candidate.paidBy=resolve(raw.paidBy);
  if(raw.participants)candidate.participants=raw.participants.map(p=>({...p,memberId:resolve(p.memberId)}));
  return prepareExpense(candidate,members);
}
export function applyBusinessOperations(trip:Trip,operations:AssistantOperation[],cityId:string):Trip {
  let next=trip;
  for(const op of operations){
    validateBusinessOperation(op);
    if(op.type==="update_place"){
      const matches=next.cities.filter(c=>!op.cityName||c.name===op.cityName).flatMap(c=>c.days.flatMap(d=>d.places)).filter(p=>op.placeId?p.id===op.placeId:p.name===op.placeName);
      if(matches.length!==1)throw new Error("地点名称有重复或未找到，请使用准确地点 ID");
      const allowed=["name","mapQuery","category","time","endTime","summary","highlights","duration","mapUrl","locked"];
      for(const [key,value] of Object.entries(op.changes)){
        if(!allowed.includes(key)||(key==="highlights"?!Array.isArray(value)||value.some(v=>typeof v!=="string"):key==="locked"?typeof value!=="boolean":typeof value!=="string"))throw new Error("地点修改包含不支持的字段");
      }
    }
    if(op.type==="add_member"){
      if(!op.name.trim()||membersOf(next).some(m=>m.name===op.name.trim()))throw new Error("同行人姓名为空或已存在");
      next={...next,members:[...membersOf(next),{id:uid("member"),name:op.name.trim(),avatar:op.avatar||"🙂",isMe:false}]};
    }
    if(op.type==="add_journal"){
      if(!next.cities.some(c=>c.id===op.cityId))throw new Error("找不到 Journal 所属城市");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(op.journal.date)||!op.journal.text.trim()||!op.journal.title.trim())throw new Error("Journal 需要完整日期、标题和正文");
      next={...next,cities:next.cities.map(c=>c.id===op.cityId?{...c,journal:[...(c.journal||[]),{...op.journal,id:uid("journal"),images:[]}]}:c)};
    }
    const expense=expenseFromOperation(next,op,cityId);
    if(expense)next={...next,expenses:op.type==="update_expense"?next.expenses.map(e=>e.id===expense.id?expense:e):[expense,...next.expenses]};
    if(op.type==="delete_record"){
      let found=false;const keep=(r:{id:string})=>{if(r.id===op.id){found=true;return false;}return true;};
      if(op.entity==="expense")next={...next,expenses:next.expenses.filter(keep)};
      if(op.entity==="ticket")next={...next,tickets:next.tickets.filter(keep)};
      if(op.entity==="city") {
        if(next.tickets.some(t=>t.cityId===op.id)||next.expenses.some(e=>e.cityId===op.id))throw new Error("该城市仍关联票据或账单，请先处理关联资料再删除");
        next={...next,cities:next.cities.filter(keep)};
      }
      if(["journal","day","place"].includes(op.entity))next={...next,cities:next.cities.map(c=>({...c,journal:op.entity==="journal"?c.journal?.filter(keep):c.journal,days:op.entity==="day"?c.days.filter(keep):op.entity==="place"?c.days.map(d=>({...d,places:d.places.filter(keep)})):c.days}))};
      if(!found)throw new Error("找不到要删除的原记录");
    }
  }
  return next;
}
