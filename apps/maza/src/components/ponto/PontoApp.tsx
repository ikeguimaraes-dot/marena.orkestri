"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  Clock,
  Coffee,
  LogIn,
  LogOut as LogOutIcon,
  Play,
  Sparkles,
} from "lucide-react";

import { CameraCapture } from "@/components/ponto/CameraCapture";
import { useDeviceInfo, useGeolocation } from "@/components/ponto/useGeolocation";
import { registrarPunch } from "@/lib/pessoas/ponto-actions";
import type { PunchActionResult } from "@/lib/pessoas/ponto-actions";
import {
  PUNCH_BUTTON_LABEL,
  PUNCH_COLOR,
  PUNCH_LABEL,
  formatHHMM,
  formatMinutesAsHours,
  calcWorkHours,
  nextPunchTipo,
} from "@/lib/pessoas/punch";
import { avatarColor, initials } from "@/lib/format";
import type { PunchTipo, TimeClockPunch } from "@maza/db/types/pessoas";

const ICONS: Record<PunchTipo, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  entrada: LogIn,
  intervalo_inicio: Coffee,
  intervalo_fim: Play,
  saida: LogOutIcon,
};

type SuccessState = { punch: TimeClockPunch; at: number } | null;

type DebugLine = { ts: string; tag: string; data: unknown };

export function PontoApp({
  employeeId,
  employeeName,
  employeeFuncao,
  initialPunches,
}: {
  employeeId: string;
  employeeName: string;
  employeeFuncao: string;
  initialPunches: TimeClockPunch[];
}) {
  // Lê ?debug=1 do window — evita Suspense boundary do useSearchParams.
  const [debugMode, setDebugMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDebugMode(sp.get("debug") === "1");
  }, []);

  const [pending, startTransition] = useTransition();
  const [punches, setPunches] = useState<TimeClockPunch[]>(initialPunches);
  const [now, setNow] = useState<Date>(() => new Date());
  const [showCamera, setShowCamera] = useState(false);
  const [success, setSuccess] = useState<SuccessState>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutosRestantes, setMinutosRestantes] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<DebugLine[]>([]);

  // Sempre acumula — só renderiza quando debugMode=true. Evita closure
  // capturando valor stale de debugMode no primeiro mount.
  const pushDebug = (tag: string, data: unknown) => {
    const ts = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setDebugLog((prev) => [...prev, { ts, tag, data }]);
  };

  const geo = useGeolocation();
  const ua = useDeviceInfo();

  // Relógio em tempo real (1 tick/s)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Mount diagnostic — sem seed de tokens. O insert agora é Server Action,
  // não browser client; auth via cookie SSR (que sempre funciona, prova:
  // getMyEmployee server-side já carrega o employee correto).
  useEffect(() => {
    pushDebug("mount", {
      employeeId,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      isStandalone:
        typeof window !== "undefined" && window.matchMedia
          ? window.matchMedia("(display-mode: standalone)").matches
          : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss do banner de sucesso
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const next = useMemo(() => nextPunchTipo(punches), [punches]);
  const totals = useMemo(() => calcWorkHours(punches), [punches]);

  // Limpa o bloqueio de pausa quando a sequência avança (novo punch registrado)
  const punchCount = punches.length;
  useEffect(() => {
    setMinutosRestantes(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punchCount]);

  const isPausaBloqueada = next === "intervalo_inicio" && minutosRestantes !== null && minutosRestantes > 0;

  const Icon = next ? ICONS[next] : Sparkles;
  const color = next ? PUNCH_COLOR[next] : "var(--brand)";
  const buttonLabel = isPausaBloqueada
    ? `Pausa disponível em ${minutosRestantes}min`
    : next
      ? PUNCH_BUTTON_LABEL[next]
      : "Jornada concluída";

  const handlePress = () => {
    if (!next || pending || isPausaBloqueada) return;
    setError(null);
    setShowCamera(true);
  };

  const handleCaptureDone = (photoBase64: string | null) => {
    setShowCamera(false);
    if (!next) return;

    startTransition(async () => {
      // Pede geo em paralelo (não-bloqueante)
      const geoState = await geo.request();

      // Vibração háptica (mobile)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(80);
        } catch {
          /* ignore */
        }
      }

      const deviceInfo = JSON.stringify({
        ua: ua ?? null,
        photoTaken: photoBase64 !== null, // foto capturada mas NÃO armazenada (storage v2)
        geoStatus: geoState.status,
      });

      const lat = geoState.status === "ok" ? geoState.lat : null;
      const lng = geoState.status === "ok" ? geoState.lng : null;

      // INSERT via Server Action (auth cookie + service_role bypassa RLS).
      // Caller é validado server-side: cookie identifica o user, action
      // confere se ele é dono do employeeId ou tem role na unit dele.
      // Browser client/setSession não tocados — não dependemos de localStorage.
      const payload = {
        employeeId,
        tipo: next,
        latitude: lat,
        longitude: lng,
        deviceInfo,
        photoBase64,
      };
      pushDebug("punch.payload", { ...payload, photoBase64: photoBase64 ? "[BASE64_TRUNCATED]" : null });

      const result: PunchActionResult = await registrarPunch(payload);

      pushDebug("punch.result", {
        ok: result.ok,
        error: result.ok ? null : result.error,
        minutosRestantes: !result.ok ? (result.minutosRestantes ?? null) : null,
        id: result.ok ? result.data.id : null,
      });

      if (!result.ok) {
        setError(result.error);
        if (result.minutosRestantes !== undefined) {
          setMinutosRestantes(result.minutosRestantes);
        }
        return;
      }
      setMinutosRestantes(null);

      // Optimistic update — sem router.refresh() pra não invalidar nada.
      const punch = result.data;
      setPunches((prev) => [...prev, punch]);
      setSuccess({ punch, at: Date.now() });
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Header employeeName={employeeName} employeeFuncao={employeeFuncao} now={now} />

      <StandaloneWarning />

      {success && <SuccessBanner punch={success.punch} />}
      {error && <ErrorBanner message={error} onClose={() => setError(null)} />}

      <PunchButton
        Icon={Icon}
        label={buttonLabel}
        color={color}
        disabled={!next || pending || isPausaBloqueada}
        loading={pending}
        onClick={handlePress}
      />

      <Totals
        worked={totals.worked_minutes}
        breakMin={totals.break_minutes}
      />

      <Timeline punches={punches} />

      <SignOutFooter />

      {debugMode && (
        <DebugPanel
          log={debugLog}
          context={{
            employeeId,
            employeeName,
          }}
        />
      )}

      {showCamera && (
        <CameraCapture
          onClose={() => setShowCamera(false)}
          onCapture={handleCaptureDone}
        />
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────

function Header({
  employeeName,
  employeeFuncao,
  now,
}: {
  employeeName: string;
  employeeFuncao: string;
  now: Date;
}) {
  const color = avatarColor(employeeName);
  const time = now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        marginTop: 12,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: 2,
          fontWeight: 700,
          color: "var(--brand)",
          textTransform: "uppercase",
        }}
      >
        MARENA · Ponto
      </div>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 99,
          background: `color-mix(in srgb, ${color} 22%, transparent)`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {initials(employeeName)}
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-playfair, var(--font-geist-sans))",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: -0.4,
            lineHeight: 1.1,
          }}
        >
          {employeeName}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
          {employeeFuncao}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 4 }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          {time}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-3)",
            marginTop: 4,
            textTransform: "capitalize",
          }}
        >
          {date}
        </div>
      </div>
    </div>
  );
}

