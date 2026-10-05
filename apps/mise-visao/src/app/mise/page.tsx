import { KpiCard } from "@/components/mise/KpiCard";
import { LabelsTable } from "@/components/mise/LabelsTable";
import { PrinterRanking } from "@/components/mise/PrinterRanking";
import { ChecklistsTable } from "@/components/mise/ChecklistsTable";
import { UnitSelector } from "@/components/mise/UnitSelector";
import { getRecentChecklists } from "@/lib/mise/checklists";
import { hoursFromNowIso, nowIso } from "@/lib/mise/dates";
import { getExpiredActiveCount, getExpiringSoon24hCount, getPrintedThisMonth, getUpcomingLabels } from "@/lib/mise/labels";
import { getActivePrintPointsCount } from "@/lib/mise/printPoints";
import { getPrinterRanking } from "@/lib/mise/ranking";
import { getUnits, resolveUnitFilter } from "@/lib/mise/units";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ unidade?: string }>;

export default async function MisePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const units = await getUnits();
  const { unitIds, selected } = resolveUnitFilter(sp.unidade, units);
  const now = nowIso();
  const in24h = hoursFromNowIso(24);

  const [expiringSoon, expiredActive, printedMonth, printersActive, upcoming, ranking, checklists] = await Promise.all([
    getExpiringSoon24hCount(unitIds, now, in24h),
    getExpiredActiveCount(unitIds, now),
    getPrintedThisMonth(unitIds),
    getActivePrintPointsCount(unitIds),
    getUpcomingLabels(unitIds, 50),
    getPrinterRanking(unitIds),
    getRecentChecklists(unitIds, 10),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>MISE — Visão Geral</h1>
          <p style={{ marginTop: 4, color: "var(--text-2)", fontSize: 13 }}>Etiquetas de validade e checklists.</p>
        </div>
        <UnitSelector units={units} selected={selected} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <KpiCard label="A vencer em 24h" value={expiringSoon} />
        <KpiCard label="Vencidas não consumidas" value={expiredActive} danger />
        <KpiCard
          label="Impressas no mês"
          value={printedMonth.currentCount}
          hint={
            printedMonth.currentCount > 0
              ? `${printedMonth.delta >= 0 ? "+" : ""}${printedMonth.delta} vs mês anterior`
              : undefined
          }
        />
        <KpiCard label="Impressoras ativas" value={printersActive} emptyAsDash={false} />
      </div>

      <LabelsTable rows={upcoming.rows} total={upcoming.total} />
      <PrinterRanking rows={ranking} />
      <ChecklistsTable rows={checklists} units={units} />
    </div>
  );
}
