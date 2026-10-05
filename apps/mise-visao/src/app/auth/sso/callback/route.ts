import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getShellBase } from "@/lib/shell-url";

/**
 * Handoff de SSO do shell. Cada sub-app precisa da própria sessão Supabase
 * (cookies são por domínio) — o shell manda um magic-link token_hash pra cá,
 * verificamos com verifyOtp() e o cookie de sessão fica gravado neste domínio.
 *
 * Rota pública — o middleware (src/middleware.ts) deixa passar antes de
 * existir cookie.
 */

function safeMisePath(value: string | null): string {
  return value?.startsWith("/mise") && !value.startsWith("//") ? value : "/mise";
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const next = safeMisePath(request.nextUrl.searchParams.get("next"));
  const shellUrl = getShellBase();

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login?error=missing_code", shellUrl));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login?error=supabase_unavailable", shellUrl));
  }

  const response = NextResponse.redirect(new URL(next, request.nextUrl.origin));
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) {
    console.error("[sso callback] token inválido:", error.message);
    return NextResponse.redirect(new URL("/login?error=sso_invalid", shellUrl));
  }

  return response;
}
