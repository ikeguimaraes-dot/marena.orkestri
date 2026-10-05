import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@maza/db/supabase/proxy";

/**
 * Middleware global — única porta de entrada para o app autenticado.
 *
 * Em Next.js App Router, APENAS o middleware pode escrever cookies na
 * response (Server Components falham silenciosamente). Por isso este
 * arquivo é o ÚNICO lugar que pode chamar `updateSession()` para renovar
 * o access token antes que `requireUser()` leia a sessão no server render.
 *
 * Sem este arquivo, getUser() retorna null assim que o access token (1h)
 * expira e o app entra em loop de redirect para /login — exatamente o
 * bug que motivou o bypass em 2026-04-30 (commit 0976701).
 *
 * Rotas públicas (sem sessão):
 *   /login                        — tela de login
 *   /recuperar-senha              — fluxo de reset
 *   /auth/callback                — OAuth / magic link callback
 *   /auth/sign-out                — logout
 *   /api/ponto/punch              — colaboradores batem ponto sem sessão browser
 *   /api/nav                      — configuração global lida pelos submódulos
 *   /api/orchestrator/*           — webhooks externos com CRON_SECRET/HMAC
 *   /api/cron/*                   — Vercel Cron (autenticação por header)
 */
const PUBLIC_PREFIXES: ReadonlyArray<string> = [
  "/login",
  "/recuperar-senha",
  "/auth/",
  "/api/ponto/punch",
  "/api/nav",
  "/api/orchestrator/",
  "/api/cron/",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas passam direto — não desperdiça request com refresh.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // updateSession() faz 3 coisas:
  //   1) lê cookies da request atual
  //   2) se access token expirou, @supabase/ssr tenta refresh e escreve os
  //      novos tokens via setAll() — propagados para a response
  //   3) valida o JWT contra o servidor Auth (não confia só no cookie)
  // Retorna response com Set-Cookie correto + user validado.
  const { response, user, authError } = await updateSession(request);

  if (process.env.NEXT_PUBLIC_SHELL_URL?.includes("localhost")) {
    console.info("[shell-auth-boundary]", {
      pathname,
      cookieNames: request.cookies.getAll().map((cookie) => cookie.name),
      authenticated: Boolean(user),
      authError: authError?.message ?? null,
    });
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preserva o destino original para redirect pós-login.
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, EXCETO: assets do Next, arquivos estáticos, imagens e fontes.
    "/((?!_next/|(?:financeiro|pessoas|operacao|compras|comercial|marca|inteligencia|orquestrador)/_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
