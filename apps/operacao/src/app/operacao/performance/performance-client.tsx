// src/app/(dashboard)/operacao/performance/performance-client.tsx
"use client";
import type { ReactNode } from "react";
import { Users, UserX, Clock, ClipboardCheck } from "lucide-react";
import type { PerformanceKpis } from "./actions";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@kph/ui/table";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function scoreBadge(score: number | null) {
  if (score === null) return { bg: "var(--surface)", fg: "var(--text-3)", label: "—" };
  if (score >= 80) return { bg: "rgba(21,128,61,0.12)", fg: "#15803D", label: `${score}%` };
  if (score >= 60) return { bg: "rgba(161,98,7,0.12)", fg: "#A16207", label: `${score}%` };
  return { bg: "rgba(185,28,28,0.12)", fg: "#B91C1C", label: `${score}%` };
}

export function PerformanceClient({
  unitName,
  kpis,
  mes,
  ano,
}: {
  unitName: string;
  kpis: PerformanceKpis;
  mes: number;
  ano: number;
}) {
  const badge = scoreBadge(kpis.checklistScoreMedio);
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 18 }}>
        {unitName} · {MESES[mes - 1]}/{ano}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard icon={<Users size={18} />} label="Headcount ativo" value={kpis.headcountAtivo} />
        <KpiCard
          icon={<UserX size={18} />}
          label="Faltas no período"
          value={`${kpis.faltasMes} (${kpis.absenteismoPct}%)`}
          highlight={kpis.absenteismoPct > 5}
        />
        <KpiCard
          icon={<Clock size={18} />}
          label="Horas extras"
          value={`${kpis.heHorasMes.toFixed(1)}h`}
          sub={kpis.hePendentes > 0 ? `${kpis.hePendentes} pendente${kpis.hePendentes > 1 ? "s" : ""}` : undefined}
          highlight={kpis.hePendentes > 0}
        />
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ClipboardCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>Score de auditorias</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{badge.label}</span>
              {kpis.checklistRegistros > 0 && (
                <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: badge.bg, color: badge.fg, fontWeight: 600, fontSize: 11 }}>
                  {kpis.checklistRegistros} registro{kpis.checklistRegistros > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {kpis.headcountPorFuncao.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Headcount por função</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Colaboradores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.headcountPorFuncao.map((row) => (
                <TableRow key={row.funcao}>
                  <TableCell style={{ fontWeight: 500 }}>{row.funcao}</TableCell>
                  <TableCell className="text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, highlight }: { icon: ReactNode; label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: highlight ? "rgba(245,158,11,0.14)" : "var(--brand-soft)", color: highlight ? "#A16207" : "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: highlight ? "#A16207" : "var(--text-3)", marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}
