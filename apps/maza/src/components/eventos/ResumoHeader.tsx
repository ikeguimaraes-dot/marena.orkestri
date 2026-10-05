"use client";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Mini-resumo sticky no topo do form — atualiza ao vivo conforme o user
 * preenche nome/data/horário/pax/espaço. Equivalente ao #os-resumo do HOS.
 */
export function ResumoHeader({
  nome,
  espacos,
  data,
  hora_inicio,
  hora_termino,
  num_convidados,
}: {
  nome: string;
  espacos: string;
  data: string;
  hora_inicio: string;
  hora_termino: string;
  num_convidados: number | null;
}) {
  let dataFmt = "—";
  let diaFmt = "—";
  if (data && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const d = new Date(`${data}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      dataFmt = d.toLocaleDateString("pt-BR");
      diaFmt = DIAS[d.getDay()] ?? "—";
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "16px 20px",
        marginBottom: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        alignItems: "center",
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "var(--brand)",
            letterSpacing: -0.4,
          }}
        >
          {nome || "—"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
          {(espacos.split("\n")[0] ?? "").trim() || "Espaço não definido"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <ResumoStat label="Data" value={dataFmt} />
        <ResumoStat label="Dia" value={diaFmt} />
        <ResumoStat
          label="Horário"
          value={`${hora_inicio || "—"} → ${hora_termino || "—"}`}
        />
        <ResumoStat
          label="Convidados"
          value={num_convidados ? `${num_convidados} pax` : "—"}
          gold
        />
      </div>
    </div>
  );
}

function ResumoStat({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "var(--text-3)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginTop: 2,
          color: gold ? "var(--brand)" : "var(--text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
