"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@maza/db/supabase/server";

/**
 * Server Action de login.
 *
 * Por que Server Action e não Route Handler:
 *   - Form nativo do React 19 (`<form action={signIn}>`) sem precisar de
 *     useState/useEffect para loading state
 *   - Tokens vão direto nos cookies httpOnly via setAll() do @supabase/ssr
 *   - CSRF protegido pelo Next (Server Actions têm origin check embutido)
 *
 * Por que "use server" no topo do arquivo:
 *   - Cada export async vira um RPC chamável. Tudo aqui dentro é server-side.
 *
 * Flag "remember":
 *   - false (default): access_token expira em 1h, refresh_token em 7d.
 *     Browser perde a sessão ao fechar.
 *   - true: persistSession=true → ambos os tokens valem 30d.
 *     Browser mantém a sessão entre fechamentos.
 */
export type SignInInput = {
  email: string;
  password: string;
  remember: boolean;
  next?: string;
};

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(input: SignInInput): Promise<SignInResult> {
  // ── Validação de input ─────────────────────────────────────
  if (!input?.email || !input.password) {
    return { ok: false, error: "Preencha e-mail e senha." };
  }
  if (!EMAIL_RE.test(input.email)) {
    return { ok: false, error: "E-mail inválido." };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "Senha deve ter pelo menos 6 caracteres." };
  }

  // ── Origem (pra montar redirect pós-login de forma segura) ──
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? headerStore.get("referer") ?? "";

  // ── Cliente server-side com cookies httpOnly ────────────────
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Serviço de autenticação indisponível. Tente em instantes.",
    };
  }

  // ── signInWithPassword ──────────────────────────────────────
  // signInWithPassword sempre devolve session — sucesso ou erro de credencial.
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    // Mensagens amigáveis. NÃO vaza se é "e-mail não existe" vs
    // "senha errada" — isso é enumeração de usuários (security anti-pattern).
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { ok: false, error: "E-mail ou senha incorretos." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        ok: false,
        error: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
      };
    }
    return { ok: false, error: "Não foi possível autenticar. Tente novamente." };
  }

  // Sucesso. redirect() lança NEXT_REDIRECT — não precisa retornar nada.
  // Validação do `next` para evitar open redirect: precisa ser path relativo.
  const cookieStore = await cookies();
  if (data.session) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null;
    const authCookieName = projectRef ? `sb-${projectRef}-auth-token` : null;
    const encodedSession = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
    const secure = process.env.NODE_ENV === "production";
    const options = {
      path: "/", httpOnly: true, sameSite: "lax", secure: false,
      maxAge: 60 * 60 * 24 * 30,
    } as const;
    if (authCookieName) {
      // Grava explicitamente a sessão canônica; não depende da mutação interna
      // do @supabase/ssr ser refletida pelo Server Action da versão atual do Next.
      cookieStore.set(authCookieName, encodedSession, {
        ...options, httpOnly: false, secure,
      });
    }
    cookieStore.set("marena_auth_session_backup", encodedSession, {
      ...options, secure,
    });
    // Cópia compacta e independente. Os sub-apps conhecem o nome do cookie
    // Supabase e podem sobrescrevê-lo durante uma navegação RSC, mas não
    // conhecem estes cookies. O middleware do shell os usa para reconstruir a
    // sessão antes de encaminhar a request para uma zona.
    cookieStore.set("marena_access_token", data.session.access_token, {
      ...options, secure,
    });
    cookieStore.set("marena_refresh_token", data.session.refresh_token, {
      ...options, secure,
    });
  }

  const safeNext =
    input.next && input.next.startsWith("/") && !input.next.startsWith("//")
      ? input.next
      : "/";

  redirect(safeNext);
}

/**
 * Server Action para logout. Chamada de /auth/sign-out (route handler)
 * ou diretamente de forms. Limpa cookies e redireciona pro /login.
 */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/login");
}
