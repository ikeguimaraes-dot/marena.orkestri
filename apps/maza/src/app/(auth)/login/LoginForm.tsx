"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn, type SignInResult } from "./actions";
import { cn } from "@maza/ui/utils";

/**
 * Form de login — Client Component.
 *
 * Usa `useActionState` (React 19) para gerenciar:
 *   - estado de submit (pending automático)
 *   - erros retornados pela Server Action
 *   - reset de erro ao digitar
 *
 * O form é nativo (`<form action={formAction}>`) — sem precisar de
 * useState para campos. Apenas dois useState locais: mostrarSenha
 * (toggle do olho) e lembrar (checkbox).
 *
 * O input usa os componentes do @maza/ui (mesma base do shadcn).
 */
export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError: string | null;
}) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(false);

  // useActionState: recebe a action e o estado inicial.
  // O React preenche `pending` automaticamente enquanto a action roda.
  const [state, formAction, pending] = useActionState<SignInResult | null, FormData>(
    async (_prev, formData) => {
      const result = await signIn({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
        remember: lembrar,
        next,
      });
      return result;
    },
    initialError ? { ok: false, error: initialError } : null,
  );

  const error = state && !state.ok ? state.error : null;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {/* ── E-mail ── */}
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

      {/* ── Senha ── */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-xs font-medium"
          style={{ color: "var(--text-2, #C4BDB4)" }}
        >
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            minLength={6}
            placeholder="••••••••"
            disabled={pending}
            className={cn(
              "h-10 w-full rounded-lg pl-3 pr-10 text-sm transition-colors outline-none",
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
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            disabled={pending}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-2 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-50"
            style={{ color: "var(--text-3, #A09890)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--surface-hover, rgba(245,240,232,0.04))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {mostrarSenha ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Lembrar-me ── */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={lembrar}
          onChange={(e) => setLembrar(e.target.checked)}
          disabled={pending}
          className="size-4 rounded border transition-colors disabled:opacity-50"
          style={{
            accentColor: "var(--brand, #C4622D)",
            borderColor: "var(--border-soft, rgba(245,240,232,0.16))",
          }}
        />
        <span className="text-xs" style={{ color: "var(--text-2, #C4BDB4)" }}>
          lembrar minha sessão
        </span>
      </label>

      {/* ── Erro ── */}
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

      {/* ── Submit ── */}
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
            <span>Entrando…</span>
          </>
        ) : (
          <span>Entrar</span>
        )}
      </button>
    </form>
  );
}
