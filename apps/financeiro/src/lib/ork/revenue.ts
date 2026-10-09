export type RevenueEvidence={id:string;occurred_on:string|null;amount:number|null;category_original:string|null;kind:string;details:{shift?:unknown;notes?:unknown}|null};
export type RevenuePayment={name:string;amount:number;kind:string;notes:string|null};
export type RevenueShift={name:string;total:number;payments:RevenuePayment[]};
export type RevenueDay={date:string;total:number;monetary:number;nonMonetary:number;shifts:RevenueShift[]};

export function groupRevenueByDay(rows:RevenueEvidence[]):RevenueDay[] {
 const days=new Map<string,{total:number;monetary:number;nonMonetary:number;shifts:Map<string,RevenueShift>}>();
 for(const row of rows) {
  if(!row.occurred_on||row.amount===null||!Number.isFinite(Number(row.amount))) continue;
  const amount=Number(row.amount),shift=typeof row.details?.shift==='string'?row.details.shift:'Turno não informado';
  const day=days.get(row.occurred_on)??{total:0,monetary:0,nonMonetary:0,shifts:new Map()};
  const group=day.shifts.get(shift)??{name:shift,total:0,payments:[]};
  group.total+=amount;
  group.payments.push({name:row.category_original??'Forma não informada',amount,kind:row.kind,notes:typeof row.details?.notes==='string'?row.details.notes:null});
  day.total+=amount;
  if(row.kind==='venda') day.monetary+=amount; else day.nonMonetary+=amount;
  day.shifts.set(shift,group);days.set(row.occurred_on,day);
 }
 return [...days.entries()].map(([date,d])=>({date,total:d.total,monetary:d.monetary,nonMonetary:d.nonMonetary,shifts:[...d.shifts.values()].map(s=>({...s,payments:s.payments.toSorted((a,b)=>b.amount-a.amount)})).toSorted((a,b)=>a.name==='Almoço'?-1:b.name==='Almoço'?1:a.name.localeCompare(b.name,'pt-BR'))})).toSorted((a,b)=>b.date.localeCompare(a.date));
}
