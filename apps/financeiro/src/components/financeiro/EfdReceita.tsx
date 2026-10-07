"use client";
import { useEffect, useState } from "react";
import { listEfd, saveEfd } from "@/app/financeiro/dre/receita/efd-actions";
import { readEfdPdf } from "@/lib/receita/efd-browser";
import type { EfdResumo } from "@/lib/receita/efd";

const brl = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function EfdReceita({ unitId, competencia, allowImport }: { unitId: string; competencia: string; allowImport: boolean }) {
  const [rows, setRows] = useState<EfdResumo[]>([]);
  const [preview, setPreview] = useState<{ text: string; resumo: EfdResumo; filename: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    void listEfd(unitId, competencia).then(result => {
      if (active) { setRows(result.rows); setLoadError(result.error ? "Receita fiscal indisponível. Verifique a migração e o acesso à unidade." : ""); }
    });
    return () => { active = false; };
  }, [unitId, competencia]);

  async function read(file: File) {
    setBusy(true); setPreview(null); setMessage("");
    try { setPreview({ ...await readEfdPdf(file, setMessage), filename: file.name }); setMessage(""); }
    catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      const result = await saveEfd({ unitId, text: preview.text, filename: preview.filename });
      if (!result.ok) throw new Error(result.error);
      const refreshed = await listEfd(unitId, competencia);
      setRows(refreshed.rows); setLoadError(refreshed.error ?? "");
      setMessage(`Receita fiscal de ${result.resumo.competencia} salva. Se necessário, selecione esse mês no filtro acima.`);
      setPreview(null);
    } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <section aria-label="Receita fiscal EFD" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
    <h3 style={{ margin: "0 0 8px" }}>Receita fiscal · EFD PIS/COFINS</h3>
    <p style={{ color: "var(--text-3)", fontSize: 13 }}>Resumo mensal para conferência. Não é somado aos indicadores de caixa ou às notas de saída. O PDF não informa recebimentos, clientes ou turnos.</p>
    {loadError && <p role="alert">{loadError}</p>}
    {!loadError && rows.length === 0 && <p>Nenhum demonstrativo fiscal salvo para {competencia}.</p>}
    {rows.map(row => <p key={row.cnpj}>CNPJ {row.cnpj} · Receita: <strong>{brl(row.receita)}</strong> · PIS: {brl(row.pis)} · COFINS: {brl(row.cofins)}</p>)}
    {allowImport && <>
      <label>Demonstrativo EFD completo (.pdf, até 50 MB)<input aria-label="Selecionar demonstrativo EFD" disabled={busy} type="file" accept=".pdf,application/pdf" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void read(file); }} style={{ display: "block", margin: "12px 0" }} /></label>
      {preview && <div>
        <p>{preview.filename} · {preview.resumo.competencia} · CNPJ {preview.resumo.cnpj}</p>
        <p>Receita: <strong>{brl(preview.resumo.receita)}</strong> · PIS: {brl(preview.resumo.pis)} · COFINS: {brl(preview.resumo.cofins)}</p>
        <p>Uma nova importação atualiza o resumo deste CNPJ e competência, sem duplicar o total.</p>
        <button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Confirmar importação fiscal"}</button>
      </div>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
