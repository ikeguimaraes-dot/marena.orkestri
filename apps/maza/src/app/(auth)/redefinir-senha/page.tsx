import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Redefinir senha · Marena",
  description: "Crie uma nova senha para sua conta.",
};

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg, #111110)" }}>
      <div className="w-full max-w-[400px] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="size-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: "var(--brand, #C4622D)", color: "#F5F0E8", fontFamily: "Georgia, serif" }}>K</div>
          <div>
            <h1 className="text-2xl" style={{ color: "var(--text, #F5F0E8)", fontFamily: "Georgia, serif" }}>Criar nova senha</h1>
            <p className="text-sm" style={{ color: "var(--text-3, #A09890)" }}>Escolha uma senha segura para sua conta</p>
          </div>
        </div>
        <div className="w-full rounded-xl p-6" style={{ background: "var(--surface, #1A1A18)", border: "1px solid var(--border-soft, rgba(245,240,232,0.08))" }}>
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
