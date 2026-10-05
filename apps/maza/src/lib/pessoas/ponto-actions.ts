"use server";

// Server Action de registro de ponto.
//
// Por que separado em arquivo próprio: Server Actions vivem aqui sem o
// resto do bundle de actions.ts. Cada export "use server" vira uma RPC
// chamável do client — separação reduz superfície de ataque.
//
// Por que service_role: o browser client perde sessão em iOS Safari e
// PWA standalone (storage isolado, cookie HTTP-only não vai pro JS).
// Cookie SSR funciona pro auth.getUser() server-side (ver getMyEmployee),
// então usamos cookie pra IDENTIFICAR/AUTORIZAR o caller, e service_role
// só pra fazer o INSERT (bypassa RLS — cuja recursão sobre employees
// pode ser o que está quebrando).
//
// Defesa em profundidade:
//   1) cookie auth → quem está chamando? (auth.getUser)
//   2) authz → esse user é dono do employeeId OU tem role na unit dele?
//   3) só então service_role insere

import { createSupabaseServerClient, createServiceClient } from "@maza/db/supabase/server";
import type { PunchTipo, TimeClockPunch } from "@maza/db/types/pessoas";
import { nextPunchTipo, PUNCH_LABEL } from "@/lib/pessoas/punch";

export type RegistrarPunchInput = {
  employeeId: string;
  tipo: PunchTipo;
  latitude?: number | null;
  longitude?: number | null;
  deviceInfo?: string | null;
  photoBase64?: string | null;
};

/** ActionResult estendido para punch — inclui minutosRestantes no erro de pausa bloqueada. */
export type PunchActionResult =
  | { ok: true; data: TimeClockPunch }
  | { ok: false; error: string; minutosRestantes?: number };

const VALID_TIPOS: ReadonlyArray<PunchTipo> = [
  "entrada",
  "saida",
  "intervalo_inicio",
  "intervalo_fim",
];

