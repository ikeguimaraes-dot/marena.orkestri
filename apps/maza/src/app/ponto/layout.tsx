// Layout do /ponto — minimalista, mobile-first, fora do (dashboard).
// Sem sidebar nem topbar. Pensado pro colaborador no celular.

export const dynamic = "force-dynamic";

export default function PontoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "16px 14px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
    </main>
  );
}
