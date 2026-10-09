"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUnit } from "@maza/auth/unit";
import { createFinanceiroClient } from "@/lib/financeiro/db/client";
import { isReconciliationUnit } from "@/lib/ork/config";
import { reviewSchema } from '@/lib/ork/review';

export async function recordReview(_previous:{message:string;ok:boolean},form:FormData) {
 const parsed=reviewSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success) return {ok:false,message:parsed.error.issues[0]?.message??'Confira os campos.'};
 const unit=await getCurrentUnit();
 if(!unit||!isReconciliationUnit(unit)) return {ok:false,message:'Selecione Restaurante Ork.'};
 if(form.get('unit_id')!==unit.id) return {ok:false,message:'A unidade mudou. Reabra o registro antes de salvar.'};
 const db=await createFinanceiroClient();
 const {error}=await db.from('ork_evidence_reviews').insert({...parsed.data,unit_id:unit.id});
 if(error) return {ok:false,message:'Não foi possível salvar. Verifique sua permissão e os registros vinculados.'};
 revalidatePath('/financeiro/ork/[section]','page');
 return {ok:true,message:'Revisão registrada no histórico. Nenhum valor de origem foi alterado.'};
}

export async function recordDecision(form: FormData) {
 const input=z.object({issue_id:z.uuid(),status:z.enum(['aberto','aguardando_cliente','resolvido']),explanation:z.string().trim().min(5).max(5000)}).parse(Object.fromEntries(form));
 const unit=await getCurrentUnit();
 if(!unit||!isReconciliationUnit(unit)) throw new Error('Selecione a Restaurante Ork.');
 const db=await createFinanceiroClient();
 const {error}=await db.from('ork_issue_decisions').insert({...input,unit_id:unit.id});
 if(error) throw new Error(error.message);
 revalidatePath('/financeiro/ork/inteligencia');
}
