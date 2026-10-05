"use client";

import { useActionState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset, type ResetPasswordResult } from "./actions";
import { cn } from "@maza/ui/utils";

/**
 * Form de recuperação de senha — Client Component.
 *
 * Comportamento:
 *   - Estado inicial: campo de e-mail + botão "Enviar link"
 *   - Após sucesso: mostra confirmação com o e-mail enviado (mascarado)
 *     e botão pra enviar de novo (caso o usuário não tenha recebido)
 *
 * UX: NÃO dizemos se o e-mail existe ou não — anti-enumeração.
 */
export function RecoveryForm() {
  const [state, formAction, pending] = useActionState<
    ResetPasswordResult | null,
    FormData
  >(requestPasswordReset, null);

  // ── Sucesso: mostrar confirmação ──
  if (state && state.ok) {
    return <SuccessCard email={state.email} />;
  }

  // ── Estado normal: form ──
  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-xs font-medium"
          style={{ color: "var(--text-2, #C4BDB4)" }}
        >
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="voce@marena.example"
          disabled={pending}
          className={cn(
            "h-10 w-full rounded-lg px-3 text-sm transition-colors outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          style={{
            background: "var(--surface-2, #222220)",
            border: `1px solid ${error ? "var(--color-danger, #FCA5A5)" : "var(--border-soft, rgba(245,240,232,0.08))"}`,
            color: "var(--text, #F5F0E8)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--brand, #C4622D)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error
              ? "var(--color-danger, #FCA5A5)"
              : "var(--border-soft, rgba(245,240,232,0.08))";
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="text-xs px-3 py-2 rounded-lg"
          style={{
            background: "var(--color-danger-bg, rgba(252,165,165,0.08))",
            color: "var(--color-danger, #FCA5A5)",
            border: "1px solid var(--color-danger, #FCA5A5)",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className={cn(
          "h-10 w-full rounded-lg text-sm font-medium transition-all",
          "flex items-center justify-center gap-2",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
        style={{
          background: "var(--brand, #C4622D)",
          color: "var(--primary-foreground)",
        }}
        onMouseEnter={(e) => {
          if (!pending) e.currentTarget.style.background = "var(--brand-strong, #A84E22)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--brand, #C4622D)";
        }}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Enviando…</span>
          </>
        ) : (
          <span>Enviar link de recuperação</span>
        )}
      </button>
    </form>
  );
}

/**
 * Card de sucesso — exibido após o envio do e-mail.
 * Mostra o e-mail enviado (parcialmente mascarado) e um botão pra reenviar.
 */
function SuccessCard({ email }: { email: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center py-2">
      <div
        className="size-12 rounded-full flex items-center justify-center"
        style={{
          background: "var(--color-success-bg, rgba(74,222,128,0.08))",
          color: "var(--color-success, #4ADE80)",
        }}
      >
        <MailCheck className="size-6" />
      </div>

      <div className="flex flex-col gap-1.5">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text, #F5F0E8)" }}
        >
          Se o e-mail estiver cadastrado, você receberá um link em instantes.
        </p>
        <p
          className="text-xs"
          style={{ color: "var(--text-3, #A09890)" }}
        >
          Enviado para:{" "}
          <span style={{ color: "var(--text-2, #C4BDB4)" }}>
            {maskEmail(email)}
          </span>
        </p>
      </div>

      <p
        className="text-[11px] leading-relaxed max-w-[280px]"
        style={{ color: "var(--text-3, #A09890)" }}
      >
        O link expira em 1 hora. Verifique também a caixa de spam.
      </p>
    </div>
  );
}

/**
 * Mascara parte do e-mail pra mostrar pro usuário: v***@k***.com
 * Mantém domínio visível pra confirmar que foi pro lugar certo.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const localMasked = local[0] + "***";
  const domainParts = domain.split(".");
  const domainMasked =
    (domainParts[0]?.[0] ?? "*") + "***." + (domainParts[1] ?? "");
  return `${localMasked}@${domainMasked}`;
}
