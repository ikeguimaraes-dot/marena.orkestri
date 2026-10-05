"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@maza/db/supabase/server";

/**
 * Server Action para reset de senha.
 *
 * Fluxo:
 *   1) Usuário preenche e-mail em /recuperar-senha
 *   2) resetPasswordForEmail dispara um e-mail com link tipo
 *      https://maza.os/auth/callback?code=...&type=recovery
 *   3) Usuário clica no link → /auth/callback troca o code por session
 *   4) Usuário vai pra /redefinir-senha pra definir a nova senha
 *
 * Segurança:
 *   - Sempre retornamos sucesso (mesmo se o e-mail não existir) para não
 *     permitir enumeração de usuários
 *   - O e-mail é a única confirmação real — Supabase não envia se o
 *     e-mail não está cadastrado, mas o front não pode inferir isso
 */
export type ResetPasswordResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestPasswordReset(
  _prev: ResetPasswordResult | null,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { ok: false, error: "Informe seu e-mail." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "E-mail inválido." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      error: "Serviço de autenticação indisponível. Tente em instantes.",
    };
  }

  // Origem do request → link no e-mail aponta pra cá.
  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  const origin =
    headerStore.get("origin") ??
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ??
    process.env.NEXT_PUBLIC_SHELL_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";
  const redirectTo = `${origin}/auth/callback?type=recovery&next=/redefinir-senha`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    // Loga internamente mas NÃO revela pro usuário. Anti-enumeração.
    console.error("[resetPasswordForEmail]", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    if (error.status === 429) {
      return {
        ok: false,
        error: "Muitas tentativas de envio. Aguarde alguns minutos e tente novamente.",
      };
    }
    return {
      ok: false,
      error: "Não foi possível enviar o e-mail agora. Contate o administrador do sistema.",
    };
  }

  // Sempre sucesso — não vaza se o e-mail existe.
  return { ok: true, email };
}
