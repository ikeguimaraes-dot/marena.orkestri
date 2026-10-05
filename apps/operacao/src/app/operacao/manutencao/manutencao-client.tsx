"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ChevronDown, ChevronRight, Paperclip, Eye, Trash2, Plus } from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/format";
import {
  OPERACOES,
  CATEGORIAS,
  LOCAIS,
  ANDARES,
  PRIORIDADES,
  FORMAS_PAGAMENTO,
  PRIORIDADE_CORES,
} from "@/lib/manutencao/constants";
import {
  criarChamado,
  atualizarChamado,
  excluirChamado,
  criarAprovacao,
  promoverChamadoParaAprovacao,
  definirAprovacao,
  atualizarAprovacao,
  excluirAprovacao,
  marcarParcelaPaga,
  anexarComprovante,
  removerComprovante,
  gerarUrlComprovante,
} from "./actions";
import type {
  ManutencaoChamadoRow,
  AprovacaoComParcelas,
  ChamadoStatus,
  AprovadoStatus,
} from "./actions";

// ── Helpers ──────────────────────────────────────────────────────────────────

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatCompetencia(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return "—";
  return `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`;
}

function todayInputValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isMesAtual(iso: string | null): boolean {
  if (!iso) return false;
  const hoje = todayInputValue();
  return iso.slice(0, 7) === hoje.slice(0, 7);
}

