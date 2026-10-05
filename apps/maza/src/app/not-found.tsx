import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #111110)",
        fontFamily: "var(--font-ui, ui-sans-serif, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "40px 32px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display, Georgia, serif)",
            fontSize: "4.5rem",
            fontWeight: 700,
            color: "var(--border-soft, rgba(245,240,232,0.08))",
            lineHeight: 1,
            marginBottom: 24,
            letterSpacing: -2,
            userSelect: "none",
          }}
        >
          404
        </div>
        <div
          style={{
            fontSize: "0.625rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 10,
          }}
        >
          Marena
        </div>
        <h1
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "var(--text)",
            margin: "0 0 8px",
            letterSpacing: -0.3,
          }}
        >
          Página não encontrada
        </h1>
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-3)",
            margin: "0 0 28px",
            lineHeight: 1.6,
          }}
        >
          O endereço que você tentou acessar não existe ou foi movido.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 18px",
            background: "var(--surface)",
            border: "1px solid var(--border-soft)",
            borderRadius: 8,
            color: "var(--text-2)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
