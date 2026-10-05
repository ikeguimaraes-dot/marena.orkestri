"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Power,
} from "lucide-react";

import { Button, buttonVariants } from "@maza/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@maza/ui/dialog";
import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import { Textarea } from "@maza/ui/textarea";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  createInteraction,
  toggleClientAtivo,
  type LinkedEvent,
} from "@/app/(dashboard)/cliente/actions";
import {
  INTERACTION_LABEL,
  ORIGEM_COLOR,
  ORIGEM_LABEL,
  type Client,
  type ClientInteraction,
  type ClientInteractionTipo,
} from "@/lib/cliente/types";

const TIPO_VALUES: ClientInteractionTipo[] = [
  "ligacao",
  "email",
  "whatsapp",
  "reuniao",
  "visita",
  "outro",
];

function nowDatetimeLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
}

const STATUS_LABEL: Record<string, { label: string; fg: string; bg: string }> = {
  rascunho: { label: "Rascunho", fg: "var(--text-3)", bg: "var(--surface-2)" },
  pendente_aprovacao: { label: "Pendente", fg: "#A16207", bg: "rgba(245,158,11,0.16)" },
  aprovado: { label: "Aprovado", fg: "#1D4ED8", bg: "rgba(59,130,246,0.16)" },
  em_andamento: { label: "Em andamento", fg: "#7E22CE", bg: "rgba(168,85,247,0.16)" },
  concluido: { label: "Concluído", fg: "#15803D", bg: "rgba(34,197,94,0.16)" },
  cancelado: { label: "Cancelado", fg: "#B91C1C", bg: "rgba(239,68,68,0.10)" },
};

export function ClienteDetalheClient({
  client,
  interactions,
  events,
}: {
  client: Client;
  interactions: ClientInteraction[];
  events: LinkedEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showInter, setShowInter] = useState(false);
  const [tipo, setTipo] = useState<ClientInteractionTipo>("ligacao");
  const [data, setData] = useState<string>(nowDatetimeLocal());
  const [descricao, setDescricao] = useState("");
  const [error, setError] = useState<string | null>(null);

  const origemMeta = client.origem ? ORIGEM_COLOR[client.origem] : null;

  const eventsTotal = events.reduce(
    (a, ev) => a + Number(ev.valor_total ?? 0),
    0,
  );
  const eventsConcluidos = events.filter((e) => e.status === "concluido").length;

  function handleToggle() {
    if (
      !window.confirm(
        client.ativo
          ? `Marcar ${client.nome} como inativo?`
          : `Reativar ${client.nome}?`,
      )
    )
      return;
    startTransition(async () => {
      await toggleClientAtivo(client.id);
      router.refresh();
    });
  }

  function handleSaveInteraction() {
    setError(null);
    startTransition(async () => {
      const r = await createInteraction({
        client_id: client.id,
        tipo,
        descricao: descricao.trim() || null,
        data,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setShowInter(false);
      setTipo("ligacao");
      setDescricao("");
      setData(nowDatetimeLocal());
      router.refresh();
    });
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <Link
        href="/cliente"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Clientes
      </Link>

      {/* Header */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 22,
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: "var(--text)",
                letterSpacing: -0.3,
              }}
            >
              {client.nome}
            </h1>
            {client.origem && origemMeta && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: origemMeta.bg,
                  color: origemMeta.fg,
                }}
              >
                {ORIGEM_LABEL[client.origem]}
              </span>
            )}
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 99,
                background: client.ativo
                  ? "rgba(34,197,94,0.12)"
                  : "var(--surface-2)",
                color: client.ativo ? "#22C55E" : "var(--text-3)",
              }}
            >
              {client.ativo ? "Ativo" : "Inativo"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginTop: 8,
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            {client.empresa && (
              <span>
                <strong style={{ color: "var(--text)" }}>{client.empresa}</strong>
              </span>
            )}
            {client.email && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Mail size={12} />
                {client.email}
              </span>
            )}
            {client.telefone && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Phone size={12} />
                {client.telefone}
              </span>
            )}
            <span style={{ color: "var(--text-3)" }}>
              Cadastrado {formatDateBR(client.created_at.slice(0, 10))}
            </span>
          </div>
          {client.observacoes && (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-2)",
                lineHeight: 1.55,
                marginTop: 14,
                marginBottom: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {client.observacoes}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => setShowInter(true)} disabled={pending}>
            <Plus className="mr-2 h-4 w-4" />
            Nova interação
          </Button>
          <Button variant="outline" onClick={handleToggle} disabled={pending}>
            <Power className="mr-2 h-4 w-4" />
            {client.ativo ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 16,
        }}
      >
        <Kpi
          label="Interações"
          value={String(interactions.length)}
          icon={<MessageSquare size={12} />}
        />
        <Kpi
          label="Eventos"
          value={String(events.length)}
          icon={<CalendarDays size={12} />}
          hint={`${eventsConcluidos} concluído${eventsConcluidos === 1 ? "" : "s"}`}
        />
        <Kpi
          label="Volume eventos"
          value={formatBRL(eventsTotal)}
          hint="soma valor_total"
        />
        <Kpi
          label="Última interação"
          value={
            interactions[0]?.data
              ? formatDateBR(interactions[0].data.slice(0, 10))
              : "—"
          }
        />
      </div>

      {/* Interações */}
      <Card title={`Histórico de interações (${interactions.length})`}>
        {interactions.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Nenhuma interação registrada ainda.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {interactions.map((it) => (
              <li
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 110px 1fr",
                  gap: 12,
                  padding: "10px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatDateTimeBR(it.data)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-2)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                  }}
                >
                  {INTERACTION_LABEL[it.tipo]}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {it.descricao || (
                    <em style={{ color: "var(--text-3)" }}>sem descrição</em>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Eventos vinculados */}
      <Card title={`Eventos vinculados (${events.length})`}>
        {events.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
            Nenhum evento encontrado pra este cliente. Match heurístico por
            email, telefone ou empresa.
          </p>
        ) : (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {events.map((ev) => {
              const meta = STATUS_LABEL[ev.status] ?? STATUS_LABEL.rascunho!;
              return (
                <li key={ev.id}>
                  <Link
                    href={`/eventos/${ev.id}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: 12,
                      padding: "10px 12px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      textDecoration: "none",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {ev.nome}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDateBR(ev.data_inicio.slice(0, 10))}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: meta.bg,
                        color: meta.fg,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                        fontVariantNumeric: "tabular-nums",
                        textAlign: "right",
                        minWidth: 90,
                      }}
                    >
                      {ev.valor_total != null ? formatBRL(ev.valor_total) : "—"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Dialog: nova interação */}
      <Dialog open={showInter} onOpenChange={setShowInter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova interação</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Tipo">
              <Select
                value={tipo}
                onValueChange={(v) => v && setTipo(v as ClientInteractionTipo)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VALUES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INTERACTION_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data e hora">
              <Input
                type="datetime-local"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </Field>
            <Field label="Descrição">
              <Textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                placeholder="Resumo da conversa, próximos passos…"
              />
            </Field>
            {error && (
              <div
                style={{
                  padding: "8px 10px",
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.30)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#B91C1C",
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setShowInter(false)}
                className={buttonVariants({ variant: "outline" })}
              >
                Cancelar
              </button>
              <Button onClick={handleSaveInteraction} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontSize: 13,
          fontWeight: 700,
          margin: "0 0 14px",
          color: "var(--text)",
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-3)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--text)",
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}
