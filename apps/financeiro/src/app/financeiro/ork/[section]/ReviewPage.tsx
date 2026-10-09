import Link from 'next/link';
import { z } from 'zod';
import { createFinanceiroClient } from '@/lib/financeiro/db/client';
import { REVIEW_NATURE, REVIEW_STATUS } from '@/lib/ork/review';
import { ReviewForm } from './ReviewForm';
import styles from './page.module.css';

const money=(n:number|null)=>n===null?'Não informado':Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
type Row={id:string;description:string;entity:string|null;occurred_on:string|null;amount:number|null;source:string;source_ref:string;category_original:string|null;review_status:keyof typeof REVIEW_STATUS;reviewed_nature:keyof typeof REVIEW_NATURE|null;reviewed_category:string|null;related_evidence_id:string|null};
const label=(r:Row)=>`${r.source.toUpperCase()} · ${r.occurred_on??'Sem data'} · ${r.entity??r.description} · ${money(r.amount)} · ${r.source_ref}`;

export async function ReviewPage({unitId,sp}:{unitId:string;sp:Record<string,string|undefined>}) {
 const db=await createFinanceiroClient();
 const id=z.uuid().safeParse(sp.id),period=/^20\d{2}-(0[1-9]|1[0-2])$/.test(sp.period??'')?sp.period:null;
 const status=sp.status&&Object.hasOwn(REVIEW_STATUS,sp.status)?sp.status:null;
 const page=Math.max(1,Math.min(10000,parseInt(sp.page??'1',10)||1)),size=40;
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
   <section className={styles.panel}><h2>{r.description}</h2><p>{label(r)}</p><p>Categoria original: {r.category_original??'Não informada'}</p><p>Situação: {REVIEW_STATUS[r.review_status]}</p>
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
 let request=db.from('ork_review_queue').select('*',{count:'exact'}).eq('unit_id',unitId).order('occurred_on',{ascending:false,nullsFirst:false}).order('id');
 if(period) request=request.eq('period',period);
 if(status) request=request.eq('review_status',status);
 if(q) request=request.ilike('description',`%${q}%`);
 const {data,error,count}=await request.range((page-1)*size,page*size-1);
 if(error) throw new Error('Não foi possível carregar os registros para revisão.');
 const href=(n:number)=>`?${new URLSearchParams({...(period?{period}:{}),...(status?{status}:{}),...(q?{q}:{}),page:String(n)})}`;
 return <>
  <form className={styles.filters}><label>Mês informado<input type="month" name="period" defaultValue={period??''}/></label><label>Situação<select name="status" defaultValue={status??''}><option value="">Todas</option>{Object.entries(REVIEW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Descrição<input name="q" defaultValue={q}/></label><button className="maza-button">Filtrar</button><Link href="/financeiro/ork/revisao">Limpar</Link></form>
  <section className={styles.panel}><h2>Revisão e classificação · {(count??0).toLocaleString('pt-BR')} registros</h2><p>A categoria original é preservada. Revisões não alteram totais nem confirmam lançamentos financeiros.</p><div className={styles.tableWrap}><table><thead><tr><th>Data / origem</th><th>Registro</th><th>Valor</th><th>Classificação</th><th>Situação</th></tr></thead><tbody>
   {(data as Row[]??[]).map(r=><tr key={r.id}><td>{r.occurred_on??'Sem data'}<small>{r.source.toUpperCase()}</small></td><td><Link href={`?id=${r.id}`}>{r.description}</Link><small>{r.entity}</small></td><td>{money(r.amount)}</td><td>{r.reviewed_category??'A classificar'}<small>Original: {r.category_original??'Não informada'}</small></td><td>{REVIEW_STATUS[r.review_status]}</td></tr>)}{!data?.length&&<tr><td colSpan={5}>Nenhum registro para estes filtros.</td></tr>}
  </tbody></table></div></section>
  <nav className={styles.pagination}>{page>1&&<Link href={href(page-1)}>← Anterior</Link>}<span>Página {page} de {Math.max(1,Math.ceil((count??0)/size))}</span>{page*size<(count??0)&&<Link href={href(page+1)}>Próxima →</Link>}</nav>
 </>;
}
