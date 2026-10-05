import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@maza/db/supabase/server";

async function handle(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("password") === "updated") {
    url.searchParams.set("message", "password_updated");
  }
  const response = NextResponse.redirect(url);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if ((cookie.name.startsWith("sb-") && cookie.name.includes("auth-token")) ||
        cookie.name === "marena_auth_session_backup" ||
        cookie.name === "marena_access_token" ||
        cookie.name === "marena_refresh_token") {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}

// Aceita GET (link direto) e POST (formulário) — UX simples.
export const GET = handle;
export const POST = handle;
