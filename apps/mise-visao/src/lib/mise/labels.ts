import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { currentMonthRange, previousMonthRange } from "./dates";

// status='vencida' existe no enum e na UI do app de impressão, mas nenhum
// job faz a transição — é calculado na leitura, nunca persistido. Por isso
// toda consulta de "vencida" compara validade < now() em vez de confiar
// nesse valor.
const ACTIVE_STATUS = "ativa";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countLabels(unitIds: string[], apply: (q: any) => any): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) return 0;
  const base = supabase.schema("mise").from("labels").select("id", { count: "exact", head: true }).in("unit_id", unitIds);
  const { count, error } = await apply(base);
  if (error) {
    console.error("[mise] falha ao contar labels:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getExpiringSoon24hCount(unitIds: string[], nowIso: string, in24hIso: string): Promise<number> {
  return countLabels(unitIds, (q) => q.eq("status", ACTIVE_STATUS).gte("validade", nowIso).lte("validade", in24hIso));
}

export async function getExpiredActiveCount(unitIds: string[], nowIso: string): Promise<number> {
  return countLabels(unitIds, (q) => q.eq("status", ACTIVE_STATUS).lt("validade", nowIso));
}

export type PrintedThisMonth = { currentCount: number; previousCount: number; delta: number };

export async function getPrintedThisMonth(unitIds: string[]): Promise<PrintedThisMonth> {
  const current = currentMonthRange();
  const previous = previousMonthRange();
  const [currentCount, previousCount] = await Promise.all([
    countLabels(unitIds, (q) => q.gte("printed_at", current.startIso).lt("printed_at", current.endIso)),
    countLabels(unitIds, (q) => q.gte("printed_at", previous.startIso).lt("printed_at", previous.endIso)),
  ]);
  return { currentCount, previousCount, delta: currentCount - previousCount };
}

export type UpcomingLabel = {
  id: string;
  nome: string;
  lote: string | null;
  setor: string | null;
  metodo_conservacao: string | null;
  responsavel_nome: string | null;
  validade: string;
};

export async function getUpcomingLabels(unitIds: string[], limit = 50): Promise<{ rows: UpcomingLabel[]; total: number }> {
  const supabase = createServiceClient();
  if (!supabase) return { rows: [], total: 0 };
  const { data, error, count } = await supabase
    .schema("mise")
    .from("labels")
    .select("id, nome, lote, setor, metodo_conservacao, responsavel_nome, validade", { count: "exact" })
    .in("unit_id", unitIds)
    .eq("status", ACTIVE_STATUS)
    .order("validade", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[mise] falha ao listar labels a vencer:", error.message);
    return { rows: [], total: 0 };
  }
  return { rows: (data ?? []) as UpcomingLabel[], total: count ?? 0 };
}
