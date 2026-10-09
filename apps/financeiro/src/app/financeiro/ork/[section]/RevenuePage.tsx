import {createFinanceiroClient} from '@/lib/financeiro/db/client';
import {groupRevenueByDay,type RevenueEvidence} from '@/lib/ork/revenue';
import {RevenueTable} from './RevenueTable';
import styles from './page.module.css';

const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export async function RevenuePage({unitId,sp}:{unitId:string;sp:Record<string,string|undefined>}) {
 const db=await createFinanceiroClient();
 const {data:latest,error:latestError}=await db.from('ork_evidence').select('period').eq('unit_id',unitId).eq('area','receita').eq('source','planilha').not('period','is',null).order('period',{ascending:false}).limit(1).maybeSingle();
 if(latestError) throw new Error(latestError.message);
 const fallback=latest?.period??new Date().toISOString().slice(0,7),requested=`${sp.year??''}-${String(sp.month??'').padStart(2,'0')}`;
 const period=/^20\d{2}-(0[1-9]|1[0-2])$/.test(requested)?requested:/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.period??'')?sp.period!:fallback;
 const [year,month]=period.split('-'),years=Array.from({length:5},(_,i)=>Number(year)-2+i);
 const [{data,error},{data:fiscal,error:fiscalError}]=await Promise.all([
  db.from('ork_evidence').select('id,occurred_on,amount,category_original,kind,details').eq('unit_id',unitId).eq('area','receita').eq('source','planilha').eq('period',period).order('occurred_on',{ascending:false}).limit(1500),
  db.from('ork_evidence').select('amount,details').eq('unit_id',unitId).eq('area','receita').eq('source','efd').eq('period',period).limit(1).maybeSingle(),
 ]);
 if(error||fiscalError) throw new Error(error?.message??fiscalError?.message);
 const days=groupRevenueByDay((data??[]) as RevenueEvidence[]),total=days.reduce((sum,d)=>sum+d.total,0),monetary=days.reduce((sum,d)=>sum+d.monetary,0),nonMonetary=days.reduce((sum,d)=>sum+d.nonMonetary,0);
 return <>
  <form className={styles.monthPicker}><label>Mês<select name="month" defaultValue={month}>{months.map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>)}</select></label><label>Ano<select name="year" defaultValue={year}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="maza-button">Mostrar mês</button></form>
  <section className={styles.monthSummary}><div><span>Faturamento informado</span><strong>{brl(total)}</strong><small>{days.length} dias com movimento</small></div><div><span>Vendas monetárias</span><strong>{brl(monetary)}</strong></div><div><span>Permutas, assinados e cortesias</span><strong>{brl(nonMonetary)}</strong></div>{fiscal?<div><span>EFD fiscal · conferência separada</span><strong>{brl(Number(fiscal.amount))}</strong><small>Não somada ao faturamento diário</small></div>:null}</section>
  <section className={styles.panel}><div className={styles.sectionTitle}><div><h2>Dia a dia · {months[Number(month)-1]} {year}</h2><p>A linha principal mostra somente o faturamento do dia. Abra a seta para ver almoço, jantar e formas de pagamento.</p></div></div><RevenueTable days={days}/></section>
 </>;
}
