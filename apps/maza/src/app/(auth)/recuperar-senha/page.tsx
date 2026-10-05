import type { Metadata } from "next";
import Link from "next/link";
import { RecoveryForm } from "./RecoveryForm";

export const metadata: Metadata = {
  title: "Recuperar senha · Marena",
  description: "Receba um link para redefinir sua senha.",
};

/**
 * /recuperar-senha — form que dispara e-mail de reset.
 *
 * Não checa sessão (rota pública no middleware). Se o user já está
 * logado, é caso raro — renderiza normalmente.
 *
 * Layout: mesmo padrão visual do /login (card centralizado, Brasa, Fraunces).
 */
export default function RecoverPasswordPage() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg, #111110)" }}
    >
      <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
        {/* ── Brand ── */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden
            className="size-12 rounded-xl flex items-center justify-center font-heading text-2xl"
            style={{
              background: "var(--brand, #C4622D)",
              color: "var(--primary-foreground)",
              fontWeight: 600,
            }}
          >
            K
          </div>
          <div className="flex flex-col gap-1">
            <h1
              className="font-heading text-2xl tracking-tight"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                color: "var(--text, #F5F0E8)",
              }}
            >
              Recuperar senha
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              Enviaremos um link para o seu e-mail
            </p>
          </div>
        </div>

        {/* ── Card ── */}
        <div
          className="w-full rounded-xl p-6 flex flex-col gap-5"
          style={{
            background: "var(--surface, #1A1A18)",
            border: "1px solid var(--border-soft, rgba(245,240,232,0.08))",
          }}
        >
          <div className="flex flex-col gap-1">
            <h2
              className="font-heading text-lg"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                color: "var(--text, #F5F0E8)",
              }}
            >
              Esqueceu sua senha?
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              Informe o e-mail cadastrado. Se existir na nossa base, você
              receberá um link para criar uma nova senha.
            </p>
          </div>

          <RecoveryForm />

          {/* ── Voltar pro login ── */}
          <div className="text-center">
            <Link
              href="/login"
              className="text-xs transition-colors"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              ← Voltar para o login
            </Link>
          </div>
        </div>

        {/* ── Footer ── */}
        <p
          className="text-[11px] text-center"
          style={{ color: "var(--text-3, #A09890)" }}
        >
          Acesso restrito a colaboradores autorizados.
          <br />
          © {new Date().getFullYear()} Marena
        </p>
      </div>
    </main>
  );
}
