'use client';
import { useActionState } from 'react';
import { REVIEW_NATURE, REVIEW_STATUS } from '@/lib/ork/review';
import { recordReview } from './actions';
import styles from './page.module.css';

export function ReviewForm({unitId,evidenceId,candidates,initial,canWrite}:{unitId:string;evidenceId:string;candidates:{id:string;label:string}[];initial:{status:string;nature:string;category:string;related:string};canWrite:boolean}) {
 const [state,action,pending]=useActionState(recordReview,{ok:false,message:''});
 if(!canWrite) return <p>Seu acesso permite consultar o histórico, mas não registrar revisões.</p>;
 return <form action={action} className={styles.decision}>
  <input type="hidden" name="unit_id" value={unitId}/><input type="hidden" name="evidence_id" value={evidenceId}/>
  <label>Situação<select name="status" defaultValue={initial.status}>{Object.entries(REVIEW_STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>Natureza revisada<select name="nature" defaultValue={initial.nature}>{Object.entries(REVIEW_NATURE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
  <label>CC revisado<input name="category" maxLength={120} defaultValue={initial.category} placeholder="Ex.: fornecedores matéria-prima"/></label>
  <label>Outra evidência para comparação<select name="related_evidence_id" defaultValue={initial.related}><option value="">Sem vínculo</option>{candidates.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
  <label>Justificativa ou pergunta para o cliente<textarea name="explanation" required minLength={5} maxLength={5000} rows={4}/></label>
  <p>Revisar não comprova quitação, não exclui duplicatas e não cria um lançamento ou DRE. Cada envio acrescenta uma entrada ao histórico.</p>
  <button className="maza-button" disabled={pending}>{pending?'Salvando…':'Registrar revisão'}</button>
  {state.message&&<p role={state.ok?'status':'alert'}>{state.message}</p>}
 </form>;
}
