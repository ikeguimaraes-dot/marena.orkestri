"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { getBrowserClient } from "@maza/db/supabase/client";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Serviço de autenticação indisponível.");
      return;
    }
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      setError(updateError.message.toLowerCase().includes("session")
        ? "O link expirou. Solicite uma nova recuperação de senha."
        : "Não foi possível atualizar a senha. Solicite um novo link.");
      return;
    }
    window.location.assign("/auth/sign-out?password=updated");
  }

  const inputStyle = { background: "var(--surface-2, #222220)", border: "1px solid var(--border-soft, rgba(245,240,232,0.08))", color: "var(--text, #F5F0E8)" };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--text-2, #C4BDB4)" }}>
        Nova senha
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending} required minLength={8} className="h-10 rounded-lg px-3 text-sm outline-none" style={inputStyle} />
      </label>
      <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--text-2, #C4BDB4)" }}>
        Confirmar nova senha
        <input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={pending} required minLength={8} className="h-10 rounded-lg px-3 text-sm outline-none" style={inputStyle} />
      </label>
      {error && <div role="alert" className="rounded-lg px-3 py-2 text-xs" style={{ color: "#FCA5A5", border: "1px solid #FCA5A5", background: "rgba(252,165,165,0.08)" }}>{error}</div>}
      <button type="submit" disabled={pending} className="h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "var(--brand, #C4622D)", color: "#F5F0E8" }}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Atualizando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
