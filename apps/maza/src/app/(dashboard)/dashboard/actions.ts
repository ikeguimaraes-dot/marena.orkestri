"use server";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import type {
  AlertaRow,
  EventosKpiRow,
  HeadcountMarcaRow,
  ProximoEventoRow,
} from "@maza/db/types/database";

export type AniversarianteRow = {
  id: string;
  nome: string;
  sobrenome: string;
  funcao: string | null;
  data_nascimento: string;
  dia: number;
};

export async function getAniversariantes(): Promise<AniversarianteRow[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const mesAtual = new Date().getMonth() + 1;
    const { data, error } = await supabase
      .from("employees")
      .select("id, nome, sobrenome, funcao, data_nascimento")
      .not("data_nascimento", "is", null)
      .eq("ativo", true);
    if (error) { console.error("[getAniversariantes]", error.message); return []; }
    return ((data ?? []) as Array<{
      id: string; nome: string; sobrenome: string; funcao: string | null; data_nascimento: string;
    }>)
      .filter((e) => {
        if (!e.data_nascimento) return false;
        const m = new Date(e.data_nascimento + "T00:00:00").getMonth() + 1;
        return m === mesAtual;
      })
      .map((e) => ({
        id: e.id,
        nome: e.nome,
        sobrenome: e.sobrenome,
        funcao: e.funcao,
        data_nascimento: e.data_nascimento,
        dia: new Date(e.data_nascimento + "T00:00:00").getDate(),
      }))
      .sort((a, b) => a.dia - b.dia);
  } catch (ex) {
    console.error("[getAniversariantes] exceção:", ex);
    return [];
  }
}
import type {
  Alertas,
  HeadcountResumo,
  KpiMesAtual,
  ProximosEventos,
  ResumoGrupo,
} from "@/lib/dashboard/types";

/** Retorna "YYYY-MM" no fuso America/Sao_Paulo. */
function ymInSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

/** Mês anterior em "YYYY-MM" SP. */
function ymPrevInSP(d: Date): string {
  const ym = ymInSP(d);
  const [yStr, mStr] = ym.split("-");
  let y = parseInt(yStr ?? "1970", 10);
  let m = parseInt(mStr ?? "1", 10) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * KPIs do mês atual e anterior, agrupados por marca, com variação de receita.
 *
 * Estratégia: busca todas as linhas de v_eventos_kpi visíveis ao usuário
 * (RLS filtra por brand) e faz o pareamento atual/anterior em JS. Evita
 * problemas de timezone que existiriam se filtrássemos por `mes` no SQL
 * (a view trunca em UTC).
 */
export async function getKpisMesAtual(): Promise<KpiMesAtual[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("v_eventos_kpi")
      .select("*");
    if (error) {
      console.error("[getKpisMesAtual] error:", error.message);
      return [];
    }
    const rows = (data ?? []) as EventosKpiRow[];

    const now = new Date();
    const atualKey = ymInSP(now);
    const anteriorKey = ymPrevInSP(now);

    const byBrand = new Map<
      string,
      { meta: Pick<EventosKpiRow, "brand_id" | "brand_name" | "brand_color" | "brand_slug">; atual: EventosKpiRow | null; anterior: EventosKpiRow | null }
    >();

    for (const r of rows) {
      const ym = (r.mes ?? "").slice(0, 7);
      const slot =
        ym === atualKey ? "atual" : ym === anteriorKey ? "anterior" : null;
      if (!slot) continue;

      const entry = byBrand.get(r.brand_id) ?? {
        meta: {
          brand_id: r.brand_id,
          brand_name: r.brand_name,
          brand_color: r.brand_color,
          brand_slug: r.brand_slug,
        },
        atual: null,
        anterior: null,
      };
      entry[slot] = r;
      byBrand.set(r.brand_id, entry);
    }

    return Array.from(byBrand.values()).map((entry) => {
      const atual = entry.atual?.receita_realizada ?? 0;
      const anterior = entry.anterior?.receita_realizada ?? 0;
      const variacao =
        anterior === 0 ? (atual === 0 ? 0 : null) : ((atual - anterior) / anterior) * 100;
      return {
        brand_id: entry.meta.brand_id,
        brand_slug: entry.meta.brand_slug,
        brand_name: entry.meta.brand_name,
        brand_color: entry.meta.brand_color,
        mes_atual: entry.atual,
        mes_anterior: entry.anterior,
        variacao_receita_pct: variacao,
      };
    });
  } catch (e) {
    console.error("[getKpisMesAtual] exceção:", e);
    return [];
  }
}

export async function getHeadcountGrupo(): Promise<HeadcountResumo> {
  const empty: HeadcountResumo = {
    por_marca: [],
    total: {
      headcount_ativo: 0,
      folha_bruta: 0,
      admissoes_mes: 0,
      demissoes_mes: 0,
    },
  };
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return empty;

    const { data, error } = await supabase
      .from("v_headcount_por_marca")
      .select("*");
    if (error) {
      console.error("[getHeadcountGrupo] error:", error.message);
      return empty;
    }
    const rows = (data ?? []) as HeadcountMarcaRow[];
    const total = rows.reduce(
      (acc, r) => ({
        headcount_ativo: acc.headcount_ativo + Number(r.headcount_ativo ?? 0),
        folha_bruta: acc.folha_bruta + Number(r.folha_bruta ?? 0),
        admissoes_mes: acc.admissoes_mes + Number(r.admissoes_mes ?? 0),
        demissoes_mes: acc.demissoes_mes + Number(r.demissoes_mes ?? 0),
      }),
      { headcount_ativo: 0, folha_bruta: 0, admissoes_mes: 0, demissoes_mes: 0 },
    );
    return { por_marca: rows, total };
  } catch (e) {
    console.error("[getHeadcountGrupo] exceção:", e);
    return empty;
  }
}

