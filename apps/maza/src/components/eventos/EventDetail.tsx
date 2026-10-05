import { FileText, Image as ImageIcon } from "lucide-react";

import type { EventListRow } from "@/lib/eventos/types";
import { StatusBadge } from "./StatusBadge";

/**
 * View read-only da O.S. — espelha o formato da seção "VIEW OS" do HOS.
 * Cada bloco renderiza só se tiver dados.
 */
export function EventDetail({ event }: { event: EventListRow }) {
  const data = event.data_inicio
    ? new Date(event.data_inicio).toLocaleDateString("pt-BR")
    : "—";
  const brigada = event.brigada ?? [];
  const menuBar = (event.menu_bar ?? []).filter((r) => r.servico !== "_info");
  const menuBarInfo = event.menu_bar?.find((r) => r.servico === "_info");
  const menuCozinha = (event.menu_cozinha ?? []).filter(
    (r) => r.servico !== "_info",
  );
  const menuCozinhaInfo = event.menu_cozinha?.find(
    (r) => r.servico === "_info",
  );
  const anexos = event.layout_anexos ?? [];

  return (
    <div style={{ maxWidth: 980 }}>
      {/* Header */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: -0.4,
              margin: 0,
            }}
          >
            O.S. &quot;{event.nome}&quot;
          </h1>
          <StatusBadge status={event.status} />
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            marginTop: 12,
          }}
        >
          <Meta label="Marca" value={event.brand_name} />
          <Meta label="Data" value={data} />
          <Meta
            label="Horário"
            value={`${event.hora_inicio ?? "—"} → ${event.hora_termino ?? "—"}`}
          />
          <Meta label="Pax" value={event.num_convidados} />
          <Meta label="Tipo" value={event.tipo} />
        </div>
      </div>

      <Section title="📋 Dados Gerais">
        <Grid>
          <Info label="Tema" value={event.tema} />
          <Info label="Contato" value={event.contato_cliente} />
          <Info label="Pagamento" value={event.situacao_pagamento} />
          <Info label="Comercial" value={event.responsavel_comercial} />
          <Info label="Operacional" value={event.responsavel_operacional} />
          <Info label="Espaços" value={event.espacos} />
        </Grid>
        {event.briefing_cliente && (
          <Block>{event.briefing_cliente}</Block>
        )}
      </Section>

      <Section title="🏛 Infraestrutura">
        <Grid>
          <Info label="Acesso" value={event.acesso_entrada} />
          <Info label="Obs Acesso" value={event.acesso_obs} />
          <Info label="Mobiliário" value={event.mobiliario} />
          <Info label="Obs Mobiliário" value={event.mobiliario_obs} />
          <Info label="Fotografia" value={event.fotografia} />
          <Info label="Valet" value={event.valet} />
          <Info label="Artístico" value={event.artistico} />
          <Info label="Gerador" value={event.gerador} />
          <Info label="Ambulância" value={event.ambulancia} />
          <Info label="Menores" value={event.menores} />
          <Info label="Montagem" value={event.montagem} />
        </Grid>
        {event.montagem_descricao && <Block>{event.montagem_descricao}</Block>}
        {anexos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Label>Anexos do Layout</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {anexos.map((a, i) => {
                const isImg = a.type.startsWith("image/");
                return (
                  <a
                    key={i}
                    href={a.data}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "8px 12px",
                      textDecoration: "none",
                      color: "var(--text)",
                    }}
                  >
                    {isImg ? <ImageIcon size={18} /> : <FileText size={18} />}
                    <div style={{ fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {(a.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {brigada.length > 0 && (
        <Section title="👥 Brigada">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={ROW_TH}>Função</th>
                <th style={{ ...ROW_TH, textAlign: "center" }}>Qtd</th>
              </tr>
            </thead>
            <tbody>
              {brigada.map((b, i) => (
                <tr key={i}>
                  <td style={ROW_TD}>{b.funcao}</td>
                  <td
                    style={{
                      ...ROW_TD,
                      textAlign: "center",
                      fontWeight: 700,
                      color: "var(--brand)",
                    }}
                  >
                    {b.qtd}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  style={{
                    ...ROW_TD,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: "var(--text-3)",
                  }}
                >
                  Total
                </td>
                <td
                  style={{
                    ...ROW_TD,
                    textAlign: "center",
                    fontWeight: 700,
                    color: "var(--brand)",
                    fontSize: 15,
                  }}
                >
                  {brigada.reduce((s, b) => s + (b.qtd || 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {menuBar.length > 0 && (
        <Section title="🍸 Menu Bar">
          <MenuTable rows={menuBar} />
          {menuBarInfo?.descritivo && <Block>{menuBarInfo.descritivo}</Block>}
        </Section>
      )}

      {menuCozinha.length > 0 && (
        <Section title="🍽 Menu Cozinha">
          <MenuTable rows={menuCozinha} />
          {menuCozinhaInfo?.descritivo && (
            <Block>{menuCozinhaInfo.descritivo}</Block>
          )}
        </Section>
      )}

      {event.campo_livre && (
        <Section title="⚠ Alertas Operacionais">
          <div
            style={{
              padding: 12,
              background: "rgba(212,165,116,0.05)",
              border: "1px solid rgba(212,165,116,0.2)",
              borderRadius: 6,
              fontSize: 13,
              whiteSpace: "pre-line",
            }}
          >
            {event.campo_livre}
          </div>
        </Section>
      )}

      {event.tempos_movimentos && (
        <Section title="⏱ Tempos e Movimentos">
          <Block>{event.tempos_movimentos}</Block>
        </Section>
      )}
    </div>
  );
}

// ── Helpers de UI ───────────────────────────────────────────

function Section({
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
        borderRadius: 8,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 20px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ fontSize: 13, marginTop: 3, whiteSpace: "pre-line" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "var(--text-3)",
        display: "block",
      }}
    >
      {children}
    </span>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div style={{ fontSize: 13, color: "var(--text-3)" }}>
      {label}:{" "}
      <strong style={{ color: "var(--text)" }}>{value ?? "—"}</strong>
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: "var(--surface-2)",
        borderRadius: 6,
        fontSize: 13,
        color: "var(--text-2)",
        whiteSpace: "pre-line",
      }}
    >
      {children}
    </div>
  );
}

function MenuTable({ rows }: { rows: { servico: string; hr_ini: string | null; hr_fim: string | null; descritivo: string; obs: string }[] }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
      }}
    >
      <thead>
        <tr>
          {["Serviço", "Hr Início", "Hr Fim", "Descritivo", "Obs"].map((h) => (
            <th key={h} style={ROW_TH}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td style={{ ...ROW_TD, fontWeight: 600 }}>{r.servico || ""}</td>
            <td style={ROW_TD}>{r.hr_ini || ""}</td>
            <td style={ROW_TD}>{r.hr_fim || ""}</td>
            <td style={{ ...ROW_TD, whiteSpace: "pre-line" }}>{r.descritivo || ""}</td>
            <td style={{ ...ROW_TD, color: "var(--text-3)", whiteSpace: "pre-line" }}>
              {r.obs || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const ROW_TH: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "var(--text-3)",
  borderBottom: "1px solid var(--border)",
};

const ROW_TD: React.CSSProperties = {
  padding: "7px 8px",
  borderBottom: "1px solid var(--border)",
};
