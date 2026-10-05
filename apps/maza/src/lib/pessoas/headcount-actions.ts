"use server";

import { createSupabaseServerClient } from "@maza/db/supabase/server";

export type Period = "mes" | "trimestre" | "ano";
export type HeadcountFilters = { period: Period; brandId?: string };

export type HeadcountStats = {
  totalAtivo: number;
  admissoes: number;
  demissoes: number;
  variacao: number;
  turnover: number;
};

export type DistribuicaoMarca = {
  brandId: string;
  brandName: string;
  unitId: string;
  unitName: string;
  ativos: number;
  folhaBruta: number;
  percentual: number;
};

export type DistribuicaoFuncao = {
  funcao: string;
  qtd: number;
  percentual: number;
  salarioMedio: number;
};

export type DistribuicaoDepartamento = {
  departamento: string;
  qtd: number;
  percentual: number;
};

export type Movimentacao = {
  data: string;
  tipo: "admissao" | "demissao";
  nome: string;
  funcao: string;
  brandName: string;
};

export type VagaAberta = {
  id: string;
  funcao: string;
  brandName: string;
  diasAberta: number;
};

export type BrandOption = { id: string; name: string };

function getPeriodRange(period: Period) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (period === "mes") {
    return {
      start: fmt(new Date(y, m, 1)),
      end: fmt(new Date(y, m + 1, 0)),
      prevStart: fmt(new Date(y, m - 1, 1)),
      prevEnd: fmt(new Date(y, m, 0)),
    };
  }
  if (period === "trimestre") {
    const q = Math.floor(m / 3);
    return {
      start: fmt(new Date(y, q * 3, 1)),
      end: fmt(new Date(y, q * 3 + 3, 0)),
      prevStart: fmt(new Date(y, (q - 1) * 3, 1)),
      prevEnd: fmt(new Date(y, q * 3, 0)),
    };
  }
  // ano
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    prevStart: `${y - 1}-01-01`,
    prevEnd: `${y - 1}-12-31`,
  };
}

async function unitIdsForBrand(supabase: ReturnType<typeof createSupabaseServerClient> extends Promise<infer T> ? T : never, brandId: string): Promise<string[]> {
  const { data } = await supabase!
    .from("units")
    .select("id")
    .eq("brand_id", brandId);
  return (data ?? []).map((u: { id: string }) => u.id);
}

export async function getHeadcountStats(
  filters: HeadcountFilters,
): Promise<HeadcountStats> {
  const fallback: HeadcountStats = {
    totalAtivo: 0,
    admissoes: 0,
    demissoes: 0,
    variacao: 0,
    turnover: 0,
  };
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return fallback;

    const { start, end, prevEnd } = getPeriodRange(filters.period);

    let query = supabase
      .from("employees")
      .select("id, ativo, data_admissao, data_demissao, unit_id");

    if (filters.brandId) {
      const ids = await unitIdsForBrand(supabase, filters.brandId);
      if (ids.length === 0) return fallback;
      query = query.in("unit_id", ids);
    }

    const { data, error } = await query;
    if (error || !data) return fallback;

    const totalAtivo = data.filter((e: { ativo: boolean }) => e.ativo).length;

    const admissoes = data.filter(
      (e: { data_admissao: string }) =>
        e.data_admissao >= start && e.data_admissao <= end,
    ).length;

    const demissoes = data.filter(
      (e: { data_demissao: string | null }) =>
        e.data_demissao != null &&
        e.data_demissao >= start &&
        e.data_demissao <= end,
    ).length;

    const prevAtivo = data.filter((e: { data_admissao: string; data_demissao: string | null }) => {
      const admitted = e.data_admissao <= prevEnd;
      const notYetDismissed = !e.data_demissao || e.data_demissao > prevEnd;
      return admitted && notYetDismissed;
    }).length;

    const variacao = totalAtivo - prevAtivo;
    const turnover =
      totalAtivo > 0
        ? Math.round(((admissoes + demissoes) / 2 / totalAtivo) * 1000) / 10
        : 0;

    return { totalAtivo, admissoes, demissoes, variacao, turnover };
  } catch {
    return fallback;
  }
}

export async function getDistribuicaoMarcas(
  filters: HeadcountFilters,
): Promise<DistribuicaoMarca[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { data: units } = await supabase
      .from("units")
      .select("id, name, brand_id, brands(id, name)");

    const unitMap = new Map(
      ((units ?? []) as any[]).map((u) => [u.id, u]),
    );

    let empQuery = supabase
      .from("employees")
      .select("id, salario_base, unit_id")
      .eq("ativo", true);

    if (filters.brandId) {
      const ids = ((units ?? []) as any[])
        .filter((u) => u.brand_id === filters.brandId)
        .map((u) => u.id as string);
      if (ids.length === 0) return [];
      empQuery = empQuery.in("unit_id", ids);
    }

    const { data: employees, error } = await empQuery;
    if (error || !employees) return [];

    const agg = new Map<
      string,
      {
        brandId: string;
        brandName: string;
        unitId: string;
        unitName: string;
        ativos: number;
        folhaBruta: number;
      }
    >();

    for (const e of employees as any[]) {
      const unit = unitMap.get(e.unit_id);
      if (!unit) continue;
      const key = `${unit.brand_id}::${e.unit_id}`;
      if (!agg.has(key)) {
        agg.set(key, {
          brandId: unit.brand_id,
          brandName: unit.brands?.name ?? "—",
          unitId: e.unit_id,
          unitName: unit.name,
          ativos: 0,
          folhaBruta: 0,
        });
      }
      const row = agg.get(key)!;
      row.ativos++;
      row.folhaBruta += Number(e.salario_base) || 0;
    }

    const total = employees.length;
    return Array.from(agg.values())
      .sort((a, b) => b.ativos - a.ativos)
      .map((row) => ({
        ...row,
        percentual:
          total > 0 ? Math.round((row.ativos / total) * 1000) / 10 : 0,
      }));
  } catch {
    return [];
  }
}

