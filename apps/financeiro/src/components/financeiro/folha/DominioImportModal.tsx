"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseDominioPdf } from "@/lib/folha/dominio/browser-loader";
import { importarExtratoDominio } from "@/app/financeiro/folha/dominio/actions";
import type { DominioParseResultado } from "@/lib/folha/dominio/types";
import type { ImportarExtratoDominioResultado } from "@/lib/folha/dominio/importar";

type Props = { onClose: () => void; onSuccess: () => void };
type Status = "idle" | "revisao" | "lendo" | "enviando" | "concluido" | "erro";

export function DominioImportModal({ onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [previas, setPrevias] = useState<DominioParseResultado[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [resultados, setResultados] = useState<ImportarExtratoDominioResultado[]>([]);

  async function processarArquivos(files: FileList) {
    setStatus("lendo");
    setError("");
    setResultados([]);
    try {
      const analises: DominioParseResultado[] = [];
      const competencias = new Set<string>();
      for (const arquivo of Array.from(files)) {
        setFileName(arquivo.name);
        const parse = await parseDominioPdf(arquivo);
        if (!parse.competencias.length) throw new Error(`${arquivo.name}: nenhuma competência reconhecida. Selecione extratos mensais ou recibos de pagamento Domínio.`);
        for (const comp of parse.competencias) {
          const key = `${comp.cnpj}:${comp.competencia}`;
          if (competencias.has(key)) throw new Error(`Há mais de um arquivo para ${comp.competencia}, CNPJ ${comp.cnpj}. Selecione uma única versão completa por mês.`);
          competencias.add(key);
        }
        analises.push(parse);
      }
      setPrevias(analises);
      setStatus("revisao");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("erro");
    }
  }

  async function confirmarImportacao() {
    setStatus("enviando");
    setError("");
    const acumulado: ImportarExtratoDominioResultado[] = [];
    for (const parse of previas) {
      setFileName(parse.arquivoOrigem);
      try {
        acumulado.push(await importarExtratoDominio(parse));
      } catch (e) {
        acumulado.push({ ok: false, arquivoOrigem: parse.arquivoOrigem, cnpjsDesconhecidos: [], competencias: parse.competencias.map(c => ({ competencia: c.competencia, cnpj: c.cnpj, ok: false, unitId: null, colaboradores: 0, linhasProvento: 0, linhasDesconto: 0, error: e instanceof Error ? e.message : String(e) })) });
      }
      setResultados([...acumulado]);
    }
    setStatus("concluido");
  }

  const busy = status === "lendo" || status === "enviando";
  const box: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxHeight: "85vh", overflowY: "auto", width: 640, maxWidth: "92vw" };
  const button: React.CSSProperties = { padding: "8px 16px", borderRadius: 7, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 600 };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.62)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Importar folha contábil</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-3)" }}>Extrato mensal ou recibos de pagamento em PDF. O mês vem do documento e a unidade, do CNPJ.</p>
          </div>
          {!busy && <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: 0, color: "var(--text-3)", cursor: "pointer", fontSize: 20 }}>×</button>}
        </div>

        {(status === "idle" || status === "erro") && (
          <label style={{ display: "grid", placeItems: "center", gap: 8, padding: 28, border: "2px dashed var(--border)", borderRadius: 10, cursor: "pointer" }}>
            <span style={{ fontSize: 30 }}>📄</span>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>Selecionar PDFs da folha</span>
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple hidden onChange={(e) => { if (e.target.files?.length) void processarArquivos(e.target.files); }} />
          </label>
        )}

        {status === "revisao" && <div style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 13 }}>Confira os meses antes de importar. Cada arquivo será gravado na competência abaixo, independentemente do mês aberto na tela.</p>
          {previas.map(p => <div key={p.arquivoOrigem} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
            <strong style={{ fontSize: 13, overflowWrap: "anywhere" }}>{p.arquivoOrigem}</strong>
            {p.competencias.map(c => <p key={`${c.cnpj}:${c.competencia}`} style={{ fontSize: 13 }}><strong>{c.competencia.split('-').reverse().join('/')}</strong> · {c.razaoSocial ?? c.cnpj} · CNPJ {c.cnpj} · {c.colaboradores.length} colaboradores</p>)}
            {p.avisos.map((aviso, i) => <p key={i} style={{ fontSize: 12, color: "var(--text-3)" }}>{aviso}</p>)}
          </div>)}
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>A importação substitui a folha contábil existente da mesma unidade e mês. Envie o arquivo completo de cada competência.</p>
          <button onClick={() => void confirmarImportacao()} style={{ ...button, background: "var(--brand)", color: "white" }}>Confirmar importação</button>
          <button onClick={() => { setPrevias([]); setStatus("idle"); }} style={button}>Selecionar outros arquivos</button>
        </div>}

        {status === "lendo" && <p style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}>Lendo {fileName}…</p>}
        {status === "enviando" && <p style={{ padding: 30, textAlign: "center", color: "var(--text-3)" }}>Validando e gravando {fileName}…</p>}

        {error && <div style={{ padding: "9px 12px", marginTop: 12, borderRadius: 7, background: "rgba(239,68,68,.1)", color: "#ef4444", fontSize: 12 }}>{error}</div>}

        {status === "concluido" && (
          <div style={{ display: "grid", gap: 10 }}>
            {resultados.map((r) => (
              <div key={r.arquivoOrigem} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13 }}>{r.arquivoOrigem}</p>
                {r.competencias.length === 0 && <p style={{ fontSize: 12, color: "#f59e0b" }}>Nenhuma competência foi importada. Verifique a conexão e tente novamente.</p>}
                {r.competencias.map((c) => (
                  <div key={`${c.cnpj}:${c.competencia}`} style={{ fontSize: 12, color: c.ok ? "#22c55e" : "#ef4444", marginBottom: 4 }}>
                    {c.competencia} ({c.cnpj}): {c.ok ? `OK — ${c.colaboradores} colaboradores, ${c.linhasProvento} proventos, ${c.linhasDesconto} descontos` : c.error}
                  </div>
                ))}
                {r.cnpjsDesconhecidos.length > 0 && (
                  <p style={{ fontSize: 12, color: "#f59e0b", marginTop: 6 }}>CNPJ(s) sem vínculo ativo com uma unidade acessível: {r.cnpjsDesconhecidos.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          {status === "concluido" ? (
            <button onClick={() => { onSuccess(); onClose(); }} style={{ ...button, background: "var(--brand)", color: "white", border: 0 }}>Concluir</button>
          ) : (
            <button disabled={busy} onClick={onClose} style={{ ...button, background: "transparent", color: "var(--text-2)" }}>Cancelar</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
