import { Cake } from "lucide-react";
import type { AniversarianteRow } from "@/app/(dashboard)/dashboard/actions";
import { avatarColor, initials } from "@/lib/format";

function hoje(): number {
  return new Date().getDate();
}

export function AniversariantesCard({
  aniversariantes,
}: {
  aniversariantes: AniversarianteRow[];
}) {
  const diaHoje = hoje();
  const hojeLista = aniversariantes.filter((a) => a.dia === diaHoje);
  const restantesLista = aniversariantes.filter((a) => a.dia !== diaHoje);

  if (aniversariantes.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
        }}
      >
        <SectionHeader />
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: 0 }}>
          Nenhum aniversário este mês.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
        <SectionHeader count={aniversariantes.length} />
      </div>

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
        {hojeLista.map((a) => (
          <AnivRow key={a.id} a={a} isToday />
        ))}
        {restantesLista.slice(0, 8).map((a) => (
          <AnivRow key={a.id} a={a} isToday={false} />
        ))}
        {restantesLista.length > 8 && (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              textAlign: "center",
              paddingTop: 6,
            }}
          >
            +{restantesLista.length - 8} mais neste mês
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ count }: { count?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 700,
        color: "var(--text)",
        textTransform: "uppercase",
        letterSpacing: 0.8,
      }}
    >
      <Cake size={14} style={{ color: "var(--brand)" }} />
      Aniversários do mês
      {count != null && count > 0 && (
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            fontWeight: 700,
            padding: "1px 8px",
            borderRadius: 99,
            background: "var(--brand-soft)",
            color: "var(--brand)",
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function AnivRow({
  a,
  isToday,
}: {
  a: AniversarianteRow;
  isToday: boolean;
}) {
  const nome = `${a.nome} ${a.sobrenome}`.trim();
  const color = avatarColor(nome);
  const meses = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const mesNome = meses[new Date(a.data_nascimento + "T00:00:00").getMonth()] ?? "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 8px",
        borderRadius: 8,
        background: isToday ? "rgba(99,102,241,0.07)" : "transparent",
        border: isToday ? "1px solid rgba(99,102,241,0.18)" : "1px solid transparent",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 99,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
          color,
          fontSize: 10,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {initials(nome)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isToday ? "var(--brand)" : "var(--text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nome}
          {isToday && (
            <span style={{ marginLeft: 6, fontSize: 11 }}>🎂</span>
          )}
        </div>
        {a.funcao && (
          <div style={{ fontSize: 10, color: "var(--text-3)" }}>{a.funcao}</div>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: isToday ? "var(--brand)" : "var(--text-3)",
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {a.dia} {mesNome}
      </div>
    </div>
  );
}
