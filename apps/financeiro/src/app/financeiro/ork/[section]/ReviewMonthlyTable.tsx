'use client';
import {useState} from 'react';
import Link from 'next/link';
import {ChevronDown} from 'lucide-react';
import {REVIEW_NATURE,REVIEW_STATUS} from '@/lib/ork/review';
import styles from './page.module.css';

export type ReviewListRow={id:string;description:string;entity:string|null;occurred_on:string|null;amount:number|null;source:string;source_ref:string;category_original:string|null;details:Record<string,unknown>|null;review_status:keyof typeof REVIEW_STATUS;reviewed_nature:keyof typeof REVIEW_NATURE|null;reviewed_category:string|null};
const money=(n:number|null)=>n===null?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

export function ReviewMonthlyTable({rows,query}:{rows:ReviewListRow[];query:string}){
 const [open,setOpen]=useState<Set<string>>(()=>new Set());
 const days=Map.groupBy(rows,row=>row.occurred_on??'sem-data');
 const toggle=(key:string)=>setOpen(current=>{const next=new Set(current);next.has(key)?next.delete(key):next.add(key);return next;});
 return <div className={styles.revenueTableWrap}><table className={styles.revenueTable}><thead><tr><th aria-label="Detalhes"/><th>Data / dia</th><th>Registros para revisão</th></tr></thead><tbody>
  {[...days.entries()].toSorted(([a],[b])=>b.localeCompare(a)).map(([day,items])=>{const expanded=open.has(day),label=day==='sem-data'?'Sem data informada':day.split('-').reverse().join('/');return <Fragment key={day}><tr className={styles.dayRow}><td><button type="button" className={styles.expandButton} onClick={()=>toggle(day)} aria-expanded={expanded} aria-label={`${expanded?'Fechar':'Abrir'} ${label}`}><ChevronDown size={17} className={expanded?styles.chevronOpen:''}/></button></td><td><strong>{label}</strong></td><td className={styles.dayTotal}>{items.length.toLocaleString('pt-BR')} registros</td></tr>{expanded?<tr className={styles.expandedRow}><td/><td colSpan={2}><div className={styles.reviewRows}>{items.map(row=><article key={row.id}><div><Link href={`?${query}${query?'&':''}id=${row.id}`}><strong>{row.description}</strong></Link><small>Fornecedor: {row.entity??'Não informado'}</small><small>Natureza: {row.description}</small><small>CC: {row.category_original??'Não informado'}</small><small>Origem: {row.details?.sheet?String(row.details.sheet):row.source.toUpperCase()} · {row.source_ref}</small></div><div><strong>{money(row.amount)}</strong><small>{REVIEW_STATUS[row.review_status]}</small><small>Natureza revisada: {row.reviewed_nature?REVIEW_NATURE[row.reviewed_nature]:'Não revisada'}</small><small>CC revisado: {row.reviewed_category??'Não revisado'}</small></div></article>)}</div></td></tr>:null}</Fragment>})}
  {!rows.length?<tr><td colSpan={3} className={styles.empty}>Nenhum registro para estes filtros.</td></tr>:null}
 </tbody></table></div>;
}
function Fragment({children}:{children:React.ReactNode}){return <>{children}</>}

