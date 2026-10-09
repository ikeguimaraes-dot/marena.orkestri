import {createFinanceiroClient} from '@/lib/financeiro/db/client';
import {groupMonthlyEvidence,kindLabels,type MonthlyEvidence} from '@/lib/ork/monthly';
import type {OrkSection} from '@/lib/ork/config';
import {defaultOrkPeriod,periodLabel,periodRange} from '@/lib/ork/period';
import {MonthlyAreaTable} from './MonthlyAreaTable';
import {PeriodFilter} from './PeriodFilter';
import styles from './page.module.css';

const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const configs:Partial<Record<OrkSection,{headline:'total'|'records';summary:string;help:string}>>={
 despesas:{headline:'total',summary:'Total informado na planilha',help:'Abra cada dia para ver fornecedor, categoria original e referência da planilha. A data não comprova pagamento ou competência.'},
 cartoes:{headline:'records',summary:'Referências do mês',help:'Previsto, informado, despesas e parcelas permanecem em grupos separados; não formam um total único.'},
 caixa:{headline:'records',summary:'Movimentos do mês',help:'Entradas, saídas e pendências aparecem separadas dentro de cada dia.'},
 socios:{headline:'records',summary:'Referências do mês',help:'Transferências, créditos e gastos de outras empresas não são classificados automaticamente como receita ou despesa.'},
 investimentos:{headline:'total',summary:'Valores informados',help:'Aportes de referência, investimentos e juros simulados permanecem identificados por natureza.'},
 orcamento:{headline:'records',summary:'Linhas de orçamento',help:'Valores orçados são referências e não representam realização financeira.'},
 documentos:{headline:'records',summary:'Documentos do mês',help:'Notas de entrada e saída permanecem separadas e servem para conferência fiscal.'},
};
export async function MonthlyAreaPage({unitId,area,sp}:{unitId:string;area:OrkSection;sp:Record<string,string|undefined>}){
 const config=configs[area];if(!config) return null;
 const db=await createFinanceiroClient();
 const {data:latest,error:latestError}=await db.from('ork_evidence').select('period').eq('unit_id',unitId).eq('area',area).not('period','is',null).order('period',{ascending:false}).limit(1).maybeSingle();
 if(latestError) throw new Error(latestError.message);
 const range=periodRange(sp,defaultOrkPeriod(latest?.period));
 const origin=['operacionais','cartao'].includes(sp.origin??'')?sp.origin:null;
 const rows:MonthlyEvidence[]=[];
 for(let offset=0;offset<40000;offset+=1000){
  let request=db.from('ork_evidence').select('id,source,source_ref,kind,occurred_on,description,entity,amount,category_original,details').eq('unit_id',unitId).eq('area',area).gte('period',range.from).lte('period',range.to).order('occurred_on',{ascending:false,nullsFirst:false}).order('id');
  if(origin==='operacionais') request=request.in('details->>sheet',['Despesas Operacionais - 2025','Despesas Operacionais - 2026']);
  if(origin==='cartao') request=request.in('details->>sheet',['Cartão Crédito','Cartão Crédito - Itaú']);
  const {data,error}=await request.range(offset,offset+999);
  if(error) throw new Error(error.message);
  rows.push(...((data??[]) as MonthlyEvidence[]));
  if((data??[]).length<1000) break;
 }
 const days=groupMonthlyEvidence(rows),totals=new Map<string,{label:string;records:number;amount:number}>();
 for(const row of rows){const key=`${row.source}:${row.kind}`,item=totals.get(key)??{label:`${kindLabels[row.kind]??row.kind} · ${row.source.toUpperCase()}`,records:0,amount:0};item.records++;item.amount+=Number(row.amount)||0;totals.set(key,item);}
 return <><PeriodFilter range={range} clearHref={`/financeiro/ork/${area}`}><label>Origem da planilha<select name="origin" defaultValue={origin??''}><option value="">Todas</option><option value="operacionais">Despesas Operacionais</option><option value="cartao">Cartão Crédito</option></select></label></PeriodFilter>
 <section className={styles.monthSummary}>{[...totals.values()].toSorted((a,b)=>a.label.localeCompare(b.label,'pt-BR')).map(item=><div key={item.label}><span>{item.label}</span><strong>{config.headline==='total'?brl(item.amount):`${item.records.toLocaleString('pt-BR')} registros`}</strong>{config.headline==='records'&&item.amount!==0?<small>{brl(item.amount)} informado na fonte</small>:null}</div>)}{!totals.size?<div><span>{config.summary}</span><strong>Sem registros</strong></div>:null}</section>
 <section className={styles.panel}><div className={styles.sectionTitle}><div><h2>Dia a dia · {periodLabel(range)}</h2><p>{config.help} Natureza corresponde à coluna E e CC à coluna H da planilha.</p></div></div><MonthlyAreaTable days={days} headline={config.headline}/></section></>;
}
