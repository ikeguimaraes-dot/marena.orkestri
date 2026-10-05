import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@maza/auth/server";
import { createServiceClient } from "@maza/db/supabase/server";

const ZONES = [
  { prefixes: ["/financeiro"], env: "FINANCEIRO_APP_URL", fallback: "http://localhost:3000" },
  { prefixes: ["/pessoas"], env: "PESSOAS_APP_URL", fallback: "http://localhost:3002" },
  { prefixes: ["/operacao"], env: "OPERACAO_APP_URL", fallback: "http://localhost:3000" },
  { prefixes: ["/compras", "/cardapio"], env: "COMPRAS_APP_URL", fallback: "http://localhost:3000" },
  { prefixes: ["/comercial"], env: "COMERCIAL_APP_URL", fallback: "http://localhost:3005" },
  { prefixes: ["/marca"], env: "MARCA_APP_URL", fallback: "http://localhost:3006" },
  { prefixes: ["/inteligencia", "/orquestrador"], env: "INTELIGENCIA_APP_URL", fallback: "http://localhost:3007" },
] as const;

function safePath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/** Ponte de SSO entre projetos *.vercel.app usando token Supabase de uso único. */
export async function GET(request: NextRequest) {
  const next = safePath(request.nextUrl.searchParams.get("next"));
  const zone = ZONES.find(({ prefixes }) =>
    prefixes.some((prefix) => next === prefix || next.startsWith(`${prefix}/`)),
  );

  if (!zone) {
    return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  const user = await getCurrentUser();
  if (!user?.email) {
    const login = new URL("/login", request.nextUrl.origin);
    login.searchParams.set("next", `/auth/sso?next=${encodeURIComponent(next)}`);
    return NextResponse.redirect(login);
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.redirect(
      new URL("/login?error=supabase_unavailable", request.nextUrl.origin),
    );
  }

  const { data, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    console.error("[sso] não foi possível gerar token:", error?.message);
    return NextResponse.redirect(new URL("/?sso_error=token", request.nextUrl.origin));
  }

  const targetBase = process.env[zone.env]?.trim() || zone.fallback;
  const callback = new URL("/auth/sso/callback", targetBase);
  callback.searchParams.set("token_hash", tokenHash);
  callback.searchParams.set("next", next);
  return NextResponse.redirect(callback);
}
