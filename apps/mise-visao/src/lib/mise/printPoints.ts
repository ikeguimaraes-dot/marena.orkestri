import "server-only";
import { createServiceClient } from "@/lib/supabase/server";

export async function getActivePrintPointsCount(unitIds: string[]): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) return 0;
  const { count, error } = await supabase
    .schema("mise")
    .from("print_points")
    .select("id", { count: "exact", head: true })
    .in("unit_id", unitIds)
    .eq("ativo", true);
  if (error) {
    console.error("[mise] falha ao contar impressoras ativas:", error.message);
    return 0;
  }
  return count ?? 0;
}
