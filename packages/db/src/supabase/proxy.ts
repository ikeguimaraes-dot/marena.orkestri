import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "../types/database";

/**
 * Mantém a sessão Supabase em sincronia entre request e response.
 * Chamado pelo proxy.ts a cada request — a versão moderna do que era
 * o middleware do Next ≤ 15.
 *
 * Se as env vars não estão setadas (modo dev sem Supabase), retorna user=null
 * e o proxy redireciona pra /login. UI não quebra.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { response, user: null };
  }

  const projectRef = new URL(url).hostname.split(".")[0] ?? "";
  const authCookieName = `sb-${projectRef}-auth-token`;
  const backupCookieName = "marena_auth_session_backup";
  const backup = request.cookies.get(backupCookieName)?.value;
  const accessToken = request.cookies.get("marena_access_token")?.value;
  const refreshToken = request.cookies.get("marena_refresh_token")?.value;
  let recoverableSession = backup;
  if (!recoverableSession && accessToken && refreshToken) {
    const jwtPayload = accessToken.split(".")[1];
    let expiresAt = Math.floor(Date.now() / 1000) + 3600;
    try {
      if (jwtPayload) {
        const payload = JSON.parse(Buffer.from(jwtPayload, "base64url").toString("utf8"));
        if (typeof payload.exp === "number") expiresAt = payload.exp;
      }
    } catch {
      // O Supabase validará o token abaixo; o fallback serve só para montar
      // o formato de storage esperado pelo cliente SSR.
    }
    recoverableSession = `base64-${Buffer.from(JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
      expires_at: expiresAt,
      expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    })).toString("base64url")}`;
  }
  if (!request.cookies.get(authCookieName)?.value && recoverableSession) {
    request.cookies.set(authCookieName, recoverableSession);
    response = NextResponse.next({ request });
    response.cookies.set(authCookieName, recoverableSession, {
      path: "/", httpOnly: false, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Padrão oficial @supabase/ssr: atualiza request + cria nova response com
        // cookies persistidos. Server Components vêem o cookie atualizado via
        // request; browser recebe o cookie via Set-Cookie na response.
        const safeCookies = cookiesToSet.filter(
          ({ name, value, options }) =>
            !name.includes("auth-token") ||
            (value.length > 0 && (options?.maxAge == null || options.maxAge > 0)),
        );
        safeCookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        safeCookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        const renewed = safeCookies.find(({ name }) => name === authCookieName);
        if (renewed) {
          response.cookies.set(backupCookieName, renewed.value, {
            path: "/", httpOnly: true, sameSite: "lax", secure: false,
            maxAge: 60 * 60 * 24 * 30,
          });
        }
      },
    },
  });

  // getClaims() valida a assinatura do JWT e usa o JWKS em cache quando
  // disponível. Isso evita uma chamada remota ao Auth a cada troca de zona,
  // que fazia falhas transitórias serem interpretadas como logout.
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;

  return {
    response,
    user: subject ? { id: subject } : null,
    authError: error,
  };
}