function PunchButton({
  Icon,
  label,
  color,
  disabled,
  loading,
  onClick,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  color: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        width: "100%",
        minHeight: 140,
        background: disabled ? "var(--surface-2)" : color,
        color: disabled ? "var(--text-3)" : "white",
        border: "none",
        borderRadius: 18,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        boxShadow: disabled ? "none" : `0 8px 20px -8px ${color}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "rgba(255,255,255,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <Camera size={22} strokeWidth={2.4} />
        ) : (
          <Icon size={22} strokeWidth={2.4} />
        )}
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: -0.2,
        }}
      >
        {loading ? "Registrando..." : label}
      </span>
    </button>
  );
}

function Totals({ worked, breakMin }: { worked: number; breakMin: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
      }}
    >
      <Stat label="Trabalhado" value={formatMinutesAsHours(worked)} />
      <Stat label="Intervalo" value={formatMinutesAsHours(breakMin)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -0.5,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Timeline({ punches }: { punches: TimeClockPunch[] }) {
  const sorted = [...punches].sort(
    (a, b) =>
      new Date(b.timestamp_punch).getTime() - new Date(a.timestamp_punch).getTime(),
  );
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          fontWeight: 700,
          color: "var(--text-3)",
          textTransform: "uppercase",
        }}
      >
        Pontos de hoje
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>
          Nenhum ponto registrado.
        </div>
      ) : (
        sorted.map((p) => {
          const tipo = p.tipo as PunchTipo;
          const Icon = ICONS[tipo] ?? Clock;
          const c = PUNCH_COLOR[tipo] ?? "var(--text-3)";
          const status =
            p.aprovado === true ? "Aprovado" : p.aprovado === false ? "Rejeitado" : "Pendente";
          const statusColor =
            p.aprovado === true
              ? "#22C55E"
              : p.aprovado === false
                ? "var(--destructive)"
                : "var(--text-3)";
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  background: `color-mix(in srgb, ${c} 18%, transparent)`,
                  color: c,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {PUNCH_LABEL[tipo] ?? tipo}
                </div>
                <div style={{ fontSize: 10, color: statusColor, fontWeight: 600 }}>
                  {status}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: "var(--text)",
                  letterSpacing: -0.2,
                }}
              >
                {formatHHMM(p.timestamp_punch)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SuccessBanner({ punch }: { punch: TimeClockPunch }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(34,197,94,0.16)",
        border: "1px solid rgba(34,197,94,0.4)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#22C55E",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <CheckCircle2 size={18} />
      <span>
        {PUNCH_LABEL[punch.tipo as PunchTipo] ?? punch.tipo} registrado às{" "}
        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatHHMM(punch.timestamp_punch)}
        </strong>
      </span>
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const isAuth = message.toLowerCase().includes("sessão");
  const handleClick = () => {
    if (isAuth && typeof window !== "undefined") {
      window.location.reload();
    } else {
      onClose();
    }
  };
  return (
    <div
      onClick={handleClick}
      style={{
        padding: "12px 14px",
        background: "rgba(239,68,68,0.12)",
        border: "1px solid rgba(239,68,68,0.4)",
        borderRadius: 10,
        color: "var(--destructive)",
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      <strong>Erro:</strong> {message}
      <span style={{ float: "right", opacity: 0.6 }}>{isAuth ? "↻" : "×"}</span>
    </div>
  );
}

function SignOutFooter() {
  return (
    <Link
      href="/auth/sign-out"
      style={{
        textAlign: "center",
        padding: "10px 12px",
        fontSize: 11,
        color: "var(--text-3)",
        textDecoration: "none",
      }}
    >
      Sair
    </Link>
  );
}

/**
 * Painel de diagnóstico — só renderiza com ?debug=1 na URL.
 * Mostra o ciclo completo: tokens vindos do server → setSession →
 * getUser → insert. Inclui server-side debug via /api/ponto/debug.
 * Estilo dourado mono pra ficar fácil de ler em print de mobile.
 */
function DebugPanel({
  log,
  context,
}: {
  log: DebugLine[];
  context: Record<string, unknown>;
}) {
  const [serverDebug, setServerDebug] = useState<unknown>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchServer = async () => {
    setLoading(true);
    setServerErr(null);
    try {
      const r = await fetch("/api/ponto/debug", { credentials: "include" });
      const j = await r.json();
      setServerDebug({ status: r.status, body: j });
    } catch (e) {
      setServerErr(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 18,
        padding: "14px 16px",
        background: "var(--surface-2)",
        border: "1px solid var(--brand)",
        borderRadius: 12,
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 10,
        color: "var(--brand)",
        lineHeight: 1.45,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.4, marginBottom: 8 }}>
        ⚙ DEBUG · ?debug=1
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ opacity: 0.7 }}>context:</div>
        <pre style={{ margin: "2px 0 0", fontSize: 10 }}>
          {JSON.stringify(context, null, 2)}
        </pre>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ opacity: 0.7 }}>client log ({log.length}):</div>
        {log.length === 0 ? (
          <div style={{ opacity: 0.5 }}>(empty — toca o botão pra registrar punch)</div>
        ) : (
          log.map((l, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <span style={{ opacity: 0.5 }}>{l.ts}</span>{" "}
              <span style={{ color: "#FFD180" }}>{l.tag}</span>
              <pre style={{ margin: "2px 0 0", fontSize: 10 }}>
                {typeof l.data === "string"
                  ? l.data
                  : JSON.stringify(l.data, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>

      <button
        onClick={fetchServer}
        disabled={loading}
        style={{
          padding: "6px 10px",
          background: "var(--brand)",
          color: "var(--primary-foreground)",
          border: "none",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "inherit",
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        {loading ? "carregando…" : "GET /api/ponto/debug"}
      </button>

      {serverErr && (
        <div style={{ color: "#FF6B6B" }}>server fetch error: {serverErr}</div>
      )}
      {serverDebug !== null && (
        <div>
          <div style={{ opacity: 0.7 }}>server response:</div>
          <pre style={{ margin: "2px 0 0", fontSize: 10 }}>
            {JSON.stringify(serverDebug, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Banner mostrado APENAS quando o /ponto está rodando como PWA standalone
 * em iOS — situação onde o storage isolado quebra a sessão Supabase.
 * Em Safari normal, retorna null (sem banner). Detectado via media-query
 * standard que iOS implementa: `display-mode: standalone`.
 */
function StandaloneWarning() {
  const [isStandalone, setIsStandalone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(display-mode: standalone)");
    // setState em useEffect é necessário (matchMedia só no client).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  if (!isStandalone) return null;
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(245,158,11,0.16)",
        border: "1px solid rgba(245,158,11,0.4)",
        borderRadius: 10,
        fontSize: 11,
        color: "#A16207",
        lineHeight: 1.5,
      }}
    >
      <strong>Atenção:</strong> remova este atalho do homescreen e abra o
      ponto direto pelo Safari. PWA instalado tem storage isolado que pode
      perder a sessão.
    </div>
  );
}
