import Link from 'next/link';
import { z } from 'zod';
import { createFinanceiroClient } from '@/lib/financeiro/db/client';
import { REVIEW_NATURE, REVIEW_STATUS } from '@/lib/ork/review';
import {defaultOrkPeriod,periodLabel,periodRange} from '@/lib/ork/period';
import { ReviewForm } from './ReviewForm';
import {PeriodFilter} from './PeriodFilter';
import {ReviewMonthlyTable,type ReviewListRow} from './ReviewMonthlyTable';
import styles from './page.module.css';

const money=(n:number|null)=>n===null?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
type Row=ReviewListRow&{related_evidence_id:string|null};
const label=(r:Row)=>`${r.source.toUpperCase()} · ${r.occurred_on??'Sem data'} · ${r.entity??r.description} · ${money(r.amount)} · ${r.source_ref}`;

export async function ReviewPage({unitId,sp}:{unitId:string;sp:Record<string,string|undefined>}) {
 const db=await createFinanceiroClient();
 const id=z.uuid().safeParse(sp.id);
 const status=sp.status&&Object.hasOwn(REVIEW_STATUS,sp.status)?sp.status:null;
 const q=(sp.q??'').trim().slice(0,100).replace(/[%_\\]/g,'');
 if(id.success) {
  const [{data:row,error},{data:history,error:he},{data:canWrite,error:we}]=await Promise.all([
   db.from('ork_review_queue').select('*').eq('unit_id',unitId).eq('id',id.data).maybeSingle(),
   db.from('ork_evidence_reviews').select('*').eq('unit_id',unitId).eq('evidence_id',id.data).order('id',{ascending:false}).limit(100),
   db.rpc('ork_can_write',{p_unit:unitId}),
  ]);
  if(error||he||we) throw new Error('Não foi possível carregar a revisão.');
  if(!row) return <p>Registro não encontrado nesta unidade. <Link href="/financeiro/ork/revisao">Voltar à revisão</Link></p>;
  const r=row as Row;
  let candidates:Row[]=[];
  if(r.amount!==null) {
   const {data,error:ce}=await db.from('ork_review_queue').select('*').eq('unit_id',unitId).neq('id',r.id).in('amount',[Number(r.amount),-Number(r.amount)]).order('occurred_on',{ascending:false,nullsFirst:false}).order('id').limit(20);
   if(ce) throw new Error('Não foi possível carregar as comparações.');
   candidates=data??[];
  }
  if(r.related_evidence_id&&!candidates.some(c=>c.id===r.related_evidence_id)) {
   const {data:linked,error:le}=await db.from('ork_review_queue').select('*').eq('unit_id',unitId).eq('id',r.related_evidence_id).maybeSingle();
   if(le) throw new Error('Não foi possível carregar o vínculo.');
   if(linked) candidates.push(linked);
  }
  return <>
   <Link href="/financeiro/ork/revisao">← Voltar à revisão</Link>
   <section className={styles.panel}><h2>{r.description}</h2><p>{label(r)}</p><p>Natureza da planilha: {r.description}</p><p>CC da planilha: {r.category_original??'Não informado'}</p><p>Situação: {REVIEW_STATUS[r.review_status]}</p>
    <ReviewForm key={r.id} unitId={unitId} evidenceId={r.id} canWrite={canWrite===true} candidates={candidates.map(c=>({id:c.id,label:label(c)}))} initial={{status:r.review_status,nature:r.reviewed_nature??'a_confirmar',category:r.reviewed_category??'',related:r.related_evidence_id??''}}/>
   </section>
   <section className={styles.panel}><h2>Comparações por valor</h2><p>Até 20 registros de mesmo valor absoluto, mais o vínculo existente. Não é uma busca completa de duplicidades; coincidência de valor não comprova equivalência. Confira datas, fornecedor e documento.</p>
    {candidates.map(c=><p key={c.id}><Link href={`?id=${c.id}`}>{label(c)}</Link></p>)}{!candidates.length&&<p>Nenhum candidato com esse valor.</p>}
   </section>
   <section className={styles.panel}><h2>Histórico de revisão</h2><p>Até 100 revisões mais recentes. A última enviada define a situação exibida; as anteriores permanecem preservadas.</p>
    {history?.map(h=><article key={h.id}><p><strong>{REVIEW_STATUS[h.status as keyof typeof REVIEW_STATUS]}</strong> · {new Date(h.created_at).toLocaleString('pt-BR')} · {REVIEW_NATURE[h.nature as keyof typeof REVIEW_NATURE]} · {h.category??'Sem categoria'}</p><p>{h.explanation}</p>{h.related_evidence_id&&<Link href={`?id=${h.related_evidence_id}`}>Ver evidência vinculada</Link>}</article>)}{!history?.length&&<p>Ainda sem revisão.</p>}
   </section>
  </>;
 }
 const {data:latest,error:latestError}=await db.from('ork_review_queue').select('period').eq('unit_id',unitId).not('period','is',null).order('period',{ascending:false}).limit(1).maybeSingle();
 if(latestError) throw new Error('Não foi possível identificar o período mais recente.');
 const range=periodRange(sp,defaultOrkPeriod(latest?.period));
 const origin=['operacionais','cartao'].includes(sp.origin??'')?sp.origin:null;
 const data:Row[]=[];
 for(let offset=0;offset<40000;offset+=1000){
  let request=db.from('ork_review_queue').select('*').eq('unit_id',unitId).gte('period',range.from).lte('period',range.to).order('occurred_on',{ascending:false,nullsFirst:false}).order('id');
  if(status) request=request.eq('review_status',status);
  if(q) request=request.ilike('description',`%${q}%`);
  if(origin==='operacionais') request=request.in('details->>sheet',['Despesas Operacionais - 2025','Despesas Operacionais - 2026']);
  if(origin==='cartao') request=request.in('details->>sheet',['Cartão Crédito','Cartão Crédito - Itaú']);
  const {data:batch,error}=await request.range(offset,offset+999);
  if(error) throw new Error('Não foi possível carregar os registros para revisão.');
  data.push(...((batch??[]) as Row[]));
  if((batch??[]).length<1000) break;
 }
 const count=data.length;
 const query=new URLSearchParams({from:range.from,to:range.to,...(status?{status}:{}),...(q?{q}:{}),...(origin?{origin}:{})}).toString();
 return <>
  <PeriodFilter range={range} clearHref="/financeiro/ork/revisao"><label>Situação<select name="status" defaultValue={status??''}><option value="">Todas</option>{Object.entries(REVIEW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Origem<select name="origin" defaultValue={origin??''}><option value="">Todas</option><option value="operacionais">Despesas Operacionais</option><option value="cartao">Cartão Crédito</option></select></label><label>Natureza<input name="q" defaultValue={q}/></label></PeriodFilter>
  <section className={styles.panel}><h2>Revisão por dia · {periodLabel(range)}</h2><p>{count.toLocaleString('pt-BR')} registros. Natureza e CC vêm das colunas E e H da planilha. Revisões ficam separadas e não alteram a fonte.</p><ReviewMonthlyTable rows={data} query={query}/></section>
 </>;
}