function parseValor(v: string): number | null {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ── Badges ───────────────────────────────────────────────────────────────────

function PrioridadeBadge({ prioridade }: { prioridade: string }) {
  const cor = PRIORIDADE_CORES[prioridade as keyof typeof PRIORIDADE_CORES] ?? { background: "var(--surface-3)", color: "var(--text-3)" };
  return (
    <span style={{ ...cor, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 800, display: "inline-block", flexShrink: 0, whiteSpace: "nowrap" }}>
      {prioridade}
    </span>
  );
}

const STATUS_CHAMADO_CONF: Record<ChamadoStatus, { label: string; background: string; color: string }> = {
  aberto: { label: "Aberto", background: "#1E3A8A", color: "#93C5FD" },
  em_andamento: { label: "Em andamento", background: "#78350F", color: "#FDE68A" },
  em_aprovacao: { label: "Em aprovação", background: "#4C1D95", color: "#D8B4FE" },
  concluido: { label: "Concluído", background: "#14532D", color: "#86EFAC" },
  cancelado: { label: "Cancelado", background: "var(--surface-3)", color: "var(--text-3)" },
};

function StatusChamadoBadge({ status }: { status: ChamadoStatus }) {
  const c = STATUS_CHAMADO_CONF[status] ?? STATUS_CHAMADO_CONF.aberto;
  return (
    <span style={{ background: c.background, color: c.color, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", flexShrink: 0, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

const APROVADO_CONF: Record<AprovadoStatus, { label: string; background: string; color: string }> = {
  SIM: { label: "✅ Aprovado", background: "#14532D", color: "#86EFAC" },
  NAO: { label: "❌ Reprovado", background: "#7F1D1D", color: "#FCA5A5" },
  PENDENTE: { label: "⏸ Pendente", background: "var(--surface-3)", color: "var(--text-3)" },
};

function AprovadoBadge({ aprovado }: { aprovado: AprovadoStatus }) {
  const c = APROVADO_CONF[aprovado] ?? APROVADO_CONF.PENDENTE;
  return (
    <span style={{ background: c.background, color: c.color, borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", flexShrink: 0, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

// ── Estilos compartilhados ───────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 };
const fieldInput: React.CSSProperties = { width: "100%", height: 44, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, padding: "0 12px", outline: "none", boxSizing: "border-box" };
const fieldTextarea: React.CSSProperties = { ...fieldInput, height: "auto", padding: "10px 12px", resize: "vertical" as const };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ flex: "1 1 160px", minWidth: 140, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

function Drawer({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} onClick={onClose} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100dvh", width: "min(420px, 100vw)", background: "var(--surface)", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 64, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{title}</span>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 8, display: "flex", alignItems: "center" }}><X size={20} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {children}
        </div>
        {footer && <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>{footer}</div>}
      </div>
    </>
  );
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  width: "100%", height: 48, background: "#22C55E", color: "#fff", border: "none", borderRadius: 10,
  fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
});

const smallActionBtn: React.CSSProperties = {
  height: 36, padding: "0 12px", fontSize: 12, fontWeight: 700, border: "1px solid var(--border)",
  borderRadius: 8, background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer", whiteSpace: "nowrap",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  unit: { id: string; name: string };
  chamadosIniciais: ManutencaoChamadoRow[];
  aprovacoesIniciais: AprovacaoComParcelas[];
}

const CHAMADO_FORM_VAZIO = {
  operacao: OPERACOES[0] as string,
  categoria: CATEGORIAS[0] as string,
  local: LOCAIS[0] as string,
  andar: ANDARES[0] as string,
  prioridade: PRIORIDADES[2] as string,
  data_solicitacao: "",
  servico: "",
  motivo: "",
  valor_previsto: "",
};

const APROVACAO_FORM_VAZIO = {
  operacao: OPERACOES[0] as string,
  categoria: CATEGORIAS[0] as string,
  local: LOCAIS[0] as string,
  andar: ANDARES[0] as string,
  prioridade: PRIORIDADES[2] as string,
  servico: "",
  data_solicitacao: "",
  valor_previsto: "",
  forma_pagamento: FORMAS_PAGAMENTO[0] as string,
  numero_parcelas: "1",
};

export function ManutencaoClient({ chamadosIniciais, aprovacoesIniciais }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [aba, setAba] = useState<"diario" | "aprovacao">("diario");

  // ══════════════════════════════════════════════════════════════════════════
  // ABA 1 — PREENCHIMENTO DIÁRIO
  // ══════════════════════════════════════════════════════════════════════════

  const [chBusca, setChBusca] = useState("");
  const [chFiltroCategoria, setChFiltroCategoria] = useState("");
  const [chFiltroLocal, setChFiltroLocal] = useState("");
  const [chFiltroPrioridade, setChFiltroPrioridade] = useState("");
  const [chFiltroStatus, setChFiltroStatus] = useState("");
  const [chFiltroDataInicio, setChFiltroDataInicio] = useState("");
  const [chFiltroDataFim, setChFiltroDataFim] = useState("");

  const [drawerAberto, setDrawerAberto] = useState<"novoChamado" | "enviarAprovacao" | "novaAprovacao" | null>(null);
  const [chForm, setChForm] = useState(CHAMADO_FORM_VAZIO);

  const [chamadoAlvo, setChamadoAlvo] = useState<ManutencaoChamadoRow | null>(null);
  const [efForm, setEfForm] = useState({ valor_previsto: "", forma_pagamento: FORMAS_PAGAMENTO[0] as string, numero_parcelas: "1" });

  const [concluirRowId, setConcluirRowId] = useState<string | null>(null);
  const [executadoPorInput, setExecutadoPorInput] = useState("");
  const [dataExecucaoInput, setDataExecucaoInput] = useState(todayInputValue());

  const [excluindoChamadoId, setExcluindoChamadoId] = useState<string | null>(null);

  const chamadosFiltrados = useMemo(() => {
    const busca = chBusca.trim().toLowerCase();
    return chamadosIniciais.filter((c) => {
      if (busca && !c.servico.toLowerCase().includes(busca) && !c.motivo.toLowerCase().includes(busca)) return false;
      if (chFiltroCategoria && c.categoria !== chFiltroCategoria) return false;
      if (chFiltroLocal && c.local !== chFiltroLocal) return false;
      if (chFiltroPrioridade && c.prioridade !== chFiltroPrioridade) return false;
      if (chFiltroStatus && c.status !== chFiltroStatus) return false;
      if (chFiltroDataInicio && c.data_solicitacao < chFiltroDataInicio) return false;
      if (chFiltroDataFim && c.data_solicitacao > chFiltroDataFim) return false;
      return true;
    });
  }, [chamadosIniciais, chBusca, chFiltroCategoria, chFiltroLocal, chFiltroPrioridade, chFiltroStatus, chFiltroDataInicio, chFiltroDataFim]);

  const resumoChamados = useMemo(() => {
    const abertos = chamadosIniciais.filter((c) => c.status === "aberto").length;
    const emAndamento = chamadosIniciais.filter((c) => c.status === "em_andamento").length;
    const concluidosNoMes = chamadosIniciais.filter((c) => c.status === "concluido" && isMesAtual(c.data_execucao)).length;
    const p0Pendentes = chamadosIniciais.filter((c) => c.prioridade === "P.0" && c.status !== "concluido" && c.status !== "cancelado").length;
    return { abertos, emAndamento, concluidosNoMes, p0Pendentes };
  }, [chamadosIniciais]);

  function abrirNovoChamado() {
    setChForm({ ...CHAMADO_FORM_VAZIO, data_solicitacao: todayInputValue() });
    setDrawerAberto("novoChamado");
  }

  function handleCriarChamado() {
    if (!chForm.servico.trim()) { toast.error("Descreva o serviço."); return; }
    if (!chForm.data_solicitacao) { toast.error("Informe a data de solicitação."); return; }
    startTransition(async () => {
      const result = await criarChamado({
        operacao: chForm.operacao,
        categoria: chForm.categoria,
        local: chForm.local,
        andar: chForm.andar,
        prioridade: chForm.prioridade,
        data_solicitacao: chForm.data_solicitacao,
        servico: chForm.servico.trim(),
        motivo: chForm.motivo.trim(),
        valor_previsto: parseValor(chForm.valor_previsto),
      });
      if (!result.ok) { toast.error(result.error); return; }
      setDrawerAberto(null);
      toast.success("Chamado criado.");
      router.refresh();
    });
  }

  function handleConcluir(id: string) {
    if (!executadoPorInput.trim()) { toast.error("Informe quem executou."); return; }
    startTransition(async () => {
      const result = await atualizarChamado(id, {
        status: "concluido",
        executado_por: executadoPorInput.trim(),
        data_execucao: dataExecucaoInput,
      });
      if (!result.ok) { toast.error(result.error); return; }
      setConcluirRowId(null);
      setExecutadoPorInput("");
      toast.success("Chamado concluído.");
      router.refresh();
    });
  }

  function handleMudarStatus(id: string, status: ChamadoStatus) {
    startTransition(async () => {
      const result = await atualizarChamado(id, { status });
      if (!result.ok) { toast.error(result.error); return; }
      router.refresh();
    });
  }

  function abrirEnviarAprovacao(c: ManutencaoChamadoRow) {
    setChamadoAlvo(c);
    setEfForm({ valor_previsto: c.valor_previsto ? String(c.valor_previsto) : "", forma_pagamento: FORMAS_PAGAMENTO[0] as string, numero_parcelas: "1" });
    setDrawerAberto("enviarAprovacao");
  }

  function handleEnviarAprovacao() {
    if (!chamadoAlvo) return;
    const valor = parseValor(efForm.valor_previsto);
    const parcelas = parseInt(efForm.numero_parcelas, 10);
    if (!valor) { toast.error("Informe o valor previsto."); return; }
    if (!parcelas || parcelas <= 0) { toast.error("Número de parcelas inválido."); return; }
    startTransition(async () => {
      const result = await promoverChamadoParaAprovacao(chamadoAlvo.id, {
        valor_previsto: valor,
        forma_pagamento: efForm.forma_pagamento,
        numero_parcelas: parcelas,
      });
      if (!result.ok) { toast.error(result.error); return; }
      setDrawerAberto(null);
      setChamadoAlvo(null);
      toast.success("Enviado para aprovação.");
      router.refresh();
    });
  }

  function handleExcluirChamado(id: string) {
    startTransition(async () => {
      const result = await excluirChamado(id);
      if (!result.ok) { toast.error(result.error); return; }
      setExcluindoChamadoId(null);
      toast.success("Chamado excluído.");
      router.refresh();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ABA 2 — PREENCHIMENTO APROVAÇÃO
  // ══════════════════════════════════════════════════════════════════════════

  const [apFiltroAprovado, setApFiltroAprovado] = useState("");
  const [apFiltroCategoria, setApFiltroCategoria] = useState("");
  const [apFiltroLocal, setApFiltroLocal] = useState("");
  const [apFiltroDataInicio, setApFiltroDataInicio] = useState("");
  const [apFiltroDataFim, setApFiltroDataFim] = useState("");

  const [naForm, setNaForm] = useState(APROVACAO_FORM_VAZIO);
  const [expandedAprovacaoId, setExpandedAprovacaoId] = useState<string | null>(null);
  const [editandoDetalhesId, setEditandoDetalhesId] = useState<string | null>(null);
  const [detalhesForm, setDetalhesForm] = useState({ data_execucao: "", garantia_dias: "", numero_nota_fiscal: "", observacoes: "" });
  const [uploadingParcelaId, setUploadingParcelaId] = useState<string | null>(null);
  const [excluindoAprovacaoId, setExcluindoAprovacaoId] = useState<string | null>(null);

  const aprovacoesFiltradas = useMemo(() => {
    return aprovacoesIniciais.filter((a) => {
      if (apFiltroAprovado && a.aprovado !== apFiltroAprovado) return false;
      if (apFiltroCategoria && a.categoria !== apFiltroCategoria) return false;
      if (apFiltroLocal && a.local !== apFiltroLocal) return false;
      if (apFiltroDataInicio && a.data_solicitacao < apFiltroDataInicio) return false;
      if (apFiltroDataFim && a.data_solicitacao > apFiltroDataFim) return false;
      return true;
    });
  }, [aprovacoesIniciais, apFiltroAprovado, apFiltroCategoria, apFiltroLocal, apFiltroDataInicio, apFiltroDataFim]);

  const resumoAprovacoes = useMemo(() => {
    let totalAprovadoNoMes = 0;
    let pendentes = 0;
    let aPagarNoMes = 0;
    let pagoNoMes = 0;
    for (const a of aprovacoesIniciais) {
      if (a.aprovado === "SIM" && isMesAtual(a.data_aprovacao)) totalAprovadoNoMes += Number(a.valor_previsto);
      if (a.aprovado === "PENDENTE") pendentes++;
      for (const p of a.manutencao_parcelas) {
        if (!p.pago && isMesAtual(p.competencia)) aPagarNoMes += Number(p.valor);
        if (p.pago && isMesAtual(p.data_pagamento)) pagoNoMes += Number(p.valor);
      }
    }
    return { totalAprovadoNoMes, pendentes, aPagarNoMes, pagoNoMes };
  }, [aprovacoesIniciais]);

  const fluxoCaixa = useMemo(() => {
    const porMes = new Map<string, { previsto: number; pago: number }>();
    for (const a of aprovacoesIniciais) {
      for (const p of a.manutencao_parcelas) {
        const chave = p.competencia.slice(0, 7);
        if (!porMes.has(chave)) porMes.set(chave, { previsto: 0, pago: 0 });
        const entry = porMes.get(chave)!;
        entry.previsto += Number(p.valor);
        if (p.pago) entry.pago += Number(p.valor);
      }
    }
    return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [aprovacoesIniciais]);

  function abrirNovaAprovacao() {
    setNaForm({ ...APROVACAO_FORM_VAZIO, data_solicitacao: todayInputValue() });
    setDrawerAberto("novaAprovacao");
  }

  function handleCriarAprovacao() {
    const valor = parseValor(naForm.valor_previsto);
    const parcelas = parseInt(naForm.numero_parcelas, 10);
    if (!naForm.servico.trim()) { toast.error("Descreva o serviço."); return; }
    if (!naForm.data_solicitacao) { toast.error("Informe a data de solicitação."); return; }
    if (!valor) { toast.error("Informe o valor previsto."); return; }
    if (!parcelas || parcelas <= 0) { toast.error("Número de parcelas inválido."); return; }
    startTransition(async () => {
      const result = await criarAprovacao({
        operacao: naForm.operacao,
        categoria: naForm.categoria,
        local: naForm.local,
        andar: naForm.andar,
        prioridade: naForm.prioridade,
        servico: naForm.servico.trim(),
        data_solicitacao: naForm.data_solicitacao,
        valor_previsto: valor,
        forma_pagamento: naForm.forma_pagamento,
        numero_parcelas: parcelas,
      });
      if (!result.ok) { toast.error(result.error); return; }
      setDrawerAberto(null);
      toast.success("Aprovação criada.");
      router.refresh();
    });
  }

  function handleDefinirAprovacao(id: string, status: AprovadoStatus) {
    startTransition(async () => {
      const result = await definirAprovacao(id, status);
      if (!result.ok) { toast.error(result.error); return; }
      router.refresh();
    });
  }

  function abrirEdicaoDetalhes(a: AprovacaoComParcelas) {
    setEditandoDetalhesId(a.id);
    setDetalhesForm({
      data_execucao: a.data_execucao ?? "",
      garantia_dias: a.garantia_dias != null ? String(a.garantia_dias) : "",
      numero_nota_fiscal: a.numero_nota_fiscal ?? "",
      observacoes: a.observacoes ?? "",
    });
  }

  function handleSalvarDetalhes(id: string) {
    startTransition(async () => {
      const result = await atualizarAprovacao(id, {
        data_execucao: detalhesForm.data_execucao || null,
        garantia_dias: detalhesForm.garantia_dias ? parseInt(detalhesForm.garantia_dias, 10) : null,
        numero_nota_fiscal: detalhesForm.numero_nota_fiscal || null,
        observacoes: detalhesForm.observacoes || null,
      });
      if (!result.ok) { toast.error(result.error); return; }
      setEditandoDetalhesId(null);
      toast.success("Detalhes salvos.");
      router.refresh();
    });
  }

  function handleExcluirAprovacao(id: string) {
    startTransition(async () => {
      const result = await excluirAprovacao(id);
      if (!result.ok) { toast.error(result.error); return; }
      setExcluindoAprovacaoId(null);
      toast.success("Aprovação excluída.");
      router.refresh();
    });
  }

  function handleTogglePago(parcelaId: string, pago: boolean) {
    startTransition(async () => {
      const result = await marcarParcelaPaga(parcelaId, pago, pago ? todayInputValue() : null);
      if (!result.ok) { toast.error(result.error); return; }
      router.refresh();
    });
  }

  function handleAnexar(parcelaId: string, file: File) {
    setUploadingParcelaId(parcelaId);
    startTransition(async () => {
      const result = await anexarComprovante(parcelaId, file);
      setUploadingParcelaId(null);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Comprovante anexado.");
      router.refresh();
    });
  }

  function handleRemoverComprovante(parcelaId: string) {
    startTransition(async () => {
      const result = await removerComprovante(parcelaId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Comprovante removido.");
      router.refresh();
    });
  }

  function handleVerComprovante(parcelaId: string) {
    startTransition(async () => {
      const result = await gerarUrlComprovante(parcelaId);
      if (!result.ok) { toast.error(result.error); return; }
      window.open(result.data, "_blank");
    });
  }

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* ABAS */}
      <nav style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        {([
          { key: "diario", label: "🔧 Preenchimento Diário" },
          { key: "aprovacao", label: "✅ Preenchimento Aprovação" },
        ] as const).map((t) => (
          <button key={t.key} type="button" onClick={() => setAba(t.key)}
            style={{ flex: 1, height: 52, minHeight: 44, border: "none", borderBottom: aba === t.key ? "2px solid var(--brand)" : "2px solid transparent", background: "none", color: aba === t.key ? "var(--text)" : "var(--text-3)", fontWeight: aba === t.key ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, padding: "16px" }}>

        {/* ══ ABA DIÁRIO ══════════════════════════════════════════════════ */}
        {aba === "diario" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Cards de resumo */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <KpiCard label="Abertos" value={resumoChamados.abertos} />
              <KpiCard label="Em andamento" value={resumoChamados.emAndamento} color="#F59E0B" />
              <KpiCard label="Concluídos no mês" value={resumoChamados.concluidosNoMes} color="#22C55E" />
              <KpiCard label="P.0 pendentes" value={resumoChamados.p0Pendentes} color="#EF4444" />
            </div>

            {/* Barra de filtros */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input type="search" placeholder="Buscar por serviço ou motivo…" value={chBusca} onChange={(e) => setChBusca(e.target.value)}
                style={{ flex: "1 1 220px", height: 44, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, padding: "0 12px", outline: "none" }} />
              <select value={chFiltroCategoria} onChange={(e) => setChFiltroCategoria(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 140 }}>
                <option value="">Categoria</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={chFiltroLocal} onChange={(e) => setChFiltroLocal(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 140 }}>
                <option value="">Local</option>
                {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={chFiltroPrioridade} onChange={(e) => setChFiltroPrioridade(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 120 }}>
                <option value="">Prioridade</option>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={chFiltroStatus} onChange={(e) => setChFiltroStatus(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 150 }}>
                <option value="">Status</option>
                <option value="aberto">Aberto</option>
                <option value="em_andamento">Em andamento</option>
                <option value="em_aprovacao">Em aprovação</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <input type="date" value={chFiltroDataInicio} onChange={(e) => setChFiltroDataInicio(e.target.value)} style={{ ...fieldInput, width: "auto" }} />
              <input type="date" value={chFiltroDataFim} onChange={(e) => setChFiltroDataFim(e.target.value)} style={{ ...fieldInput, width: "auto" }} />
              <button type="button" onClick={abrirNovoChamado}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 44, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Plus size={16} /> Novo Chamado
              </button>
            </div>

            {/* Tabela de chamados */}
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Prioridade", "Data Solic.", "Categoria", "Local", "Andar", "Serviço", "Motivo", "Executado por", "Data Execução", "Status", "Ações"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, padding: "10px 12px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chamadosFiltrados.length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: "32px 12px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Nenhum chamado encontrado.</td></tr>
                  ) : chamadosFiltrados.map((c) => (
                    <Fragment key={c.id}>
                      <tr style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px" }}><PrioridadeBadge prioridade={c.prioridade} /></td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap" }}>{formatDateBR(c.data_solicitacao)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)" }}>{c.categoria}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)" }}>{c.local}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)" }}>{c.andar}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text)", maxWidth: 220 }}>{c.servico}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-3)", maxWidth: 200 }}>{c.motivo || "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)" }}>{c.executado_por ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap" }}>{formatDateBR(c.data_execucao)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {c.status === "aberto" || c.status === "em_andamento" ? (
                            <select value={c.status} onChange={(e) => handleMudarStatus(c.id, e.target.value as ChamadoStatus)}
                              style={{ height: 32, fontSize: 11, fontWeight: 700, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", padding: "0 6px" }}>
                              <option value="aberto">Aberto</option>
                              <option value="em_andamento">Em andamento</option>
                            </select>
                          ) : <StatusChamadoBadge status={c.status} />}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {c.status !== "concluido" && c.status !== "cancelado" && (
                              <button type="button" onClick={() => { setConcluirRowId(concluirRowId === c.id ? null : c.id); setExecutadoPorInput(c.executado_por ?? ""); setDataExecucaoInput(todayInputValue()); }} style={smallActionBtn}>✓ Concluir</button>
                            )}
                            {c.status !== "em_aprovacao" && c.status !== "concluido" && c.status !== "cancelado" && (
                              <button type="button" onClick={() => abrirEnviarAprovacao(c)} style={smallActionBtn}>💰 Enviar p/ Aprovação</button>
                            )}
                            {excluindoChamadoId === c.id ? (
                              <>
                                <button type="button" onClick={() => handleExcluirChamado(c.id)} disabled={isPending} style={{ ...smallActionBtn, background: "#7F1D1D", color: "#FCA5A5", border: "none" }}>Confirmar</button>
                                <button type="button" onClick={() => setExcluindoChamadoId(null)} style={smallActionBtn}>Cancelar</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setExcluindoChamadoId(c.id)} style={smallActionBtn}>🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {concluirRowId === c.id && (
                        <tr>
                          <td colSpan={11} style={{ background: "var(--surface-2)", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                              <div style={{ minWidth: 220 }}>
                                <div style={fieldLabel}>Executado por *</div>
                                <input type="text" value={executadoPorInput} onChange={(e) => setExecutadoPorInput(e.target.value)} placeholder="Nome de quem executou" style={fieldInput} autoFocus />
                              </div>
                              <div>
                                <div style={fieldLabel}>Data execução *</div>
                                <input type="date" value={dataExecucaoInput} onChange={(e) => setDataExecucaoInput(e.target.value)} style={fieldInput} />
                              </div>
                              <button type="button" onClick={() => handleConcluir(c.id)} disabled={isPending}
                                style={{ height: 44, padding: "0 20px", background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer" }}>
                                Confirmar conclusão
                              </button>
                              <button type="button" onClick={() => setConcluirRowId(null)} style={smallActionBtn}>Cancelar</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ ABA APROVAÇÃO ═══════════════════════════════════════════════ */}
        {aba === "aprovacao" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Cards de resumo */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <KpiCard label="Total aprovado no mês" value={formatBRL(resumoAprovacoes.totalAprovadoNoMes)} color="#22C55E" />
              <KpiCard label="Pendentes de aprovação" value={resumoAprovacoes.pendentes} color="#F59E0B" />
              <KpiCard label="A pagar no mês" value={formatBRL(resumoAprovacoes.aPagarNoMes)} color="#EF4444" />
              <KpiCard label="Pago no mês" value={formatBRL(resumoAprovacoes.pagoNoMes)} />
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={apFiltroAprovado} onChange={(e) => setApFiltroAprovado(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 140 }}>
                <option value="">Aprovado?</option>
                <option value="SIM">Sim</option>
                <option value="NAO">Não</option>
                <option value="PENDENTE">Pendente</option>
              </select>
              <select value={apFiltroCategoria} onChange={(e) => setApFiltroCategoria(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 140 }}>
                <option value="">Categoria</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={apFiltroLocal} onChange={(e) => setApFiltroLocal(e.target.value)} style={{ ...fieldInput, width: "auto", minWidth: 140 }}>
                <option value="">Local</option>
                {LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <input type="date" value={apFiltroDataInicio} onChange={(e) => setApFiltroDataInicio(e.target.value)} style={{ ...fieldInput, width: "auto" }} />
              <input type="date" value={apFiltroDataFim} onChange={(e) => setApFiltroDataFim(e.target.value)} style={{ ...fieldInput, width: "auto" }} />
              <button type="button" onClick={abrirNovaAprovacao}
                style={{ display: "flex", alignItems: "center", gap: 6, height: 44, background: "var(--brand)", color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                <Plus size={16} /> Nova Aprovação
              </button>
            </div>

            {/* Lista de cards */}
            {aprovacoesFiltradas.length === 0 ? (
              <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "48px 0" }}>Nenhuma aprovação encontrada.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {aprovacoesFiltradas.map((a) => {
                  const isExpanded = expandedAprovacaoId === a.id;
                  const isEditandoDetalhes = editandoDetalhesId === a.id;
                  const totalParcelas = a.manutencao_parcelas.reduce((s, p) => s + Number(p.valor), 0);
                  const pagoParcelas = a.manutencao_parcelas.filter((p) => p.pago).reduce((s, p) => s + Number(p.valor), 0);
                  return (
                    <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => setExpandedAprovacaoId(isExpanded ? null : a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: 4 }}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                          <PrioridadeBadge prioridade={a.prioridade} />
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{a.categoria} · {a.local} · {a.andar}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", flex: 1, minWidth: 160 }}>{a.servico}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{formatBRL(a.valor_previsto)}</span>
                          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{a.forma_pagamento} · {a.numero_parcelas}x de {formatBRL(a.valor_parcela)}</span>
                          <AprovadoBadge aprovado={a.aprovado} />
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" onClick={() => handleDefinirAprovacao(a.id, "SIM")} disabled={isPending}
                              style={{ height: 36, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: a.aprovado === "SIM" ? "2px solid #22C55E" : "1px solid var(--border)", background: a.aprovado === "SIM" ? "#14532D" : "var(--surface-2)", color: a.aprovado === "SIM" ? "#86EFAC" : "var(--text-2)", cursor: "pointer" }}>
                              ✅ Aprovar
                            </button>
                            <button type="button" onClick={() => handleDefinirAprovacao(a.id, "NAO")} disabled={isPending}
                              style={{ height: 36, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: a.aprovado === "NAO" ? "2px solid #EF4444" : "1px solid var(--border)", background: a.aprovado === "NAO" ? "#7F1D1D" : "var(--surface-2)", color: a.aprovado === "NAO" ? "#FCA5A5" : "var(--text-2)", cursor: "pointer" }}>
                              ❌ Reprovar
                            </button>
                            <button type="button" onClick={() => handleDefinirAprovacao(a.id, "PENDENTE")} disabled={isPending}
                              style={{ height: 36, padding: "0 12px", fontSize: 12, fontWeight: 700, borderRadius: 8, border: a.aprovado === "PENDENTE" ? "2px solid var(--text-3)" : "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer" }}>
                              ⏸ Pendente
                            </button>
                          </div>
                          {a.aprovado === "SIM" && a.data_aprovacao && (
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Aprovado em {formatDateBR(a.data_aprovacao)}</span>
                          )}
                          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            {excluindoAprovacaoId === a.id ? (
                              <>
                                <button type="button" onClick={() => handleExcluirAprovacao(a.id)} disabled={isPending} style={{ ...smallActionBtn, background: "#7F1D1D", color: "#FCA5A5", border: "none" }}>Confirmar exclusão</button>
                                <button type="button" onClick={() => setExcluindoAprovacaoId(null)} style={smallActionBtn}>Cancelar</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setExcluindoAprovacaoId(a.id)} style={smallActionBtn}>🗑️ Excluir</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 14 }}>
                          {/* Detalhes editáveis */}
                          {isEditandoDetalhes ? (
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                              <div style={{ minWidth: 140 }}><Field label="Data execução"><input type="date" value={detalhesForm.data_execucao} onChange={(e) => setDetalhesForm((f) => ({ ...f, data_execucao: e.target.value }))} style={fieldInput} /></Field></div>
                              <div style={{ minWidth: 120 }}><Field label="Garantia (dias)"><input type="number" min="0" value={detalhesForm.garantia_dias} onChange={(e) => setDetalhesForm((f) => ({ ...f, garantia_dias: e.target.value }))} style={fieldInput} /></Field></div>
                              <div style={{ minWidth: 160 }}><Field label="Nº nota fiscal"><input type="text" value={detalhesForm.numero_nota_fiscal} onChange={(e) => setDetalhesForm((f) => ({ ...f, numero_nota_fiscal: e.target.value }))} style={fieldInput} /></Field></div>
                              <div style={{ flex: "1 1 220px" }}><Field label="Observações"><input type="text" value={detalhesForm.observacoes} onChange={(e) => setDetalhesForm((f) => ({ ...f, observacoes: e.target.value }))} style={fieldInput} /></Field></div>
                              <button type="button" onClick={() => handleSalvarDetalhes(a.id)} disabled={isPending} style={{ height: 44, padding: "0 16px", background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Salvar</button>
                              <button type="button" onClick={() => setEditandoDetalhesId(null)} style={smallActionBtn}>Cancelar</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--text-3)" }}>
                              <span>Execução: {formatDateBR(a.data_execucao)}</span>
                              <span>Garantia: {a.garantia_dias ? `${a.garantia_dias} dias (até ${formatDateBR(a.data_vence_garantia)})` : "—"}</span>
                              <span>NF: {a.numero_nota_fiscal ?? "—"}</span>
                              {a.observacoes && <span>Obs: {a.observacoes}</span>}
                              <button type="button" onClick={() => abrirEdicaoDetalhes(a)} style={{ ...smallActionBtn, height: 28 }}>✏️ Editar detalhes</button>
                            </div>
                          )}

                          {/* Grade de parcelas */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {a.manutencao_parcelas.map((p) => (
                              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", minWidth: 80 }}>Parcela {p.numero}/{a.numero_parcelas}</span>
                                <span style={{ fontSize: 12, color: "var(--text-3)", minWidth: 70 }}>{formatCompetencia(p.competencia)}</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", minWidth: 100 }}>{formatBRL(p.valor)}</span>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", cursor: "pointer", minHeight: 44 }}>
                                  <input type="checkbox" checked={p.pago} onChange={(e) => handleTogglePago(p.id, e.target.checked)} style={{ width: 18, height: 18 }} />
                                  Pago
                                </label>
                                {p.pago && <span style={{ fontSize: 12, color: "var(--text-3)" }}>em {formatDateBR(p.data_pagamento)}</span>}
                                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                                  {p.comprovante_nome ? (
                                    <>
                                      <span style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.comprovante_nome}</span>
                                      <button type="button" onClick={() => handleVerComprovante(p.id)} title="Ver comprovante" style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", cursor: "pointer" }}><Eye size={16} /></button>
                                      <button type="button" onClick={() => handleRemoverComprovante(p.id)} title="Remover comprovante" style={{ height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "#EF4444", cursor: "pointer" }}><Trash2 size={16} /></button>
                                    </>
                                  ) : (
                                    <label style={{ height: 36, padding: "0 12px", display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 12, fontWeight: 600, cursor: uploadingParcelaId === p.id ? "not-allowed" : "pointer", opacity: uploadingParcelaId === p.id ? 0.5 : 1 }}>
                                      <Paperclip size={14} />
                                      {uploadingParcelaId === p.id ? "Enviando…" : "Anexar comprovante"}
                                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} disabled={uploadingParcelaId === p.id}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAnexar(p.id, f); e.target.value = ""; }} />
                                    </label>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Rodapé */}
                          <div style={{ display: "flex", gap: 24, fontSize: 13, fontWeight: 700, color: "var(--text-2)", paddingTop: 4 }}>
                            <span>Total: {formatBRL(totalParcelas)}</span>
                            <span style={{ color: "#22C55E" }}>Pago: {formatBRL(pagoParcelas)}</span>
                            <span style={{ color: "#F59E0B" }}>Em aberto: {formatBRL(totalParcelas - pagoParcelas)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fluxo de caixa */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Fluxo de caixa por competência</div>
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Mês", "Previsto", "Pago", "Em aberto"].map((h) => (
                        <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, padding: "10px 12px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fluxoCaixa.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: "24px 12px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Sem parcelas lançadas.</td></tr>
                    ) : fluxoCaixa.map(([mes, v]) => (
                      <tr key={mes} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{formatCompetencia(`${mes}-01`)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text-2)" }}>{formatBRL(v.previsto)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#22C55E" }}>{formatBRL(v.pago)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: "#F59E0B" }}>{formatBRL(v.previsto - v.pago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ DRAWER: NOVO CHAMADO ═══════════════════════════════════════════ */}
      {drawerAberto === "novoChamado" && (
        <Drawer title="Novo Chamado" onClose={() => setDrawerAberto(null)}
          footer={<button type="button" onClick={handleCriarChamado} disabled={isPending} style={primaryBtn(isPending)}>{isPending ? "Criando…" : "Criar chamado"}</button>}>
          <Field label="Operação"><select value={chForm.operacao} onChange={(e) => setChForm((f) => ({ ...f, operacao: e.target.value }))} style={fieldInput}>{OPERACOES.map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="Categoria"><select value={chForm.categoria} onChange={(e) => setChForm((f) => ({ ...f, categoria: e.target.value }))} style={fieldInput}>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Local"><select value={chForm.local} onChange={(e) => setChForm((f) => ({ ...f, local: e.target.value }))} style={fieldInput}>{LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}</select></Field>
          <Field label="Andar"><select value={chForm.andar} onChange={(e) => setChForm((f) => ({ ...f, andar: e.target.value }))} style={fieldInput}>{ANDARES.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label="Prioridade"><select value={chForm.prioridade} onChange={(e) => setChForm((f) => ({ ...f, prioridade: e.target.value }))} style={fieldInput}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Data solicitação *"><input type="date" value={chForm.data_solicitacao} onChange={(e) => setChForm((f) => ({ ...f, data_solicitacao: e.target.value }))} style={fieldInput} /></Field>
          <Field label="Serviços *"><textarea rows={3} value={chForm.servico} onChange={(e) => setChForm((f) => ({ ...f, servico: e.target.value }))} placeholder="Descreva o serviço solicitado…" style={fieldTextarea} /></Field>
          <Field label="Motivo"><textarea rows={2} value={chForm.motivo} onChange={(e) => setChForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Motivo do chamado…" style={fieldTextarea} /></Field>
          <Field label="Valor previsto (opcional)"><input type="number" min="0" step="0.01" inputMode="decimal" value={chForm.valor_previsto} onChange={(e) => setChForm((f) => ({ ...f, valor_previsto: e.target.value }))} placeholder="R$ 0,00" style={fieldInput} /></Field>
        </Drawer>
      )}

      {/* ══ DRAWER: ENVIAR P/ APROVAÇÃO ════════════════════════════════════ */}
      {drawerAberto === "enviarAprovacao" && chamadoAlvo && (
        <Drawer title="Enviar para Aprovação" onClose={() => { setDrawerAberto(null); setChamadoAlvo(null); }}
          footer={<button type="button" onClick={handleEnviarAprovacao} disabled={isPending} style={primaryBtn(isPending)}>{isPending ? "Enviando…" : "Enviar para aprovação"}</button>}>
          <div style={{ fontSize: 13, color: "var(--text-2)", background: "var(--surface-2)", borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{chamadoAlvo.servico}</div>
            <div style={{ color: "var(--text-3)", fontSize: 12 }}>{chamadoAlvo.categoria} · {chamadoAlvo.local} · {chamadoAlvo.andar}</div>
          </div>
          <Field label="Valor previsto *"><input type="number" min="0" step="0.01" inputMode="decimal" value={efForm.valor_previsto} onChange={(e) => setEfForm((f) => ({ ...f, valor_previsto: e.target.value }))} placeholder="R$ 0,00" style={fieldInput} /></Field>
          <Field label="Forma de pagamento"><select value={efForm.forma_pagamento} onChange={(e) => setEfForm((f) => ({ ...f, forma_pagamento: e.target.value }))} style={fieldInput}>{FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}</select></Field>
          <Field label="Nº parcelas *"><input type="number" min="1" step="1" value={efForm.numero_parcelas} onChange={(e) => setEfForm((f) => ({ ...f, numero_parcelas: e.target.value }))} style={fieldInput} /></Field>
        </Drawer>
      )}

      {/* ══ DRAWER: NOVA APROVAÇÃO AVULSA ══════════════════════════════════ */}
      {drawerAberto === "novaAprovacao" && (
        <Drawer title="Nova Aprovação" onClose={() => setDrawerAberto(null)}
          footer={<button type="button" onClick={handleCriarAprovacao} disabled={isPending} style={primaryBtn(isPending)}>{isPending ? "Criando…" : "Criar aprovação"}</button>}>
          <Field label="Operação"><select value={naForm.operacao} onChange={(e) => setNaForm((f) => ({ ...f, operacao: e.target.value }))} style={fieldInput}>{OPERACOES.map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
          <Field label="Categoria"><select value={naForm.categoria} onChange={(e) => setNaForm((f) => ({ ...f, categoria: e.target.value }))} style={fieldInput}>{CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Local"><select value={naForm.local} onChange={(e) => setNaForm((f) => ({ ...f, local: e.target.value }))} style={fieldInput}>{LOCAIS.map((l) => <option key={l} value={l}>{l}</option>)}</select></Field>
          <Field label="Andar"><select value={naForm.andar} onChange={(e) => setNaForm((f) => ({ ...f, andar: e.target.value }))} style={fieldInput}>{ANDARES.map((a) => <option key={a} value={a}>{a}</option>)}</select></Field>
          <Field label="Prioridade"><select value={naForm.prioridade} onChange={(e) => setNaForm((f) => ({ ...f, prioridade: e.target.value }))} style={fieldInput}>{PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Serviço *"><textarea rows={3} value={naForm.servico} onChange={(e) => setNaForm((f) => ({ ...f, servico: e.target.value }))} style={fieldTextarea} /></Field>
          <Field label="Data solicitação *"><input type="date" value={naForm.data_solicitacao} onChange={(e) => setNaForm((f) => ({ ...f, data_solicitacao: e.target.value }))} style={fieldInput} /></Field>
          <Field label="Valor previsto *"><input type="number" min="0" step="0.01" inputMode="decimal" value={naForm.valor_previsto} onChange={(e) => setNaForm((f) => ({ ...f, valor_previsto: e.target.value }))} placeholder="R$ 0,00" style={fieldInput} /></Field>
          <Field label="Forma de pagamento"><select value={naForm.forma_pagamento} onChange={(e) => setNaForm((f) => ({ ...f, forma_pagamento: e.target.value }))} style={fieldInput}>{FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}</select></Field>
          <Field label="Nº parcelas *"><input type="number" min="1" step="1" value={naForm.numero_parcelas} onChange={(e) => setNaForm((f) => ({ ...f, numero_parcelas: e.target.value }))} style={fieldInput} /></Field>
        </Drawer>
      )}
    </div>
  );
}
