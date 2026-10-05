import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export type Unit = { id: string; name: string };

export async function getUnits(): Promise<Unit[]> {
  const supabase = createServiceClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("units")
    .select("id, name")
    .eq("active", true)
    .order("name");
  if (error) {
    console.error("[mise] falha ao ler public.units:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Resolve o filtro de unit_id a partir do ?unidade= da URL.
 * "consolidado" (ou qualquer valor desconhecido/ausente) => as duas units.
 */
export function resolveUnitFilter(unidadeParam: string | undefined, units: Unit[]): {
  unitIds: string[];
  selected: string;
} {
  if (unidadeParam && units.some(unit => unit.id === unidadeParam)) {
    return { unitIds: [unidadeParam], selected: unidadeParam };
  }
  return { unitIds: units.map(unit => unit.id), selected: "consolidado" };
}
