import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

// checklist_action_plans não tem FK direta pra checklist_executions — o
// caminho é execution -> checklist_responses (execution_id) ->
// checklist_action_plans (response_id). O status exato de "concluído" não
// está documentado (tabela vazia hoje); tratamos qualquer status fora desta
// lista de encerrados como plano em aberto.
const CLOSED_ACTION_PLAN_STATUSES = new Set(["concluido", "concluída", "concluida", "resolvido", "fechado", "cancelado"]);

export type ChecklistRow = {
  id: string;
  templateNome: string;
  unitId: string;
  status: string | null;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  hasOpenActionPlan: boolean;
};

type ActionPlanRef = { status: string | null };
type ResponseRef = { checklist_action_plans: ActionPlanRef[] | null };
type TemplateRef = { nome: string | null };
type ExecutionRow = {
  id: string;
  unit_id: string;
  status: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  checklist_templates: TemplateRef | TemplateRef[] | null;
  checklist_responses: ResponseRef[] | null;
};

export async function getRecentChecklists(unitIds: string[], limit = 10): Promise<ChecklistRow[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .schema("mise")
    .from("checklist_executions")
    .select(
      "id, unit_id, status, iniciado_em, concluido_em, checklist_templates(nome), checklist_responses(checklist_action_plans(status))",
    )
    .in("unit_id", unitIds)
    .order("iniciado_em", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[mise] falha ao listar checklists recentes:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as ExecutionRow[]).map((row) => {
    const template = Array.isArray(row.checklist_templates) ? row.checklist_templates[0] : row.checklist_templates;
    const actionPlans = (row.checklist_responses ?? []).flatMap((r) => r.checklist_action_plans ?? []);
    const hasOpenActionPlan = actionPlans.some(
      (plan) => !plan.status || !CLOSED_ACTION_PLAN_STATUSES.has(plan.status.toLowerCase()),
    );
    return {
      id: row.id,
      templateNome: template?.nome ?? "—",
      unitId: row.unit_id,
      status: row.status,
      iniciadoEm: row.iniciado_em,
      concluidoEm: row.concluido_em,
      hasOpenActionPlan,
    };
  });
}
