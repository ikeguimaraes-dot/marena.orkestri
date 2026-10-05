import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { currentMonthRange } from "./dates";
import { fetchAllRows } from "./fetchAll";

type PrintedLabelRow = { responsavel_nome: string | null; employee_id: string | null; printed_at: string | null };

async function getEmployeeNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = createServiceClient();
  if (!supabase) return new Map();
  const { data, error } = await supabase.from("employees").select("id, nome, sobrenome").in("id", ids);
  if (error) {
    console.error("[mise] falha ao resolver nomes de employees:", error.message);
    return new Map();
  }
  return new Map(data.map((e) => [e.id, [e.nome, e.sobrenome].filter(Boolean).join(" ")]));
}

export type PrinterRankingRow = { nome: string; quantidade: number; ultimaImpressao: string };

/**
 * O formulário de impressão grava responsavel_id + responsavel_nome (texto
 * livre, de mise.responsaveis) e NUNCA preenche employee_id — quem imprime
 * escolhe o responsável numa grade manual, sem relação com o PIN da sessão
 * do tablet. Por isso o ranking agrupa por responsavel_nome; employee_id
 * só entra como fallback histórico quando o nome estiver vazio. Agrupar só
 * por employee_id (como o painel do maza-MISE faz) é o bug conhecido que
 * mostra "—" em todas as linhas — não repetir aqui.
 */
export async function getPrinterRanking(unitIds: string[]): Promise<PrinterRankingRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { startIso, endIso } = currentMonthRange();

  const rows = await fetchAllRows<PrintedLabelRow>((from, to) =>
    supabase
      .schema("mise")
      .from("labels")
      .select("responsavel_nome, employee_id, printed_at")
      .in("unit_id", unitIds)
      .not("printed_at", "is", null)
      .gte("printed_at", startIso)
      .lt("printed_at", endIso)
      .range(from, to),
  );

  const missingNameEmployeeIds = Array.from(
    new Set(rows.filter((r) => !r.responsavel_nome?.trim() && r.employee_id).map((r) => r.employee_id as string)),
  );
  const employeeNames = await getEmployeeNames(missingNameEmployeeIds);

  const byName = new Map<string, { quantidade: number; ultimaImpressao: string }>();
  for (const row of rows) {
    const nome =
      row.responsavel_nome?.trim() ||
      (row.employee_id ? employeeNames.get(row.employee_id) : undefined) ||
      "Não identificado";
    const printedAt = row.printed_at ?? "";
    const existing = byName.get(nome);
    if (existing) {
      existing.quantidade += 1;
      if (printedAt > existing.ultimaImpressao) existing.ultimaImpressao = printedAt;
    } else {
      byName.set(nome, { quantidade: 1, ultimaImpressao: printedAt });
    }
  }

  return Array.from(byName.entries())
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.quantidade - a.quantidade);
}