export async function getProximosEventos(
  limite: number = 10,
): Promise<ProximosEventos> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("v_proximos_eventos")
      .select("*")
      .order("data_inicio", { ascending: true })
      .limit(limite);
    if (error) {
      console.error("[getProximosEventos] error:", error.message);
      return [];
    }
    return (data ?? []) as ProximoEventoRow[];
  } catch (e) {
    console.error("[getProximosEventos] exceção:", e);
    return [];
  }
}

export async function getAlertas(): Promise<Alertas> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from("v_alertas").select("*");
    if (error) {
      console.error("[getAlertas] error:", error.message);
      return [];
    }
    const rows = (data ?? []) as AlertaRow[];
    // Ordena: error primeiro, depois warning; dentro de cada, mais antigo primeiro.
    return rows.sort((a, b) => {
      const sevA = a.severidade === "error" ? 0 : 1;
      const sevB = b.severidade === "error" ? 0 : 1;
      if (sevA !== sevB) return sevA - sevB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  } catch (e) {
    console.error("[getAlertas] exceção:", e);
    return [];
  }
}

/** Resumo executivo numa só chamada (várias queries em paralelo, agregadas em JS). */
export async function getResumoGrupo(): Promise<ResumoGrupo> {
  const empty: ResumoGrupo = {
    total_marcas_ativas: 0,
    total_eventos_mes: 0,
    receita_prevista_mes: 0,
    receita_realizada_mes: 0,
    headcount_total: 0,
    folha_bruta_total: 0,
    eventos_proximos_7d: 0,
    alertas_criticos: 0,
  };
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return empty;

    const now = new Date();
    const atualKey = ymInSP(now);
    const competenciaAtual = `${atualKey}-01`;
    const sete_dias = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const [brandsRes, kpiRes, dreRes, headcountRes, prox7Res, alertasRes] =
      await Promise.all([
        supabase
          .from("brands")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase.from("v_eventos_kpi").select("*"),
        supabase
          .from("v_dre_consolidado")
          .select("brand_id, receita_bruta, competencia")
          .eq("competencia", competenciaAtual),
        supabase.from("v_headcount_por_marca").select("*"),
        supabase
          .from("v_proximos_eventos")
          .select("id", { count: "exact", head: true })
          .lte("data_inicio", sete_dias),
        supabase
          .from("v_alertas")
          .select("severidade", { count: "exact", head: true })
          .eq("severidade", "error"),
      ]);

    const kpiRows = (kpiRes.data ?? []) as EventosKpiRow[];
    const headcountRows = (headcountRes.data ?? []) as HeadcountMarcaRow[];
    type DreRow = { brand_id: string; receita_bruta: number | string | null; competencia: string };
    let dreRows = (dreRes.data ?? []) as DreRow[];
    let receita_dre_label: string | undefined;

    // Fallback: se o mês atual não tem DRE, usa o mês mais recente disponível.
    if (dreRows.length === 0) {
      const { data: fallback } = await supabase
        .from("v_dre_consolidado")
        .select("brand_id, receita_bruta, competencia")
        .order("competencia", { ascending: false })
        .limit(20);
      if (fallback && fallback.length > 0) {
        const typed = fallback as DreRow[];
        const mostRecent = typed[0]!.competencia;
        dreRows = typed.filter((r) => r.competencia === mostRecent);
        const [y, m] = mostRecent.split("-");
        const monthNames = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
        const monthIdx = parseInt(m ?? "1", 10) - 1;
        receita_dre_label = `${monthNames[monthIdx] ?? m}/${(y ?? "2026").slice(2)}`;
      }
    }

    const kpisMes = kpiRows.filter(
      (r) => (r.mes ?? "").slice(0, 7) === atualKey,
    );

    const total_eventos_mes = kpisMes.reduce(
      (s, r) => s + Number(r.total_eventos ?? 0),
      0,
    );
    const receita_prevista_mes = kpisMes.reduce(
      (s, r) => s + Number(r.receita_prevista ?? 0),
      0,
    );
    // Receita realizada vem do DRE (engloba todas as categorias: salão, eventos,
    // bar, delivery). Fallback pra v_eventos_kpi.receita_realizada (só eventos
    // concluídos) quando o DRE não tem nenhum período disponível.
    const receita_dre = dreRows.reduce(
      (s, r) => s + Number(r.receita_bruta ?? 0),
      0,
    );
    const receita_eventos = kpisMes.reduce(
      (s, r) => s + Number(r.receita_realizada ?? 0),
      0,
    );
    const receita_realizada_mes = receita_dre > 0 ? receita_dre : receita_eventos;
    const headcount_total = headcountRows.reduce(
      (s, r) => s + Number(r.headcount_ativo ?? 0),
      0,
    );
    const folha_bruta_total = headcountRows.reduce(
      (s, r) => s + Number(r.folha_bruta ?? 0),
      0,
    );

    return {
      total_marcas_ativas: brandsRes.count ?? 0,
      total_eventos_mes,
      receita_prevista_mes,
      receita_realizada_mes,
      receita_dre_label,
      headcount_total,
      folha_bruta_total,
      eventos_proximos_7d: prox7Res.count ?? 0,
      alertas_criticos: alertasRes.count ?? 0,
    };
  } catch (e) {
    console.error("[getResumoGrupo] exceção:", e);
    return empty;
  }
}
