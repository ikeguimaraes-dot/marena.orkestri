import Link from 'next/link';
import {createFinanceiroClient} from '@/lib/financeiro/db/client';
import {DRE_GROUPS,dreGroup,dreSignedAmount,type DreGroup} from '@/lib/ork/dre';
import {groupMonthlyEvidence,type MonthlyEvidence} from '@/lib/ork/monthly';
import {periodLabel,type PeriodRange} from '@/lib/ork/period';
import {MonthlyAreaTable} from './MonthlyAreaTable';
import {PeriodFilter} from './PeriodFilter';
import styles from './page.module.css';

const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dreLinks=Object.entries(DRE_GROUPS) as [DreGroup,string][];
const validPeriod=(value:string|undefined)=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(value??'');

async function loadRows(unitId:string,from:string,to:string){
 const db=await createFinanceiroClient(),rows:MonthlyEvidence[]=[];
 for(let offset=0;offset<40000;offset+=1000){
  const {data,error}=await db.from('ork_evidence').select('id,source,source_ref,area,kind,occurred_on,period,description,entity,amount,category_original,details').eq('unit_id',unitId).eq('source','planilha').in('area',['receita','despesas','cartoes','investimentos']).gte('period',from).lte('period',to).order('id').range(offset,offset+999);
  if(error) throw new Error(error.message);
  rows.push(...((data??[]) as MonthlyEvidence[]));
  if((data??[]).length<1000) break;
 }
 return rows;
}

export async function DrePage({unitId,section,sp}:{unitId:string;section:string;sp:Record<string,string|undefined>}){
 const db=await createFinanceiroClient();
 const [{data:latest,error},{data:earliest,error:earliestError}]=await Promise.all([
  db.from('ork_evidence').select('period').eq('unit_id',unitId).eq('source','planilha').not('period','is',null).order('period',{ascending:false}).limit(1).maybeSingle(),
  db.from('ork_evidence').select('period').eq('unit_id',unitId).eq('source','planilha').not('period','is',null).order('period',{ascending:true}).limit(1).maybeSingle(),
 ]);
 if(error||earliestError) throw new Error(error?.message??earliestError?.message);
 const available:PeriodRange={from:earliest?.period??'2025-01',to:latest?.period??'2026-12'};
 const base=['operacionais','cartao','todas'].includes(sp.base??'')?sp.base!:'operacionais';
 const month=validPeriod(sp.month)?sp.month!:null;
 const hasRange=validPeriod(sp.from)||validPeriod(sp.to);
 let range:PeriodRange=month?{from:month,to:month}:{from:validPeriod(sp.from)?sp.from!:available.from,to:validPeriod(sp.to)?sp.to!:available.to};
 if(range.from>range.to) range={from:range.to,to:range.from};
 const all=await loadRows(unitId,range.from,range.to);
 const rows=all.filter(row=>{
  if(month&&row.period!==month) return false;
  if(row.area==='receita') return row.kind==='venda';
  const sheet=String(row.details?.sheet??'');
  if(base==='operacionais') return sheet.startsWith('Despesas Operacionais - ');
  if(base==='cartao') return sheet==='Cartão Crédito'||sheet==='Cartão Crédito - Itaú';
  return sheet.startsWith('Despesas Operacionais - ')||sheet==='Cartão Crédito'||sheet==='Cartão Crédito - Itaú';
 });
 const selected=section==='dre'?null:section.replace('dre-','') as DreGroup;
 const grouped=new Map<DreGroup,MonthlyEvidence[]>();
 for(const row of rows){const key=dreGroup(row),list=grouped.get(key)??[];list.push(row);grouped.set(key,list)}
 const visible=selected?(grouped.get(selected)??[]):rows;
 const result=rows.filter(row=>!['fora_dre','nao_classificados'].includes(dreGroup(row))).reduce((sum,row)=>sum+dreSignedAmount(row),0);
 const query=new URLSearchParams({base,...(month?{month}:hasRange?{from:range.from,to:range.to}:{})}).toString();
 const selectionLabel=month?periodLabel({from:month,to:month}):hasRange?periodLabel(range):'Todo o período disponível';
 return <>
  <p className={styles.notice}>Visão gerencial preliminar baseada no CC da planilha. A data ainda precisa ser confirmada como competência, pagamento ou vencimento. “Todas” pode conter o mesmo gasto em Despesas Operacionais e Cartão Crédito.</p>
  <PeriodFilter range={range} emptyRange={!!month||!hasRange} clearHref="/financeiro/ork/dre"><label>Mês específico<input type="month" name="month" defaultValue={month??''}/></label><label>Base de despesas<select name="base" defaultValue={base}><option value="operacionais">Despesas Operacionais</option><option value="cartao">Cartão Crédito</option><option value="todas">Todas as fontes, sem deduplicar</option></select></label></PeriodFilter>
  <nav className={styles.dreTabs} aria-label="Componentes da DRE"><Link href={`/financeiro/ork/dre?${query}`} aria-current={!selected?'page':undefined}>Visão geral</Link>{dreLinks.map(([key,label])=><Link key={key} href={`/financeiro/ork/dre-${key}?${query}`} aria-current={selected===key?'page':undefined}>{label}</Link>)}</nav>
  {section==='dre'?<section className={styles.monthSummary}><div><span>Saldo preliminar</span><strong>{brl(result)}</strong><small>Exclui “Fora da DRE” e “Não classificados”</small></div>{dreLinks.map(([key,label])=>{const list=grouped.get(key)??[],total=list.reduce((sum,row)=>sum+dreSignedAmount(row),0);return <div key={key}><span>{label}</span><strong>{brl(total)}</strong><small>{list.length.toLocaleString('pt-BR')} registros</small></div>})}</section>:null}
  <section className={styles.panel}><h2>{selected?DRE_GROUPS[selected]:'Todos os componentes'} · {selectionLabel}</h2><p>Abra cada dia para conferir Natureza, CC, fornecedor e célula de origem.</p><MonthlyAreaTable days={groupMonthlyEvidence(visible)} headline="total"/></section>
 </>;
}
