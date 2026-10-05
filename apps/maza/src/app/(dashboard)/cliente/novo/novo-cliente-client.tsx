"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button, buttonVariants } from "@maza/ui/button";
import { Input } from "@maza/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@maza/ui/select";
import { Textarea } from "@maza/ui/textarea";
import { createClient } from "@/app/(dashboard)/cliente/actions";
import { ORIGEM_LABEL, type ClientOrigem } from "@/lib/cliente/types";

const ORIGEM_VALUES: ClientOrigem[] = [
  "indicacao",
  "site",
  "instagram",
  "whatsapp",
  "evento",
  "outro",
];

export function NovoClienteClient({
  unitId,
  unitName,
  brandId,
}: {
  unitId: string;
  unitName: string;
  brandId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [origem, setOrigem] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const canSubmit = !pending && nome.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createClient({
        brand_id: brandId,
        unit_id: unitId,
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        empresa: empresa.trim() || null,
        origem: (origem as ClientOrigem) || null,
        observacoes: observacoes.trim() || null,
        ativo: true,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/cliente/${r.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link
        href="/cliente"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-3)",
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Clientes
      </Link>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: "var(--text)",
            letterSpacing: -0.3,
          }}
        >
          Novo cliente
        </h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", margin: "4px 0 18px" }}>
          Unidade {unitName}.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <Field label="Nome" required wide>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo ou razão social"
            />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contato@cliente.com"
            />
          </Field>

          <Field label="Telefone">
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </Field>

          <Field label="Empresa">
            <Input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Empresa ou marca"
            />
          </Field>

          <Field label="Origem">
            <Select value={origem} onValueChange={(v) => setOrigem(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Como conheceu?" />
              </SelectTrigger>
              <SelectContent>
                {ORIGEM_VALUES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {ORIGEM_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Observações" wide>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Histórico, preferências, restrições alimentares, etc."
            />
          </Field>
        </div>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 8,
              fontSize: 12,
              color: "#B91C1C",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Link href="/cliente" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar cliente
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  required,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        gridColumn: wide ? "1 / -1" : "auto",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-2)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
        }}
      >
        {label}
        {required && <span style={{ color: "var(--destructive)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