export async function getDistribuicaoFuncoes(
  filters: HeadcountFilters,
): Promise<DistribuicaoFuncao[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
      .from("employees")
      .select("id, funcao, salario_base, unit_id")
      .eq("ativo", true);

    if (filters.brandId) {
      const ids = await unitIdsForBrand(supabase, filters.brandId);
      if (ids.length === 0) return [];
      query = query.in("unit_id", ids);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const agg = new Map<string, { qtd: number; totalSalario: number }>();
    for (const e of data as any[]) {
      const funcao: string = e.funcao || "Não informado";
      const row = agg.get(funcao) ?? { qtd: 0, totalSalario: 0 };
      row.qtd++;
      row.totalSalario += Number(e.salario_base) || 0;
      agg.set(funcao, row);
    }

    const total = data.length;
    return Array.from(agg.entries())
      .map(([funcao, row]) => ({
        funcao,
        qtd: row.qtd,
        percentual:
          total > 0 ? Math.round((row.qtd / total) * 1000) / 10 : 0,
        salarioMedio: row.qtd > 0 ? Math.round(row.totalSalario / row.qtd) : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export async function getDistribuicaoDepartamentos(
  filters: HeadcountFilters,
): Promise<DistribuicaoDepartamento[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
      .from("employees")
      .select("id, departamento, unit_id")
      .eq("ativo", true);

    if (filters.brandId) {
      const ids = await unitIdsForBrand(supabase, filters.brandId);
      if (ids.length === 0) return [];
      query = query.in("unit_id", ids);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const agg = new Map<string, number>();
    for (const e of data as any[]) {
      const dep: string = e.departamento || "Não informado";
      agg.set(dep, (agg.get(dep) ?? 0) + 1);
    }

    const total = data.length;
    return Array.from(agg.entries())
      .map(([departamento, qtd]) => ({
        departamento,
        qtd,
        percentual:
          total > 0 ? Math.round((qtd / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd);
  } catch {
    return [];
  }
}

export async function getMovimentacoesRecentes(
  filters: HeadcountFilters,
  limit = 20,
): Promise<Movimentacao[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    const { start } = getPeriodRange(filters.period);

    const { data: units } = await supabase
      .from("units")
      .select("id, brand_id, brands(name)");

    const unitMap = new Map(((units ?? []) as any[]).map((u) => [u.id, u]));

    let query = supabase
      .from("employees")
      .select(
        "id, nome, sobrenome, funcao, data_admissao, data_demissao, unit_id",
      )
      .or(`data_admissao.gte.${start},data_demissao.gte.${start}`);

    if (filters.brandId) {
      const ids = ((units ?? []) as any[])
        .filter((u) => u.brand_id === filters.brandId)
        .map((u) => u.id as string);
      if (ids.length === 0) return [];
      query = query.in("unit_id", ids);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const movs: Movimentacao[] = [];
    for (const e of data as any[]) {
      const unit = unitMap.get(e.unit_id);
      const brandName: string = unit?.brands?.name ?? "—";
      if (e.data_admissao >= start) {
        movs.push({
          data: e.data_admissao,
          tipo: "admissao",
          nome: `${e.nome} ${e.sobrenome}`,
          funcao: e.funcao,
          brandName,
        });
      }
      if (e.data_demissao && e.data_demissao >= start) {
        movs.push({
          data: e.data_demissao,
          tipo: "demissao",
          nome: `${e.nome} ${e.sobrenome}`,
          funcao: e.funcao,
          brandName,
        });
      }
    }

    return movs.sort((a, b) => b.data.localeCompare(a.data)).slice(0, limit);
  } catch {
    return [];
  }
}

export async function getVagasAbertas(
  filters: Pick<HeadcountFilters, "brandId">,
): Promise<VagaAberta[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];

    let query = supabase
      .from("job_openings")
      .select("id, title, brand_id, created_at, brands(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (filters.brandId) {
      query = query.eq("brand_id", filters.brandId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const today = Date.now();
    return (data as any[]).map((v) => ({
      id: v.id as string,
      funcao: v.title as string,
      brandName: (v.brands?.name as string) ?? "—",
      diasAberta: Math.floor(
        (today - new Date(v.created_at as string).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    }));
  } catch {
    return [];
  }
}

export async function getHeadcountBrands(): Promise<BrandOption[]> {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .eq("active", true)
      .order("name");
    if (error || !data) return [];
    return data as BrandOption[];
  } catch {
    return [];
  }
}
