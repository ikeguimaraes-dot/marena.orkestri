"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Search, UserPlus } from "lucide-react";

import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@maza/ui/table";
import { formatDateBR } from "@/lib/format";
import {
  ORIGEM_COLOR,
  ORIGEM_LABEL,
  type ClientOrigem,
  type ClientWithBrand,
} from "@/lib/cliente/types";

const ORIGEM_VALUES: ClientOrigem[] = [
  "indicacao",
  "site",
  "instagram",
  "whatsapp",
  "evento",
  "outro",
];

export function ClienteClient({
  clients,
}: {
  clients: ClientWithBrand[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">(
    "ativos",
  );
  const [origemFilter, setOrigemFilter] = useState<string>("__all__");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (statusFilter === "ativos" && !c.ativo) return false;
      if (statusFilter === "inativos" && c.ativo) return false;
      if (origemFilter !== "__all__" && c.origem !== origemFilter) return false;
      if (q) {
        const hay = `${c.nome} ${c.email ?? ""} ${c.telefone ?? ""} ${c.empresa ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [clients, search, statusFilter, origemFilter]);

  // Card de resumo
  const resumo = useMemo(() => {
    const ativos = clients.filter((c) => c.ativo);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const novosMes = clients.filter(
      (c) => new Date(c.created_at) >= monthStart,
    ).length;
    return {
      total: clients.length,
      ativos: ativos.length,
      novos_mes: novosMes,
    };
  }, [clients]);

  return (
    <>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          marginBottom: 18,
        }}
      >
        <KpiCard label="Total cadastrados" value={String(resumo.total)} />
        <KpiCard label="Ativos" value={String(resumo.ativos)} tone="ok" />
        <KpiCard
          label="Novos no mês"
          value={String(resumo.novos_mes)}
          tone={resumo.novos_mes > 0 ? "ok" : "neutral"}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", minWidth: 240, flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-3)",
              pointerEvents: "none",
            }}
          />
          <Input
            placeholder="Buscar nome, email, telefone, empresa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>

        <Select
          value={origemFilter}
          onValueChange={(v) => setOrigemFilter(v ?? "__all__")}
        >
          <SelectTrigger style={{ minWidth: 160 }}>
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas origens</SelectItem>
            {ORIGEM_VALUES.map((o) => (
              <SelectItem key={o} value={o}>
                {ORIGEM_LABEL[o]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger style={{ minWidth: 130 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {clients.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            color: "var(--text-3)",
            fontSize: 13,
          }}
        >
          Nenhum cliente com esses filtros.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead style={{ textAlign: "center" }}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const origemMeta = c.origem ? ORIGEM_COLOR[c.origem] : null;
                return (
                  <TableRow
                    key={c.id}
                    onClick={() => router.push(`/cliente/${c.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {c.nome}
                    </TableCell>
                    <TableCell style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {c.empresa ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div style={{ fontSize: 12, color: "var(--text-2)" }}>
                        {c.email ?? "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {c.telefone ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.origem && origemMeta ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: origemMeta.bg,
                            color: origemMeta.fg,
                          }}
                        >
                          {ORIGEM_LABEL[c.origem]}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-3)" }}>—</span>
                      )}
                    </TableCell>
                    <TableCell
                      style={{
                        fontSize: 12,
                        color: "var(--text-2)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatDateBR(c.created_at.slice(0, 10))}
                    </TableCell>
                    <TableCell style={{ textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: c.ativo
                            ? "rgba(34,197,94,0.12)"
                            : "var(--surface-2)",
                          color: c.ativo ? "#22C55E" : "var(--text-3)",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            background: c.ativo ? "#22C55E" : "var(--text-3)",
                          }}
                        />
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: "56px 20px",
        textAlign: "center",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 99,
          background: "var(--brand-soft)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 8px",
        }}
      >
        <UserPlus size={20} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Nenhum cliente cadastrado
      </div>
      <p style={{ fontSize: 12, color: "var(--text-3)", margin: "6px 0 14px" }}>
        Cadastre o primeiro cliente pra começar a registrar interações.
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "neutral";
}) {
  const fg = tone === "ok" ? "#15803D" : "var(--text)";
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
          fontWeight: 600,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MessageSquare size={11} />
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: fg,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
