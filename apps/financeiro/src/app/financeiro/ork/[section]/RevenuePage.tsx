import {createFinanceiroClient} from '@/lib/financeiro/db/client';
import {groupRevenueByDay,type RevenueEvidence} from '@/lib/ork/revenue';
import {defaultOrkPeriod,periodLabel,periodRange} from '@/lib/ork/period';
import {RevenueTable} from './RevenueTable';
import {PeriodFilter} from './PeriodFilter';
import styles from './page.module.css';

const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export async function RevenuePage({unitId,sp}:{unitId:string;sp:Record<string,string|undefined>}) {
 const db=await createFinanceiroClient();
 const {data:latest,error:latestError}=await db.from('ork_evidence').select('period').eq('unit_id',unitId).eq('area','receita').eq('source','planilha').not('period','is',null).order('period',{ascending:false}).limit(1).maybeSingle();
 if(latestError) throw new Error(latestError.message);
 const range=periodRange(sp,defaultOrkPeriod(latest?.period));
 const [{data:fiscal,error:fiscalError},revenueRows]=await Promise.all([
  db.from('ork_evidence').select('amount,details').eq('unit_id',unitId).eq('area','receita').eq('source','efd').gte('period',range.from).lte('period',range.to).limit(100),
  (async()=>{const rows:RevenueEvidence[]=[];for(let offset=0;offset<20000;offset+=1000){const {data,error}=await db.from('ork_evidence').select('id,occurred_on,amount,category_original,kind,details').eq('unit_id',unitId).eq('area','receita').eq('source','planilha').gte('period',range.from).lte('period',range.to).order('occurred_on',{ascending:false}).order('id').range(offset,offset+999);if(error) throw new Error(error.message);rows.push(...((data??[]) as RevenueEvidence[]));if((data??[]).length<1000) break;}return rows;})(),
 ]);
 if(fiscalError) throw new Error(fiscalError.message);
 const days=groupRevenueByDay(revenueRows),total=days.reduce((sum,d)=>sum+d.total,0),monetary=days.reduce((sum,d)=>sum+d.monetary,0),nonMonetary=days.reduce((sum,d)=>sum+d.nonMonetary,0),fiscalTotal=(fiscal??[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
 return <>
  <PeriodFilter range={range} clearHref="/financeiro/ork/receita"/>
  <section className={styles.monthSummary}><div><span>Faturamento informado</span><strong>{brl(total)}</strong><small>{days.length} dias com movimento</small></div><div><span>Vendas monetárias</span><strong>{brl(monetary)}</strong></div><div><span>Permutas, assinados e cortesias</span><strong>{brl(nonMonetary)}</strong></div>{fiscalTotal?<div><span>EFD fiscal · conferência separada</span><strong>{brl(fiscalTotal)}</strong><small>Não somada ao faturamento diário</small></div>:null}</section>
  <section className={styles.panel}><div className={styles.sectionTitle}><div><h2>Dia a dia · {periodLabel(range)}</h2><p>A linha principal mostra somente o faturamento do dia. Abra a seta para ver almoço, jantar e formas de pagamento.</p></div></div><RevenueTable days={days}/></section>
 </>;
}
