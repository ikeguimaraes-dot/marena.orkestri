export type MonthlyEvidence={id:string;source:string;source_ref:string;area?:string;kind:string;occurred_on:string|null;period?:string|null;description:string;entity:string|null;amount:number|null;category_original:string|null;details:Record<string,unknown>|null};
export type MonthlyGroup={key:string;label:string;total:number|null;rows:MonthlyEvidence[]};
export type MonthlyDay={key:string;date:string|null;records:number;total:number;groups:MonthlyGroup[]};

export const kindLabels:Record<string,string>={despesa_informada:'Despesas informadas',despesa_cartao:'Despesas no cartão',parcela_cartao:'Parcelas do cartão',recebimento_previsto:'Recebimentos previstos',recebimento_informado:'Recebimentos informados',entrada_caixa:'Entradas',saida_caixa:'Saídas',entrada_pendente:'Entradas pendentes',saida_pendente:'Saídas pendentes',outra_empresa:'Outras empresas',aporte_referencia:'Aportes de referência',consumo_credito_permuta:'Créditos e permutas',transferencia_referencia:'Transferências',juros_simulados:'Juros simulados',orcamento_referencia:'Orçamento de referência',nfe_entrada:'NF-e de entrada',nfe_saida:'NF-e de saída'};

export function groupMonthlyEvidence(rows:MonthlyEvidence[]):MonthlyDay[] {
 const days=new Map<string,MonthlyEvidence[]>();
 for(const row of rows){const key=row.occurred_on??'sem-data';const list=days.get(key)??[];list.push(row);days.set(key,list);}
 return [...days.entries()].map(([key,list])=>{
  const groups=new Map<string,MonthlyEvidence[]>();
  for(const row of list){const groupKey=`${row.source}:${row.kind}`,group=groups.get(groupKey)??[];group.push(row);groups.set(groupKey,group);}
  return {key,date:key==='sem-data'?null:key,records:list.length,total:list.reduce((sum,row)=>sum+(Number(row.amount)||0),0),groups:[...groups.entries()].map(([groupKey,groupRows])=>{const first=groupRows[0]!;return {key:groupKey,label:`${kindLabels[first.kind]??first.kind} · ${first.source.toUpperCase()}`,total:groupRows.some(r=>r.amount!==null)?groupRows.reduce((sum,row)=>sum+(Number(row.amount)||0),0):null,rows:groupRows.toSorted((a,b)=>Math.abs(Number(b.amount)||0)-Math.abs(Number(a.amount)||0))};}).toSorted((a,b)=>a.label.localeCompare(b.label,'pt-BR'))};
 }).toSorted((a,b)=>b.key.localeCompare(a.key));
}
