import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { getCurrentUser } from "@maza/auth/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Entrar · Marena",
  description: "Sistema operacional Marena.",
};

/**
 * /login — entrada do app.
 *
 * Server Component: se já houver sessão válida, redireciona pro destino
 * imediatamente (evita mostrar form pra quem já está logado).
 *
 * Layout:
 *   - Card centralizado (max-w 400px)
 *   - Fundo: bg-background (#111110)
 *   - Logo MARENA + headline Fraunces (font-display)
 *   - Form com Client Component (precisa de useState para mostrar senha)
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; redirect?: string; error?: string; message?: string }>;
}) {
  // ── Se já tem sessão, pula direto pro destino ──
  const user = await getCurrentUser();
  if (user) {
    const params = await searchParams;
    const next = getSafeNext(params.next ?? params.redirect);
    redirect(next);
  }

  const params = await searchParams;
  const initialError = params.error;

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
            M
          </div>
          <div className="flex flex-col gap-1">
            <h1
              className="font-heading text-2xl tracking-tight"
              style={{
                fontFamily: "var(--font-display, Georgia, serif)",
                color: "var(--text, #F5F0E8)",
              }}
            >
              Marena
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              Sistema operacional Marena
            </p>
          </div>
        </div>

        {/* ── Card do form ── */}
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
              Entrar
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              Use seu e-mail corporativo e senha.
            </p>
          </div>

          <LoginForm
            next={getSafeNext(params.next ?? params.redirect)}
            initialError={mapInitialError(initialError)}
          />

          {params.message === "password_updated" && (
            <div
              role="status"
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                color: "var(--color-success, #4ADE80)",
                border: "1px solid var(--color-success, #4ADE80)",
                background: "var(--color-success-bg, rgba(74,222,128,0.08))",
              }}
            >
              Senha atualizada. Entre novamente com a nova senha.
            </div>
          )}

          {/* ── Link para recuperar senha ── */}
          <div className="text-center">
            <Link
              href="/recuperar-senha"
              className="text-xs transition-colors"
              style={{ color: "var(--text-3, #A09890)" }}
            >
              Esqueceu sua senha?
            </Link>
          </div>
        </div>

        {/* ── Footer institucional ── */}
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

/**
 * Mapeia erros vindos da URL (?error=...) para mensagens amigáveis.
 * Origens possíveis: middleware redirect, /auth/callback, query string manual.
 */
function mapInitialError(code?: string): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    missing_code: "Link inválido ou expirado. Solicite um novo.",
    supabase_unavailable: "Serviço de autenticação indisponível.",
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  };
  return map[code] ?? "Não foi possível entrar. Tente novamente.";
}

function getSafeNext(value?: string): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
