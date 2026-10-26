"use server";

import { createFinanceiroClient } from "@/lib/financeiro/db/client";

import { refreshUnits } from "@/lib/financeiro/razao/refresh";
import { requireUser } from "@maza/auth/server";

import {
  importarExtratoDominioParaBanco,
  type ImportarExtratoDominioResultado,
} from "@/lib/folha/dominio/importar";
import type { DominioParseResultado } from "@/lib/folha/dominio/types";

export async function importarExtratoDominio(
  resultado: DominioParseResultado
): Promise<ImportarExtratoDominioResultado> {
  await requireUser();
  const supabase = await createFinanceiroClient();
  if (!supabase) {
    return {
      ok: false,
      arquivoOrigem: resultado.arquivoOrigem,
      competencias: [],
      cnpjsDesconhecidos: [],
    };
  }
  return importarExtratoDominioParaBanco(supabase, resultado);
}

export async function recalcularIndicadoresFolha(unitId: string): Promise<{ ok: boolean; mensagem: string }> {
  await requireUser();
  const db = await createFinanceiroClient();
  const { data: canWrite, error: accessError } = await db.rpc("financeiro_can_write", { p_unit: unitId });
  if (accessError || !canWrite) return { ok: false, mensagem: "Não foi possível autorizar o recálculo desta unidade." };
  try {
    await refreshUnits(db, [unitId]);
    return { ok: true, mensagem: "Indicadores atualizados. A folha salva foi preservada." };
  } catch (error) {
    console.error("Falha ao recalcular indicadores da folha", { unitId, error });
    return { ok: false, mensagem: "A folha continua salva, mas o recálculo não foi concluído. Tente novamente em instantes." };
  }
}
