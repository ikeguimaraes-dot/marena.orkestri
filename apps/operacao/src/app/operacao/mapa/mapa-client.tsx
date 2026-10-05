"use client";
import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kph/ui/select";
import { Button } from "@kph/ui/button";
import { Input } from "@kph/ui/input";
import type { TableWithReserva, RestaurantTable } from "./actions";
import { updateTableStatus, createRestaurantTable } from "./actions";

const AREAS: RestaurantTable["area"][] = ["salao", "varanda", "bar", "vip", "externa"];
const AREA_LABEL: Record<RestaurantTable["area"], string> = {
  salao: "Salão", varanda: "Varanda", bar: "Bar", vip: "VIP", externa: "Externa",
};
const STATUS_STYLE: Record<RestaurantTable["status"], { bg: string; border: string; fg: string; label: string }> = {
  livre:     { bg: "rgba(21,128,61,0.10)",   border: "rgba(21,128,61,0.35)",   fg: "#15803D", label: "Livre" },
  ocupada:   { bg: "rgba(185,28,28,0.10)",   border: "rgba(185,28,28,0.35)",   fg: "#B91C1C", label: "Ocupada" },
  reservada: { bg: "rgba(161,98,7,0.10)",    border: "rgba(161,98,7,0.35)",    fg: "#A16207", label: "Reservada" },
  bloqueada: { bg: "rgba(100,100,100,0.10)", border: "rgba(100,100,100,0.35)", fg: "var(--text-3)", label: "Bloqueada" },
};

export function MapaClient({
  unitId,
  unitName,
  tables,
}: {
  unitId: string;
  unitName: string;
  tables: TableWithReserva[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [areaFilter, setAreaFilter] = useState<RestaurantTable["area"] | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [formNumero, setFormNumero] = useState("");
  const [formCapacidade, setFormCapacidade] = useState("4");
  const [formArea, setFormArea] = useState<RestaurantTable["area"]>("salao");

  const filtered = areaFilter === "all" ? tables : tables.filter((t) => t.area === areaFilter);

  const counts = {
    livre: tables.filter((t) => t.status === "livre").length,
    ocupada: tables.filter((t) => t.status === "ocupada").length,
    reservada: tables.filter((t) => t.status === "reservada").length,
    bloqueada: tables.filter((t) => t.status === "bloqueada").length,
  };

  function handleStatusChange(id: string, status: RestaurantTable["status"]) {
    startTransition(async () => {
      await updateTableStatus(id, status);
      router.refresh();
    });
  }

  function handleCreateTable() {
    if (!formNumero.trim()) return;
    startTransition(async () => {
      const r = await createRestaurantTable({
        unit_id: unitId,
        numero: formNumero.trim(),
        capacidade: Number(formCapacidade) || 4,
        area: formArea,
      });
      if (!r.ok) { alert(`Erro: ${r.error}`); return; }
      setFormNumero("");
      setFormCapacidade("4");
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <Select value={areaFilter} onValueChange={(v) => setAreaFilter((v ?? "all") as typeof areaFilter)}>
          <SelectTrigger style={{ width: 160 }}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>)}
          </SelectContent>
        </Select>
        <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-3)", flexWrap: "wrap" }}>
          {(Object.entries(counts) as [RestaurantTable["status"], number][]).map(([s, n]) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: STATUS_STYLE[s].fg, display: "inline-block" }} />
              {STATUS_STYLE[s].label}: <strong style={{ color: "var(--text)" }}>{n}</strong>
            </span>
          ))}
        </div>
        <Button size="sm" variant="outline" style={{ marginLeft: "auto" }} onClick={() => setShowForm(!showForm)}>
          + Mesa
        </Button>
      </div>

      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Número</div>
            <Input value={formNumero} onChange={(e) => setFormNumero(e.target.value)} placeholder="ex: 1, A3" style={{ width: 100 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Capacidade</div>
            <Input type="number" value={formCapacidade} onChange={(e) => setFormCapacidade(e.target.value)} style={{ width: 90 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Área</div>
            <Select value={formArea} onValueChange={(v) => setFormArea((v ?? "salao") as RestaurantTable["area"])}>
              <SelectTrigger style={{ width: 140 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => <SelectItem key={a} value={a}>{AREA_LABEL[a]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleCreateTable} disabled={pending || !formNumero.trim()}>Adicionar</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-3)", fontSize: 13, background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8 }}>
          {tables.length === 0 ? 'Nenhuma mesa cadastrada. Clique em "+ Mesa" para começar.' : "Nenhuma mesa nesta área."}
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {filtered.map((t) => {
            const st = STATUS_STYLE[t.status];
            return (
              <div
                key={t.id}
                style={{
                  background: st.bg,
                  border: `1.5px solid ${st.border}`,
                  borderRadius: 10,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 120,
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{t.numero}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-3)" }}>
                  <Users size={12} /> {t.capacidade} pessoas
                </div>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>{AREA_LABEL[t.area]}</div>
                {t.reserva_nome && (
                  <div style={{ fontSize: 11, color: "#A16207", fontWeight: 600 }}>
                    {t.reserva_nome}{t.reserva_horario ? ` · ${t.reserva_horario}` : ""}
                  </div>
                )}
                <div style={{ marginTop: "auto" }}>
                  <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, (v ?? t.status) as RestaurantTable["status"])}>
                    <SelectTrigger style={{ width: "100%", fontSize: 11, height: 28, color: st.fg, borderColor: st.border }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="livre">Livre</SelectItem>
                      <SelectItem value="ocupada">Ocupada</SelectItem>
                      <SelectItem value="reservada">Reservada</SelectItem>
                      <SelectItem value="bloqueada">Bloqueada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
