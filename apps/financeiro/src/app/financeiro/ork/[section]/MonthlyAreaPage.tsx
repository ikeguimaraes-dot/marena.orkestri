import {createFinanceiroClient} from '@/lib/financeiro/db/client';
import {groupMonthlyEvidence,kindLabels,type MonthlyEvidence} from '@/lib/ork/monthly';
import type {OrkSection} from '@/lib/ork/config';
import {MonthlyAreaTable} from './MonthlyAreaTable';
import styles from './page.module.css';

const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
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
 const fallback=latest?.period??new Date().toISOString().slice(0,7),requested=`${sp.year??''}-${String(sp.month??'').padStart(2,'0')}`;
 const period=/^20\d{2}-(0[1-9]|1[0-2])$/.test(requested)?requested:/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.period??'')?sp.period!:fallback;
 const [year,month]=period.split('-'),years=Array.from({length:5},(_,i)=>Number(year)-2+i);
 const {data,error}=await db.from('ork_evidence').select('id,source,source_ref,kind,occurred_on,description,entity,amount,category_original,details').eq('unit_id',unitId).eq('area',area).eq('period',period).order('occurred_on',{ascending:false,nullsFirst:false}).limit(5000);
 if(error) throw new Error(error.message);
 const rows=(data??[]) as MonthlyEvidence[],days=groupMonthlyEvidence(rows),totals=new Map<string,{label:string;records:number;amount:number}>();
 for(const row of rows){const key=`${row.source}:${row.kind}`,item=totals.get(key)??{label:`${kindLabels[row.kind]??row.kind} · ${row.source.toUpperCase()}`,records:0,amount:0};item.records++;item.amount+=Number(row.amount)||0;totals.set(key,item);}
 return <><form className={styles.monthPicker}><label>Mês<select name="month" defaultValue={month}>{months.map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>)}</select></label><label>Ano<select name="year" defaultValue={year}>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="maza-button">Mostrar mês</button></form>
 <section className={styles.monthSummary}>{[...totals.values()].toSorted((a,b)=>a.label.localeCompare(b.label,'pt-BR')).map(item=><div key={item.label}><span>{item.label}</span><strong>{config.headline==='total'?brl(item.amount):`${item.records.toLocaleString('pt-BR')} registros`}</strong>{config.headline==='records'&&item.amount!==0?<small>{brl(item.amount)} informado na fonte</small>:null}</div>)}{!totals.size?<div><span>{config.summary}</span><strong>Sem registros</strong></div>:null}</section>
 <section className={styles.panel}><div className={styles.sectionTitle}><div><h2>Dia a dia · {months[Number(month)-1]} {year}</h2><p>{config.help}</p></div></div><MonthlyAreaTable days={days} headline={config.headline}/></section></>;
}
