"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@maza/ui/button";
import { updateCandidateStatus } from "@/app/(dashboard)/recrutamento/actions";
import { avatarColor, formatDateBR, initials } from "@/lib/format";
import type {
  CandidateReviewBundle,
  CandidateStatus,
} from "@/lib/recrutamento/types";

const STATUS_COLOR: Record<
  CandidateStatus,
  { bg: string; fg: string; label: string }
> = {
  pendente: { bg: "rgba(245,158,11,0.16)", fg: "#A16207", label: "Pendente" },
  aprovado: { bg: "rgba(34,197,94,0.16)", fg: "#15803D", label: "Aprovado" },
  reprovado: { bg: "rgba(239,68,68,0.16)", fg: "#B91C1C", label: "Reprovado" },
};

export function CandidatoClient({
  bundle,
}: {
  bundle: CandidateReviewBundle;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const c = bundle.candidate;
  const color = avatarColor(c.full_name);
  const status = STATUS_COLOR[c.status];

  const handleStatusChange = (newStatus: CandidateStatus) => {
    setError(null);
    startTransition(async () => {
      const r = await updateCandidateStatus(c.id, newStatus);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      {/* Header card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
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
            flexShrink: 0,
          }}
        >
          {initials(c.full_name)}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.4,
              color: "var(--text)",
            }}
          >
            {c.full_name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              marginTop: 4,
            }}
          >
            {bundle.brand_name && (
              <span style={{ marginRight: 12 }}>
                Marca: <strong>{bundle.brand_name}</strong>
              </span>
            )}
            {bundle.job_title && (
              <span>
                Vaga: <strong>{bundle.job_title}</strong>
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              marginTop: 8,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              color: "var(--text-3)",
            }}
          >
            {c.email && <span>{c.email}</span>}
            {c.phone && <span>{c.phone}</span>}
            <span>Inscrito em {formatDateBR(c.created_at)}</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <CopyableCode code={c.access_code} />
          <span
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 999,
              background: status.bg,
              color: status.fg,
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Decisão */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 18px",
          marginBottom: 22,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          Decisão do RH:
        </span>
        <Button
          variant={c.status === "aprovado" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleStatusChange("aprovado")}
          disabled={pending}
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ThumbsUp size={14} className="mr-1" />
          )}
          Aprovar
        </Button>
        <Button
          variant={c.status === "reprovado" ? "default" : "ghost"}
          size="sm"
          onClick={() => handleStatusChange("reprovado")}
          disabled={pending}
        >
          <ThumbsDown size={14} className="mr-1" />
          Reprovar
        </Button>
        {c.status !== "pendente" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusChange("pendente")}
            disabled={pending}
          >
            Voltar pra pendente
          </Button>
        )}
        {error && (
          <span
            style={{
              fontSize: 12,
              color: "var(--destructive)",
              marginLeft: "auto",
            }}
          >
            {error}
          </span>
        )}
      </div>

      {/* Perguntas + respostas lado a lado */}
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
          margin: "0 0 14px",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Entrevista — {bundle.questions.length} pergunta
        {bundle.questions.length === 1 ? "" : "s"}
      </h2>

      {bundle.questions.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "var(--text-3)",
            fontSize: 13,
            background: "var(--surface)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          Esta vaga não tem perguntas cadastradas.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bundle.questions.map((q) => (
            <QuestionResponseRow key={q.id} q={q} />
          ))}
        </div>
      )}
    </>
  );
}

function QuestionResponseRow({
  q,
}: {
  q: CandidateReviewBundle["questions"][number];
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            background: "var(--brand-soft)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {q.order_num}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            flex: 1,
            minWidth: 0,
          }}
        >
          {q.question_text}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
        }}
      >
        <VideoCard
          label="Vídeo do RH (pergunta)"
          url={q.question_video_signed_url}
          empty="Sem vídeo da pergunta"
        />
        <VideoCard
          label="Resposta do candidato"
          url={q.response?.response_video_signed_url ?? null}
          empty="Candidato ainda não respondeu"
        />
      </div>
    </div>
  );
}

function VideoCard({
  label,
  url,
  empty,
}: {
  label: string;
  url: string | null;
  empty: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-3)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {url ? (
        <video
          controls
          src={url}
          style={{
            width: "100%",
            borderRadius: 8,
            background: "#000",
            aspectRatio: "16 / 9",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 9",
            background: "var(--surface-2)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
            fontSize: 12,
          }}
        >
          {empty}
        </div>
      )}
    </div>
  );
}

function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };
  return (
    <button
      onClick={handle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 6,
        background: "var(--brand-soft)",
        border: "1px solid color-mix(in srgb, var(--brand) 30%, transparent)",
        color: "var(--brand)",
        fontFamily: "var(--font-geist-mono, monospace)",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
      title="Copiar"
    >
      {code}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
