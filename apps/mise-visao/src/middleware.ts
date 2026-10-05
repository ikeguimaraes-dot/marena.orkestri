import { type NextRequest, NextResponse } from "next/server";
import { getShellLoginUrl } from "./lib/shell-url";

/**
 * Middleware do sub-app mise-visao — gate paralelo ao shell.
 *
 * Por que existe: o rewrite do shell (`/mise/*` →
 * `http://localhost:3000/*`) é server-side. Se o user digita
 * `mise.example.test` DIRETO na barra de endereço, o shell nunca vê
 * essa request. Este middleware cobre esse caso.
 *
 * Fluxo:
 *   1. User acessa mise.example.test sem cookie
 *   2. Middleware detecta ausência de sb-*-auth-token
 *   3. 302 → <SHELL_URL>/login?next=/mise/...
 *   4. Shell autentica e volta para a rota canônica no próprio shell
 *
 * IMPORTANTE: este middleware deve ficar IDÊNTICO ao dos outros sub-apps do
 * grupo Marena (ver maza-financeiro/src/middleware.ts). Mudanças aqui precisam
 * ser replicadas em todos.
 *
 * ENV: NEXT_PUBLIC_SHELL_URL controla pra onde redirecionamos. Ver .env.example.
 */

export function middleware(request: NextRequest) {
  // O callback de SSO precisa rodar antes de existir um cookie neste sub-app.
  if (request.nextUrl.pathname === "/auth/sso/callback") {
    return NextResponse.next();
  }

  const hasSession = request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token") && c.value.length > 0);

  if (hasSession) {
    return NextResponse.next();
  }

  // Sem sessão → redirect pro login central. Sempre pela URL canônica do
  // shell — cookies de projetos distintos em *.vercel.app não são
  // compartilhados entre si.
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const url = getShellLoginUrl(returnTo);
  return NextResponse.redirect(url, 302);
}

export const config = {
  matcher: ["/((?!_next/|api/auth/|.*\\..*).*)"],
};
