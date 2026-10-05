/**
 * EmptyState — estado vazio com voz MARENA.
 * NUNCA usar "Nenhum dado encontrado" — copy obrigatoriamente contextual.
 */
import type { LucideIcon } from "lucide-react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "56px 32px",
        textAlign: "center",
      }}
      className="anim-fade-in"
    >
      {Icon && (
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "var(--r-lg, 10px)",
            background: "var(--surface-2, #222220)",
            border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
            marginBottom: 4,
          }}
        >
          <Icon size={20} strokeWidth={1.5} style={{ color: "var(--text-3, #8A8278)" }} />
        </span>
      )}

      <h3
        style={{
          fontFamily: "var(--font-display, Georgia, serif)",
          fontSize: "1.0625rem",
          fontWeight: 400,
          color: "var(--text, #F5F0E8)",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-3, #8A8278)",
            margin: 0,
            maxWidth: 360,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4,
            background: "transparent",
            border: "1px solid var(--border-hover, rgba(245,240,232,0.16))",
            borderRadius: "var(--r-md, 6px)",
            padding: "8px 16px",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--text-2, #C4BDB4)",
            cursor: "pointer",
            transition: "border-color var(--t, 180ms ease), color var(--t, 180ms ease)",
            fontFamily: "var(--font-ui)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--maza-creme, #F5F0E8)";
            e.currentTarget.style.color = "var(--text, #F5F0E8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-hover, rgba(245,240,232,0.16))";
            e.currentTarget.style.color = "var(--text-2, #C4BDB4)";
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Copy MARENA pré-definida por contexto */
export const EMPTY_COPY = {
  dados:        { title: "Ainda não há dados aqui.",         description: "Os números aparecem quando a operação começa." },
  colaboradores:{ title: "O time começa quando o primeiro colaborador entra.", description: undefined },
  lancamentos:  { title: "Nenhum lançamento ainda.",         description: "O financeiro espera." },
  vagas:        { title: "Todas as posições preenchidas.",   description: "Por enquanto." },
  eventos:      { title: "Sem eventos no radar.",            description: "Cadastre um evento para começar o planejamento." },
  alertas:      { title: "Tudo tranquilo por aqui.",         description: "Nenhum alerta no momento." },
  runs:         { title: "Nenhuma tarefa pendente.",         description: "O orquestrador está em silêncio." },
  resultados:   { title: "Sem resultados para essa busca.",  description: "Tenta ajustar os filtros." },
  erro:         { title: "Algo deu errado.",                 description: "Tenta de novo?" },
} as const;