export async function registrarPunch(
  input: RegistrarPunchInput,
): Promise<PunchActionResult> {
  // ── Validação ────────────────────────────────────────────────
  if (!input?.employeeId) {
    return { ok: false, error: "employeeId obrigatório" };
  }
  if (!VALID_TIPOS.includes(input.tipo)) {
    return { ok: false, error: "tipo inválido" };
  }

  // ── 1) Auth via cookie (server-side) ─────────────────────────
  const cookieClient = await createSupabaseServerClient();
  if (!cookieClient) {
    return { ok: false, error: "Supabase indisponível" };
  }
  const { data: { user } } = await cookieClient.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sessão expirada — faça login novamente" };
  }

  // ── 2) Authz: caller é dono do employee OU tem role na unit ──
  const service = createServiceClient();
  if (!service) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ausente no servidor" };
  }
  type EmpRow = { id: string; user_id: string | null; unit_id: string };
  const { data: employee, error: empErr } = await service
    .from("employees")
    .select("id, user_id, unit_id")
    .eq("id", input.employeeId)
    .maybeSingle<EmpRow>();
  if (empErr) {
    return { ok: false, error: `Lookup employee falhou: ${empErr.message}` };
  }
  if (!employee) {
    return { ok: false, error: "Colaborador não encontrado" };
  }

  const isSelf = employee.user_id === user.id;
  let canPunchForOthers = false;
  if (!isSelf) {
    const { data: roles, error: rolesErr } = await service
      .from("user_roles")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("unit_id", employee.unit_id);
    if (rolesErr) {
      return { ok: false, error: `Lookup roles falhou: ${rolesErr.message}` };
    }
    canPunchForOthers = !!roles && roles.length > 0;
  }
  if (!isSelf && !canPunchForOthers) {
    return {
      ok: false,
      error: "Sem permissão para registrar ponto deste colaborador",
    };
  }

  // ── 2.5) Validação de sequência e regras de negócio ──────────
  // Meia-noite em São Paulo (UTC-3, sem DST desde 2019) como limite do dia.
  const agora = new Date();
  const agoraSP = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const meiaNoiteSP = new Date(agoraSP.getFullYear(), agoraSP.getMonth(), agoraSP.getDate());
  const offsetMs = agora.getTime() - agoraSP.getTime();
  const meiaNoiteUTC = new Date(meiaNoiteSP.getTime() + offsetMs);

  type PunchRow = Pick<TimeClockPunch, "id" | "tipo" | "timestamp_punch">;
  const { data: punchesHoje, error: punchesErr } = await service
    .from("time_clock_punches")
    .select("id, tipo, timestamp_punch")
    .eq("employee_id", employee.id)
    .gte("timestamp_punch", meiaNoiteUTC.toISOString())
    .order("timestamp_punch", { ascending: true })
    .returns<PunchRow[]>();

  if (punchesErr) {
    return { ok: false, error: `Erro ao verificar pontos do dia: ${punchesErr.message}` };
  }

  const punchesDodia = punchesHoje ?? [];

  // Regra 1a — máximo 4 registros por dia
  if (punchesDodia.length >= 4) {
    return { ok: false, error: "Jornada já encerrada. Máximo de 4 registros por dia atingido." };
  }

  // Regra 1b — sequência obrigatória: entrada → intervalo_inicio → intervalo_fim → saida
  const proximoEsperado = nextPunchTipo(punchesDodia as TimeClockPunch[]);
  if (proximoEsperado === null) {
    return { ok: false, error: "Jornada já encerrada para hoje." };
  }
  if (input.tipo !== proximoEsperado) {
    return {
      ok: false,
      error: `Registro inválido. Próximo esperado: ${PUNCH_LABEL[proximoEsperado]}.`,
    };
  }

  // Regra 2 — intervalo disponível somente após 1h da entrada
  if (input.tipo === "intervalo_inicio") {
    const entradaPunch = punchesDodia.find((p) => p.tipo === "entrada");
    if (entradaPunch) {
      const diffMs = agora.getTime() - new Date(entradaPunch.timestamp_punch).getTime();
      const diffMinutos = diffMs / 60_000;
      if (diffMinutos < 60) {
        const minutosRestantes = Math.ceil(60 - diffMinutos);
        return {
          ok: false,
          error: `Pausa disponível somente 1h após a entrada. Aguarde ${minutosRestantes} minuto${minutosRestantes !== 1 ? "s" : ""}.`,
          minutosRestantes,
        };
      }
    }
  }

  // ── 3) Insert via service_role (bypassa RLS) ─────────────────
  // ── 3.1) Upload da Foto (se enviada) ─────────────────────────
  let photoUrl: string | null = null;
  if (input.photoBase64) {
    try {
      // Extrair apenas os dados do base64 ignorando o header (data:image/jpeg;base64,...)
      const matches = input.photoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const base64Data = (matches ? matches[2] : input.photoBase64) ?? input.photoBase64;
      const buffer = Buffer.from(base64Data, "base64");

      const BUCKET_NAME = "ponto-fotos";
      const { data: buckets } = await service.storage.listBuckets();

      if (buckets && !buckets.find((b) => b.name === BUCKET_NAME)) {
        await service.storage.createBucket(BUCKET_NAME, { public: true });
      }

      const fileName = `${employee.id}/${Date.now()}.jpg`;
      const { error: uploadErr } = await service.storage
        .from(BUCKET_NAME)
        .upload(fileName, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (!uploadErr) {
        const { data: publicUrlData } = service.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName);
        photoUrl = publicUrlData.publicUrl;
      }
    } catch (err) {
      console.error("[registrarPunch] Falha no upload da foto", err);
    }
  }

  // Combinar photoUrl dentro do deviceInfo JSON
  let deviceInfoObj: Record<string, any> = {};
  if (input.deviceInfo) {
    try {
      deviceInfoObj = JSON.parse(input.deviceInfo);
    } catch { /* ignore parse err */ }
  }
  if (photoUrl) {
    deviceInfoObj.photoUrl = photoUrl;
  }
  const finalDeviceInfo = Object.keys(deviceInfoObj).length > 0
    ? JSON.stringify(deviceInfoObj)
    : null;

  const { data, error } = await service
    .from("time_clock_punches")
    .insert({
      employee_id: employee.id,
      tipo: input.tipo,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      device_info: finalDeviceInfo,
      timestamp_punch: new Date().toISOString(),
    } as never)
    .select()
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Falha ao registrar ponto",
    };
  }

  return { ok: true, data: data as TimeClockPunch };
}
