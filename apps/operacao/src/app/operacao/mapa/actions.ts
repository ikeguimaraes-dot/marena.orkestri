"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";

export type RestaurantTable = {
  id: string;
  unit_id: string;
  numero: string;
  capacidade: number;
  area: "salao" | "varanda" | "bar" | "vip" | "externa";
  status: "livre" | "ocupada" | "reservada" | "bloqueada";
  ativo: boolean;
  created_at: string;
};

export type TableWithReserva = RestaurantTable & {
  reserva_nome?: string;
  reserva_horario?: string;
};

export async function listRestaurantTables(unitId: string): Promise<TableWithReserva[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const hoje = new Date().toISOString().slice(0, 10);
  const [tablesRes, reservasRes] = await Promise.all([
    supabase
      .from("restaurant_tables" as never)
      .select("*")
      .eq("unit_id", unitId)
      .eq("ativo", true)
      .order("area")
      .order("numero")
      .returns<RestaurantTable[]>(),
    supabase
      .from("reservations" as never)
      .select("mesa, nome_cliente, horario, status")
      .eq("unit_id", unitId)
      .eq("data", hoje)
      .in("status", ["confirmada", "pendente"])
      .returns<{ mesa: string | null; nome_cliente: string; horario: string; status: string }[]>(),
  ]);
  if (tablesRes.error) console.error("[listRestaurantTables] tables:", tablesRes.error.message);
  if (reservasRes.error) console.error("[listRestaurantTables] reservations:", reservasRes.error.message);
  const reservasByMesa = new Map<string, { nome_cliente: string; horario: string }>();
  for (const r of reservasRes.data ?? []) {
    if (r.mesa) reservasByMesa.set(r.mesa, { nome_cliente: r.nome_cliente, horario: r.horario });
  }
  return (tablesRes.data ?? []).map((t) => {
    const res = reservasByMesa.get(t.numero);
    return {
      ...t,
      reserva_nome: res?.nome_cliente,
      reserva_horario: res?.horario,
    };
  });
}

export async function updateTableStatus(
  id: string,
  status: RestaurantTable["status"],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase
    .from("restaurant_tables" as never)
    .update({ status } as never)
    .eq("id", id);
  if (error) {
    console.error("[updateTableStatus]", error.message);
    return { ok: false, error: error.message };
  }
  revalidatePath("/operacao/mapa");
  return { ok: true };
}

export async function createRestaurantTable(input: {
  unit_id: string;
  numero: string;
  capacidade: number;
  area: RestaurantTable["area"];
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível" };
  const { error } = await supabase
    .from("restaurant_tables" as never)
    .insert(input as never);
  if (error) {
    console.error("[createRestaurantTable]", error.message);
    return { ok: false, error: error.message };
  }
  revalidatePath("/operacao/mapa");
  return { ok: true };
}
