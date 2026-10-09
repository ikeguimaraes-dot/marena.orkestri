'use client';
import {useState} from 'react';
import {ChevronDown} from 'lucide-react';
import type {MonthlyDay} from '@/lib/ork/monthly';
import styles from './page.module.css';

const brl=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const weekday=(date:string)=>new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)).replace('.','');
export function MonthlyAreaTable({days,headline}:{days:MonthlyDay[];headline:'total'|'records'}){
 const [open,setOpen]=useState<Set<string>>(()=>new Set());
 const toggle=(key:string)=>setOpen(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next;});
 return <div className={styles.revenueTableWrap}><table className={styles.revenueTable}><thead><tr><th aria-label="Detalhes"/><th>Data / dia</th><th>{headline==='total'?'Total informado':'Registros do dia'}</th></tr></thead><tbody>
  {days.map(day=>{const expanded=open.has(day.key),panelId=`evidence-${day.key}`;return <FragmentRows key={day.key} day={day} expanded={expanded} panelId={panelId} headline={headline} onToggle={()=>toggle(day.key)}/>})}
  {!days.length?<tr><td colSpan={3} className={styles.empty}>Nenhum registro neste mês.</td></tr>:null}
 </tbody></table></div>;
}
function FragmentRows({day,expanded,panelId,headline,onToggle}:{day:MonthlyDay;expanded:boolean;panelId:string;headline:'total'|'records';onToggle:()=>void}){
 const dayLabel=day.date?day.date.split('-').reverse().join('/'):'Sem data informada';
 return <><tr className={styles.dayRow}><td><button type="button" className={styles.expandButton} onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded?'Fechar':'Abrir'} detalhes de ${dayLabel}`}><ChevronDown size={17} aria-hidden className={expanded?styles.chevronOpen:''}/></button></td><td><strong>{dayLabel}</strong>{day.date?<span>{weekday(day.date)}</span>:null}</td><td className={styles.dayTotal}>{headline==='total'?brl(day.total):`${day.records.toLocaleString('pt-BR')} registros`}</td></tr>
 {expanded?<tr className={styles.expandedRow}><td/><td colSpan={2}><div id={panelId} className={styles.evidenceGroups}>{day.groups.map(group=><section key={group.key} className={styles.evidenceGroup}><header><div><h3>{group.label}</h3><small>{group.rows.length} registros</small></div>{group.total!==null?<strong>{brl(group.total)}</strong>:null}</header><div className={styles.evidenceRows}>{group.rows.map(row=><article key={row.id}><div><strong>Natureza: {row.description}</strong><small>Fornecedor: {row.entity??'Não informado'}</small><small>CC: {row.category_original??'Não informado'}</small><small>Origem: {row.details?.sheet?String(row.details.sheet):row.source.toUpperCase()} · {row.source_ref}</small></div><span>{row.amount===null?'Sem valor':brl(Number(row.amount))}</span></article>)}</div></section>)}</div></td></tr>:null}</>;
}
