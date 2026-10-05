import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@maza/db/types/database";

/**
 * Callback do magic link — Supabase manda o user pra cá com `?code=...`.
 *
 * Cria o response de redirect ANTES e escreve os cookies de sessão diretamente
 * nele via setAll. Isso garante que o browser recebe os cookies no mesmo
 * redirect — evita o bug "session existe na primeira render mas some no
 * próximo click" causado por cookies escritos via next/headers que não
 * propagam para NextResponse.redirect().
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=supabase_unavailable`);
  }

  // Cria a response de redirect primeiro — cookies serão escritos nela.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const redirectUrl = new URL(safeNext, origin);
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient<Database>(url, anonKey, {
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const errorUrl = new URL("/login", origin);
    errorUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(errorUrl);
  }

  // Se veio employee_id no redirect, vincula o user ao employee
  const employeeId = searchParams.get('employee_id')
  if (employeeId && data?.session?.user?.id) {
    // Import do createServiceClient dinâmico para não quebrar dependências no top-level
    const { createServiceClient } = await import('@maza/db/supabase/server')
    const service = createServiceClient()
    if (service) {
      await service
        .from('employees')
        .update({ user_id: data.session.user.id } as never)
        .eq('id', employeeId)
        .is('user_id', null) // só vincula se ainda não tem user
    }
  }

  return response;
}
