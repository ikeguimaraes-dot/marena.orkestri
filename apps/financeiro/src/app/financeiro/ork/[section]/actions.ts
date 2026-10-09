"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getCurrentUnit } from "@maza/auth/unit";
import { createFinanceiroClient } from "@/lib/financeiro/db/client";
import { isReconciliationUnit } from "@/lib/ork/config";

export async function recordDecision(form: FormData) {
 const input=z.object({issue_id:z.uuid(),status:z.enum(['aberto','aguardando_cliente','resolvido']),explanation:z.string().trim().min(5).max(5000)}).parse(Object.fromEntries(form));
 const unit=await getCurrentUnit();
 if(!unit||!isReconciliationUnit(unit)) throw new Error('Selecione a Restaurante Ork.');
 const db=await createFinanceiroClient();
 const {error}=await db.from('ork_issue_decisions').insert({...input,unit_id:unit.id});
 if(error) throw new Error(error.message);
 revalidatePath('/financeiro/ork/inteligencia');
}
