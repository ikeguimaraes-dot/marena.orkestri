// POST /api/ponto/punch — registra um punch via fetch client.
//
// Auth: aceita Bearer token no header Authorization (caminho primário —
// robusto em PWA standalone iOS) OU cookie SSR (fallback desktop).
// Em PWA mobile o cookie de sessão pode não viajar de forma confiável,
// então o client (PontoApp) sempre passa o access_token explicitamente.
//
// Sem revalidatePath aqui — o client faz optimistic update sem
// router.refresh(), evitando perder a sessão num re-fetch do tree.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@maza/db/supabase/server";
import type { Database } from "@maza/db/types/database";
import type { PunchTipo, TimeClockPunch } from "@maza/db/types/pessoas";

export const runtime = "nodejs";

type Body = {
  employeeId?: string;
  tipo?: PunchTipo;
  latitude?: number | null;
  longitude?: number | null;
  deviceInfo?: string | null;
};

const VALID_TIPOS: ReadonlyArray<PunchTipo> = [
  "entrada",
  "saida",
  "intervalo_inicio",
  "intervalo_fim",
];

function bearerFromHeader(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!auth) return null;
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1]!.trim() : null;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido" }, { status: 400 });
  }

  if (!body.employeeId) {
    return NextResponse.json(
      { ok: false, error: "employeeId obrigatório" },
      { status: 400 },
    );
  }
  if (!body.tipo || !VALID_TIPOS.includes(body.tipo)) {
    return NextResponse.json(
      { ok: false, error: "tipo inválido" },
      { status: 400 },
    );
  }

  // ── Resolve client autenticado ───────────────────────────────
  // 1) Bearer token: cria client escopado pro user (PostgREST usa o JWT
  //    em todas as queries → RLS funciona normalmente)
  // 2) Cookie SSR: fallback caso o header não venha
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json(
      { ok: false, error: "Supabase env ausente" },
      { status: 503 },
    );
  }

  const token = bearerFromHeader(req);
  let supabase;

  if (token) {
    supabase = createClient<Database>(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
  } else {
    const cookieClient = await createSupabaseServerClient();
    if (!cookieClient) {
      return NextResponse.json(
        { ok: false, error: "Supabase indisponível" },
        { status: 503 },
      );
    }
    supabase = cookieClient;
  }

  // Valida que tem user real por trás
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false, error: "Não autenticado" },
      { status: 401 },
    );
  }

  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;
  const deviceInfo =
    typeof body.deviceInfo === "string" && body.deviceInfo.length > 0
      ? body.deviceInfo
      : null;

  const { data, error } = await supabase
    .from("time_clock_punches")
    .insert({
      employee_id: body.employeeId,
      tipo: body.tipo,
      latitude: lat,
      longitude: lng,
      device_info: deviceInfo,
      timestamp_punch: new Date().toISOString(),
    } as never)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Falha ao registrar ponto" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, data: data as TimeClockPunch });
}
