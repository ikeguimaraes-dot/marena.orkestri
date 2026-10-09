'use client';
import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import type {RevenueDay} from '@/lib/ork/revenue';
import styles from './page.module.css';

const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const weekday=(date:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).replace('.','');
export function RevenueTable({days}:{days:RevenueDay[]}) {
 const [open,setOpen]=useState<Set<string>>(()=>new Set());
 const toggle=(date:string)=>setOpen(current=>{const next=new Set(current);if(next.has(date))next.delete(date);else next.add(date);return next;});
 return <div className={styles.revenueTableWrap}><table className={styles.revenueTable}>
  <thead><tr><th aria-label="Detalhes"/><th>Data / dia</th><th>Faturamento do dia</th></tr></thead>
  <tbody>{days.map(day=>{const expanded=open.has(day.date),panelId=`day-${day.date}`;return <DayRows key={day.date} day={day} expanded={expanded} panelId={panelId} onToggle={()=>toggle(day.date)}/>})}
  {!days.length&&<tr><td colSpan={3} className={styles.empty}>Nenhum faturamento da planilha neste mês.</td></tr>}</tbody>
 </table></div>;
}
function DayRows({day,expanded,panelId,onToggle}:{day:RevenueDay;expanded:boolean;panelId:string;onToggle:()=>void}) {
 return <>
  <tr className={styles.dayRow}><td><button type="button" className={styles.expandButton} onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded?'Fechar':'Abrir'} formas de pagamento de ${day.date}`}><ChevronDown size={17} aria-hidden className={expanded?styles.chevronOpen:''}/></button></td><td><strong>{day.date.split('-').reverse().join('/')}</strong><span>{weekday(day.date)}</span></td><td className={styles.dayTotal}>{brl(day.total)}</td></tr>
  {expanded?<tr className={styles.expandedRow}><td/><td colSpan={2}><div id={panelId} className={styles.shiftGrid}>{day.shifts.map(shift=><section key={shift.name} className={styles.shiftCard}><header><h3>{shift.name}</h3><strong>{brl(shift.total)}</strong></header><dl>{shift.payments.map((payment,index)=><div key={`${payment.name}-${index}`}><dt>{payment.name}{payment.kind==='nao_monetario'?<small>Não monetário</small>:null}</dt><dd>{brl(payment.amount)}</dd>{payment.notes?<p>{payment.notes}</p>:null}</div>)}</dl></section>)}</div>{day.nonMonetary!==0?<p className={styles.nonMonetaryNote}>O faturamento do dia inclui {brl(day.nonMonetary)} informados como permutas, assinados ou cortesias. O valor monetário é {brl(day.monetary)}.</p>:null}</td></tr>:null}
 </>;
}
