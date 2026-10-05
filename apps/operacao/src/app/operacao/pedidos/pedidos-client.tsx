"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, X, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import type { PurchaseOrderItemRow, PurchaseOrderStatus } from "@kph/db/types/database";
import {
  criarPedido,
  deletarPedido,
  salvarRascunhoRecebimento,
  finalizarRecebimento,
  salvarRascunhoPedido,
} from "./actions";
import type {
  ProdutoCatalogo,
  PedidoComItens,
  PedidoParaRecebimento,
  RecebimentoItemInput,
} from "./actions";

// ── Constantes e helpers ─────────────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  proteina: "Proteína",
  verdura: "Verdura",
  legume: "Legume",
  fruta: "Fruta",
  graos: "Grãos e Cereais",
  laticinios: "Laticínios",
  panificacao: "Panificação",
  bebida_alcoolica: "Bebidas Alcoólicas",
  bebida_nao_alcoolica: "Bebidas Não Alcoólicas",
  tempero: "Tempero",
  oleo_gordura: "Óleo / Gordura",
  descartavel: "Descartável",
  limpeza: "Limpeza",
  outro: "Outros",
  hortifruti: "Hortifruti",
  proteinas: "Proteínas",
  secos: "Secos",
};

const STATUS_CONF = {
  ok:           { border: "#22C55E", emoji: "🟢", label: "OK" },
  parcial:      { border: "#F59E0B", emoji: "🟡", label: "Parcial" },
  nao_recebido: { border: "#EF4444", emoji: "🔴", label: "Não recebido" },
} as const;

function getCatEmoji(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("hortifruti")) return "🥬";
  if (c.includes("fruta") && !c.includes("fruto")) return "🍎";
  if (c.includes("bovino") || c.includes("proteina") || c.includes("carnes")) return "🥩";
  if (c.includes("queijo") || c.includes("latic")) return "🧀";
  if (c.includes("embutido")) return "🥓";
  if (c.includes("pescado") || c.includes("fruto")) return "🐟";
  if (c.includes("pao") || c.includes("pão") || c.includes("massa") || c.includes("salg")) return "🍞";
  if (c.includes("seco") || c.includes("conserva") || c.includes("grao") || c.includes("grão") || c.includes("panific")) return "🌾";
  if (c.includes("chopp") || c.includes("cerveja")) return "🍺";
  if (c.includes("vinho") || c.includes("destilado")) return "🍷";
  if ((c.includes("nao") || c.includes("não")) && c.includes("alco")) return "🧃";
  if (c.includes("alco")) return "🍷";
  if (c.includes("agua") || c.includes("água") || c.includes("cafe") || c.includes("café") || c.includes("lanche") || c.includes("suco")) return "☕";
  if (c.includes("bebida")) return "🧃";
  if (c.includes("alimenta") || c.includes("func")) return "🍱";
  if (c.includes("limpeza")) return "🧹";
  if (c.includes("descartav")) return "🗑️";
  if (c.includes("higiene")) return "🧴";
  if (c.includes("uniforme") || c.includes("epi")) return "👕";
  if (c.includes("escrit")) return "📎";
  if (c.includes("sistema") || c.includes("software")) return "💻";
  if (c.includes("combustivel") || c.includes("combustível")) return "⛽";
  return "📦";
}

const SUPPORTED_UNITS = ["kg", "g", "l", "ml", "un"] as const;
type SupportedUnit = (typeof SUPPORTED_UNITS)[number];

function normalizeUnidade(u: string): SupportedUnit {
  const lower = u.toLowerCase().trim();
  if ((SUPPORTED_UNITS as readonly string[]).includes(lower)) return lower as SupportedUnit;
  return "kg";
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split("-").map(Number);
      return new Date(parts[0]!, parts[1]! - 1, parts[2]!).toLocaleDateString("pt-BR");
    }
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function groupItemsByCategoria(
  items: PurchaseOrderItemRow[],
  produtosPorNome: Map<string, ProdutoCatalogo>,
): Map<string, PurchaseOrderItemRow[]> {
  const groups = new Map<string, PurchaseOrderItemRow[]>();
  for (const item of items) {
    const cat = produtosPorNome.get(item.nome)?.categoria ?? "";
    const label = (LABEL_MAP[cat] ?? cat) || "Outros";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return groups;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  unit: { id: string; name: string; brand_id: string | null };
  userId: string;
  produtos: ProdutoCatalogo[];
  pedidosIniciais: PedidoComItens[];
  pedidosParaRecebimento: PedidoParaRecebimento[];
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const map: Record<PurchaseOrderStatus, { background: string; color: string }> = {
    enviado:   { background: "#1D4ED8", color: "#fff" },
    recebido:  { background: "#15803D", color: "#fff" },
    parcial:   { background: "#92400E", color: "#fff" },
    cancelado: { background: "#7F1D1D", color: "#fff" },
    rascunho:  { background: "var(--surface-3)", color: "var(--text-3)" },
  };
  const s = map[status] ?? map.rascunho;
  return (
    <span style={{ ...s, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700, display: "inline-block", flexShrink: 0 }}>
      {status}
    </span>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export function PedidosClient({ unit, produtos, pedidosIniciais, pedidosParaRecebimento }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRecebendoPending, startRecebendoTransition] = useTransition();
  const [isSalvandoPending, startSalvandoTransition] = useTransition();
  const [isSalvandoPedido, startSalvandoPedidoTransition] = useTransition();

  // ── Abas ──
  const [abaAtiva, setAbaAtiva] = useState<"pedidos" | "recebimento" | "historico">("pedidos");

  // ── Estado do formulário de pedidos ──
  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria))].sort(), [produtos]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | null>(categorias[0] ?? null);
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState<Record<string, number>>({});
  const [unidades, setUnidades] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [solicitanteNome, setSolicitanteNome] = useState("");
  const [rascunhoId, setRascunhoId] = useState<string | null>(null);

  // ── Estado do histórico ──
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  // ── Estado do recebimento ──
  const [pedidoConferencia, setPedidoConferencia] = useState<PedidoParaRecebimento | null>(null);
  const [qtdsRecebidas, setQtdsRecebidas] = useState<Record<string, number>>({});
  const [obsItens, setObsItens] = useState<Record<string, string>>({});
  const [obsGeralRecebimento, setObsGeralRecebimento] = useState("");
  const [recebidosLocal, setRecebidosLocal] = useState<string[]>([]);
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null);
  const [isFinalizarModalAberto, setIsFinalizarModalAberto] = useState(false);
  const [isRascunhoModalAberto, setIsRascunhoModalAberto] = useState(false);
  const [assinaturaNome, setAssinaturaNome] = useState("");

  // ── Dados derivados ──
  const carrinho = useMemo(
    () => Object.entries(qtds).filter(([, v]) => v > 0).map(([nome, quantidade]) => ({
      ingrediente_id: nome, nome, quantidade, unidade: unidades[nome] ?? "kg",
    })),
    [qtds, unidades],
  );

  const produtosPorNome = useMemo(() => new Map(produtos.map((p) => [p.nome, p])), [produtos]);

  const pedidosVisiveis = useMemo(
    () => pedidosIniciais
      .filter((p) => !deletedIds.includes(p.id))
      .sort((a, b) => {
        if (a.status === "rascunho" && b.status !== "rascunho") return -1;
        if (a.status !== "rascunho" && b.status === "rascunho") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [pedidosIniciais, deletedIds],
  );

  const pedidosEmAndamento = useMemo(
    () => pedidosParaRecebimento.filter((p) => p.recebimento?.status === "rascunho"),
    [pedidosParaRecebimento],
  );
  const pedidosAguardando = useMemo(
    () => pedidosParaRecebimento.filter((p) => !p.recebimento && !recebidosLocal.includes(p.id)),
    [pedidosParaRecebimento, recebidosLocal],
  );
  const pedidosFinalizados = useMemo(
    () => pedidosParaRecebimento.filter((p) => p.recebimento?.status === "finalizado" || recebidosLocal.includes(p.id)),
    [pedidosParaRecebimento, recebidosLocal],
  );

  const produtosFiltrados = useMemo(() => {
    if (busca.trim() === "") {
      return categoriaAtiva ? produtos.filter((p) => p.categoria === categoriaAtiva) : [];
    }
    return produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase().trim()));
  }, [produtos, busca, categoriaAtiva]);

  // ── Handlers do formulário ──

  function getUnidade(prod: ProdutoCatalogo): string {
    return unidades[prod.nome] ?? normalizeUnidade(prod.unidade);
  }
  function handleCategoriaChange(cat: string) { setCategoriaAtiva(cat); setBusca(""); }
  function handleQtdChange(nome: string, val: string) {
    const n = parseFloat(val);
    setQtds((prev) => ({ ...prev, [nome]: isNaN(n) || n < 0 ? 0 : n }));
  }
  function handleIncrement(prod: ProdutoCatalogo) {
    setQtds((prev) => ({ ...prev, [prod.nome]: (prev[prod.nome] ?? 0) + 1 }));
  }
  function handleDecrement(prod: ProdutoCatalogo) {
    setQtds((prev) => ({ ...prev, [prod.nome]: Math.max(0, (prev[prod.nome] ?? 0) - 1) }));
  }
  function handleUnidadeChange(prod: ProdutoCatalogo, val: string) {
    setUnidades((prev) => ({ ...prev, [prod.nome]: val }));
  }
  function handleRemoverItem(nome: string) {
    setQtds((prev) => { const next = { ...prev }; delete next[nome]; return next; });
  }

  function resetCarrinho() {
    setQtds({});
    setUnidades({});
    setObservacoes("");
    setCarrinhoAberto(false);
    setRascunhoId(null);
  }

  function handleEnviar() {
    if (solicitanteNome.trim().length === 0) {
      toast.error("Informe seu nome antes de enviar");
      return;
    }
    startTransition(async () => {
      const itensParaEnviar = Object.entries(qtds)
        .filter(([, v]) => v > 0)
        .map(([nome, quantidade]) => ({
          ingrediente_id: nome, nome, quantidade, unidade: unidades[nome] ?? "kg",
        }));

      if (itensParaEnviar.length === 0) {
        toast.error("Adicione pelo menos um item ao pedido");
        return;
      }

      const result = await criarPedido(itensParaEnviar, observacoes || null, solicitanteNome.trim(), rascunhoId);

      if (!result.ok) { toast.error(result.error); return; }

      resetCarrinho();
      setSolicitanteNome("");
      toast.success("Pedido enviado com sucesso!");
      router.refresh();
    });
  }

  function handleSalvarRascunhoPedido() {
    if (solicitanteNome.trim() === "") {
      toast.error("Digite seu nome antes de salvar o rascunho");
      return;
    }
    startSalvandoPedidoTransition(async () => {
      const itensParaSalvar = Object.entries(qtds)
        .filter(([, v]) => v > 0)
        .map(([nome, quantidade]) => ({
          ingrediente_id: nome, nome, quantidade, unidade: unidades[nome] ?? "kg",
        }));

      if (itensParaSalvar.length === 0) {
        toast.error("Adicione pelo menos um item antes de salvar");
        return;
      }

      const result = await salvarRascunhoPedido(itensParaSalvar, solicitanteNome, observacoes || null);

      if (!result.ok) { toast.error(result.error); return; }

      setRascunhoId(result.data.pedidoId);
      resetCarrinho();
      toast.success("Rascunho salvo");
    });
  }

  function handleDescartarRascunho() {
    if (!rascunhoId) return;
    startTransition(async () => {
      const result = await deletarPedido(rascunhoId);
      if (result.ok) {
        setRascunhoId(null);
        toast.success("Rascunho descartado");
      } else { toast.error(result.error); }
    });
  }

  function handleCarregarRascunho(p: PedidoComItens) {
    const initQtds: Record<string, number> = {};
    const initUnidades: Record<string, string> = {};
    for (const item of p.purchase_order_items) {
      initQtds[item.nome] = Number(item.quantidade);
      initUnidades[item.nome] = item.unidade ?? "kg";
    }
    setQtds(initQtds);
    setUnidades(initUnidades);
    if (p.observacoes) setObservacoes(p.observacoes);
    if (p.solicitante_nome) setSolicitanteNome(p.solicitante_nome);
    setRascunhoId(p.id);
    setAbaAtiva("pedidos");
    toast("Rascunho carregado — continue seu pedido", { icon: "📝" });
  }

  // ── Handlers do histórico ──

  function handlePdfExport(p: PedidoComItens) {
    const groups = groupItemsByCategoria(p.purchase_order_items, produtosPorNome);
    let categoriesHtml = "";
    for (const [cat, items] of groups) {
      const rows = items.map((i) =>
        `<tr><td>${i.nome}</td><td style="text-align:center;width:60px">${i.quantidade}</td><td style="text-align:center;width:52px">${i.unidade ?? ""}</td></tr>`
      ).join("");
      categoriesHtml += `<div class="cat"><div class="cat-title">${cat} <span class="cat-count">(${items.length})</span></div><table><thead><tr><th>Item</th><th>Qtd</th><th>Un.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Requisição – ${unit.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}h1{font-size:20px;font-weight:800;margin-bottom:12px}.meta{display:flex;gap:32px;font-size:12px;color:#555;margin-bottom:16px;flex-wrap:wrap}.meta strong{color:#111}hr{border:none;border-top:2px solid #111;margin:16px 0 20px}.cat{margin-bottom:20px}.cat-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#333;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:8px}.cat-count{font-weight:400;color:#777}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;padding:3px 6px;border-bottom:1px solid #eee}td{padding:5px 6px;border-bottom:1px solid #f0f0f0;font-size:12px}.obs{background:#f7f7f7;border-left:3px solid #ccc;padding:10px 12px;margin-top:20px;font-size:12px;color:#555;font-style:italic}.footer{margin-top:32px;font-size:10px;color:#aaa;text-align:right;border-top:1px solid #eee;padding-top:8px}@media print{@page{margin:16mm}}</style></head><body><h1>REQUISIÇÃO DE COMPRAS</h1><div class="meta"><span><strong>Unidade:</strong> ${unit.name}</span><span><strong>Data:</strong> ${formatDateTime(p.data_pedido)}</span><span><strong>Nº:</strong> ${p.id.slice(0, 8).toUpperCase()}</span><span><strong>Status:</strong> ${p.status}</span>${p.solicitante_nome ? `<span><strong>Solicitado por:</strong> ${p.solicitante_nome}</span>` : ""}</div><hr>${categoriesHtml}${p.observacoes ? `<div class="obs">Obs: ${p.observacoes}</div>` : ""}<div class="footer">Gerado em ${new Date().toLocaleString("pt-BR")} via MARENA</div></body></html>`;
    const win = window.open("", "_blank", "width=820,height=680");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  async function handleDeleteConfirm(id: string) {
    setDeletingId(id);
    const result = await deletarPedido(id);
    setDeletingId(null);
    if (result.ok) {
      setDeletedIds((prev) => [...prev, id]);
      setConfirmingDelete(null); setDeleteChecked(false);
      toast.success("Pedido excluído.");
    } else { toast.error(result.error); }
  }

  // ── Handlers do recebimento ──

  function handleSelecionarPedido(p: PedidoParaRecebimento) {
    setPedidoConferencia(p);
    setRascunhoSalvoEm(null);
    setIsFinalizarModalAberto(false);
    setIsRascunhoModalAberto(false);
    setAssinaturaNome("");

    if (p.recebimento?.status === "finalizado") return;

    if (p.recebimento?.status === "rascunho") {
      const initQtds: Record<string, number> = {};
      const initObs: Record<string, string> = {};
      for (const ri of p.recebimento.recebimento_itens) {
        initQtds[ri.pedido_item_id] = ri.quantidade_recebida;
        if (ri.observacao) initObs[ri.pedido_item_id] = ri.observacao;
      }
      setQtdsRecebidas(initQtds);
      setObsItens(initObs);
      setObsGeralRecebimento(p.recebimento.observacao ?? "");
    } else {
      const initQtds: Record<string, number> = {};
      p.purchase_order_items.forEach((item) => { initQtds[item.id] = Number(item.quantidade); });
      setQtdsRecebidas(initQtds);
      setObsItens({});
      setObsGeralRecebimento("");
    }
  }

  function handleVoltarRecebimento() {
    setPedidoConferencia(null);
    setQtdsRecebidas({}); setObsItens({}); setObsGeralRecebimento("");
    setRascunhoSalvoEm(null); setIsFinalizarModalAberto(false); setIsRascunhoModalAberto(false); setAssinaturaNome("");
  }

  function getItemStatus(itemId: string, qtdPedida: number): "ok" | "parcial" | "nao_recebido" {
    const r = qtdsRecebidas[itemId] ?? qtdPedida;
    if (r <= 0) return "nao_recebido";
    if (r < qtdPedida) return "parcial";
    return "ok";
  }

  function buildItensPayload(): RecebimentoItemInput[] {
    if (!pedidoConferencia) return [];
    return pedidoConferencia.purchase_order_items.map((item) => ({
      pedido_item_id: item.id,
      nome: item.nome,
      quantidade_pedida: Number(item.quantidade),
      quantidade_recebida: qtdsRecebidas[item.id] ?? Number(item.quantidade),
      unidade: item.unidade ?? "kg",
      observacao: obsItens[item.id],
    }));
  }

  function handleSalvarRascunho() {
    if (!pedidoConferencia || assinaturaNome.trim().length === 0) return;
    startSalvandoTransition(async () => {
      const result = await salvarRascunhoRecebimento(
        pedidoConferencia.id,
        buildItensPayload(),
        obsGeralRecebimento || null,
        assinaturaNome.trim(),
      );
      if (result.ok) {
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        setRascunhoSalvoEm(hora);
        setIsRascunhoModalAberto(false);
        toast.success("Rascunho salvo — você pode continuar depois");
        router.refresh();
      } else { toast.error(result.error); }
    });
  }

  function handleFinalizarRecebimento() {
    if (!pedidoConferencia || assinaturaNome.trim().length === 0) return;
    startRecebendoTransition(async () => {
      const result = await finalizarRecebimento(
        pedidoConferencia.id,
        buildItensPayload(),
        obsGeralRecebimento || null,
        assinaturaNome.trim(),
      );
      if (result.ok) {
        setRecebidosLocal((prev) => [...prev, pedidoConferencia.id]);
        handleVoltarRecebimento();
        toast.success("Recebimento finalizado!");
        router.refresh();
      } else { toast.error(result.error); }
    });
  }

  function handlePdfRecebimento(p: PedidoParaRecebimento) {
    const rec = p.recebimento;
    if (!rec) return;
    const itens = rec.recebimento_itens;
    const pendentes = itens.filter((i) => i.status !== "ok");
    const isIntegral = pendentes.length === 0;

    const groups = new Map<string, typeof itens>();
    for (const ri of itens) {
      const cat = produtosPorNome.get(ri.nome)?.categoria ?? "";
      const label = (LABEL_MAP[cat] ?? cat) || "Outros";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(ri);
    }

    const statusLabel = (s: string) =>
      s === "ok" ? "✓ OK" : s === "parcial" ? "⚠ Parcial" : "✗ Não recebido";

    let categoriesHtml = "";
    for (const [cat, catItens] of groups) {
      const rows = catItens.map((i) =>
        `<tr><td>${i.nome}</td><td>${i.quantidade_pedida} ${i.unidade ?? ""}</td><td>${i.quantidade_recebida} ${i.unidade ?? ""}</td><td class="st-${i.status}">${statusLabel(i.status)}</td><td>${i.observacao ?? ""}</td></tr>`
      ).join("");
      categoriesHtml += `<div class="cat"><div class="cat-title">${cat}</div><table><thead><tr><th>Item</th><th>Pedido</th><th>Recebido</th><th>Status</th><th>Obs</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    const pendentesHtml = !isIntegral ? `<div class="section"><h2>ITENS PENDENTES</h2><table><thead><tr><th>Item</th><th>Pedido</th><th>Recebido</th><th>Diferença</th><th>Obs</th></tr></thead><tbody>${pendentes.map((i) => {
      const dif = i.quantidade_recebida - i.quantidade_pedida;
      return `<tr><td>${i.nome}</td><td>${i.quantidade_pedida} ${i.unidade ?? ""}</td><td>${i.quantidade_recebida} ${i.unidade ?? ""}</td><td class="st-nao_recebido">${dif > 0 ? "+" : ""}${dif} ${i.unidade ?? ""}</td><td>${i.observacao ?? ""}</td></tr>`;
    }).join("")}</tbody></table></div>` : "";

    const statusGlobal = isIntegral
      ? `<div class="status-ok">✓ PEDIDO RECEBIDO INTEGRALMENTE</div>`
      : `<div class="status-parcial">⚠ RECEBIMENTO PARCIAL — ${pendentes.length} ${pendentes.length === 1 ? "item pendente" : "itens pendentes"}</div>`;

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Recebimento – ${unit.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px}h1{font-size:20px;font-weight:800;margin-bottom:4px}.sub{font-size:12px;color:#555;margin-bottom:20px}.meta-table{border-collapse:collapse;margin-bottom:20px;font-size:13px}.meta-table td{padding:4px 16px 4px 0}.meta-table td:first-child{font-weight:600;color:#555;white-space:nowrap}hr{border:none;border-top:2px solid #111;margin:0 0 24px}.section{margin-bottom:28px}h2{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#333;border-bottom:1px solid #ddd;padding-bottom:6px;margin-bottom:10px}.cat{margin-bottom:20px}.cat-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#333;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:8px}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;font-weight:700;color:#888;text-transform:uppercase;padding:3px 6px;border-bottom:1px solid #eee}td{padding:5px 6px;border-bottom:1px solid #f0f0f0;font-size:12px}.st-ok{color:#15803D;font-weight:700}.st-parcial{color:#92400E;font-weight:700}.st-nao_recebido{color:#7F1D1D;font-weight:700}.status-ok{background:#DCFCE7;border:1px solid #BBF7D0;border-radius:6px;padding:12px 16px;font-size:13px;font-weight:700;color:#15803D;margin-bottom:20px}.status-parcial{background:#FEF3C7;border:1px solid #FDE68A;border-radius:6px;padding:12px 16px;font-size:13px;font-weight:700;color:#92400E;margin-bottom:20px}.assinatura{margin-top:40px;border-top:1px solid #ddd;padding-top:20px}.assinatura .linha{border-bottom:1px solid #111;width:260px;height:24px;margin-bottom:4px}.assinatura .nome{font-size:12px;font-weight:700;color:#333}.assinatura .data{font-size:11px;color:#666;margin-top:4px}.footer-pdf{margin-top:32px;font-size:10px;color:#aaa;text-align:right;border-top:1px solid #eee;padding-top:8px}.watermark{background:#FEE2E2;border:2px solid #EF4444;border-radius:6px;padding:10px 16px;margin-bottom:20px;color:#7F1D1D;font-size:13px;font-weight:700;text-align:center;letter-spacing:.5px}@media print{@page{margin:16mm}}</style></head><body>${rec.status === "rascunho" ? '<div class="watermark">⚠ RASCUNHO — Recebimento não finalizado</div>' : ""}<h1>RELATÓRIO DE RECEBIMENTO</h1><div class="sub">${unit.name}</div><hr><table class="meta-table"><tr><td>Pedido #</td><td>${p.id.slice(0, 8).toUpperCase()}</td></tr><tr><td>Data do pedido</td><td>${formatDateTime(p.data_pedido)}</td></tr><tr><td>Data do recebimento</td><td>${formatDateTime(rec.created_at)}</td></tr><tr><td>Recebido por</td><td>${rec.assinatura_nome ?? "—"}</td></tr></table><div class="section"><h2>Itens por categoria</h2>${categoriesHtml}</div>${pendentesHtml}${statusGlobal}<div class="assinatura"><div class="linha"></div><div class="nome">${rec.assinatura_nome ?? ""}</div><div class="data">Data: ${formatDateTime(rec.created_at)}</div></div><div class="footer-pdf">Gerado via MARENA</div></body></html>`;

    const win = window.open("", "_blank", "width=820,height=680");
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  }

  // ── Derivados inline ──

  const totalItens = carrinho.length;
  const footerResumo = totalItens === 0
    ? "Nenhum item adicionado"
    : carrinho.slice(0, 2).map((i) => i.nome).join(", ") + (totalItens > 2 ? ` +${totalItens - 2}` : "");

  const conferenceSummary = pedidoConferencia
    ? pedidoConferencia.purchase_order_items.reduce(
        (acc, item) => { acc[getItemStatus(item.id, Number(item.quantidade))]++; return acc; },
        { ok: 0, parcial: 0, nao_recebido: 0 },
      )
    : null;

  const smallBtn = (active = true, danger = false) => ({
    height: 32, padding: "0 12px", fontSize: 12, fontWeight: 600,
    border: "1px solid var(--border)", borderRadius: 6,
    background: danger ? "#7F1D1D" : "var(--surface-2)",
    color: danger ? "#FCA5A5" : active ? "var(--text-2)" : "var(--text-3)",
    cursor: active ? "pointer" : "not-allowed" as const,
    opacity: active ? 1 : 0.4, whiteSpace: "nowrap" as const, flexShrink: 0,
  });

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ABAS */}
      <nav style={{ flexShrink: 0, display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        {(["pedidos", "recebimento", "historico"] as const).map((aba) => (
          <button key={aba} type="button" onClick={() => setAbaAtiva(aba)}
            style={{ flex: 1, height: 48, border: "none", borderBottom: abaAtiva === aba ? "2px solid var(--brand)" : "2px solid transparent", background: "none", color: abaAtiva === aba ? "var(--text)" : "var(--text-3)", fontWeight: abaAtiva === aba ? 700 : 500, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            {aba === "pedidos" ? "📋 Novo Pedido" : aba === "recebimento" ? "📦 Recebimento" : "🕓 Histórico"}
          </button>
        ))}
      </nav>

      {/* CONTEÚDO DAS ABAS */}
      <div style={{ flex: 1, overflow: "hidden" }}>

        {/* ── ABA PEDIDOS ──────────────────────────────────────────────── */}
        {abaAtiva === "pedidos" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <header style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
              <input type="search" placeholder="Buscar produto…" value={busca} onChange={(e) => setBusca(e.target.value)}
                style={{ flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 15, padding: "10px 14px", outline: "none" }} />
              {totalItens > 0 && (
                <button type="button" onClick={handleSalvarRascunhoPedido} disabled={isSalvandoPedido}
                  style={{ height: 36, padding: "0 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 12, fontWeight: 600, cursor: isSalvandoPedido ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, opacity: isSalvandoPedido ? 0.5 : 1 }}>
                  {isSalvandoPedido ? "Salvando…" : "💾 Rascunho"}
                </button>
              )}
              <button type="button" onClick={() => setCarrinhoAberto(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, height: 44, background: totalItens > 0 ? "var(--brand)" : "var(--surface-2)", color: totalItens > 0 ? "#fff" : "var(--text-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                <ShoppingBag size={18} />
                {totalItens > 0 ? `Carrinho (${totalItens})` : "Carrinho"}
              </button>
            </header>

            <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
              {/* Categorias */}
              <nav style={{ width: 160, flexShrink: 0, overflowY: "auto", borderRight: "1px solid var(--border)", background: "var(--surface)", padding: "8px 6px" }}>
                {categorias.length === 0 ? (
                  <div style={{ padding: 12, color: "var(--text-3)", fontSize: 12, textAlign: "center" }}>Nenhum produto.</div>
                ) : categorias.map((cat) => {
                  const isActive = cat === categoriaAtiva;
                  return (
                    <button key={cat} type="button" onClick={() => handleCategoriaChange(cat)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", minHeight: 72, padding: "10px 8px", marginBottom: 4, background: isActive ? "var(--brand)" : "var(--surface-2)", border: "none", borderRadius: 10, color: isActive ? "#fff" : "var(--text-2)", cursor: "pointer", textAlign: "center" }}>
                      <span style={{ fontSize: 28, lineHeight: 1 }}>{getCatEmoji(cat)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3, whiteSpace: "normal", wordBreak: "break-word" }}>{LABEL_MAP[cat] ?? cat}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Produtos */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {!categoriaAtiva && busca.trim() === "" ? (
                  <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", paddingTop: 48 }}>Selecione uma categoria.</div>
                ) : produtosFiltrados.length === 0 ? (
                  <div style={{ color: "var(--text-3)", fontSize: 14, textAlign: "center", paddingTop: 48 }}>Nenhum produto encontrado.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {produtosFiltrados.map((prod) => {
                      const qty = qtds[prod.nome] ?? 0;
                      const inCart = qty > 0;
                      return (
                        <div key={prod.nome} style={{ minHeight: 72, padding: "14px 16px", background: "var(--surface)", border: inCart ? "1px solid var(--brand)" : "1px solid var(--border)", borderLeft: inCart ? "3px solid var(--brand)" : "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{prod.nome}</span>
                            {busca.trim() !== "" && (
                              <span style={{ fontSize: 11, color: "var(--text-3)" }}>{LABEL_MAP[prod.categoria] ?? prod.categoria}</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            <button type="button" onClick={() => handleDecrement(prod)} disabled={qty <= 0}
                              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", color: "var(--text)", fontSize: 20, fontWeight: 700, flexShrink: 0, cursor: qty <= 0 ? "not-allowed" : "pointer", opacity: qty <= 0 ? 0.3 : 1 }}>−</button>
                            <input type="number" inputMode="decimal" min="0" step="any" value={qty === 0 ? "" : qty} placeholder="0"
                              onChange={(e) => handleQtdChange(prod.nome, e.target.value)}
                              style={{ width: 52, height: 44, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", padding: "0 4px" }} />
                            <button type="button" onClick={() => handleIncrement(prod)}
                              style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", color: "var(--text)", fontSize: 20, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
                            <select value={getUnidade(prod)} onChange={(e) => handleUnidadeChange(prod, e.target.value)}
                              style={{ height: 44, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 13, fontWeight: 600, padding: "0 6px", outline: "none", flexShrink: 0 }}>
                              <option value="kg">kg</option><option value="g">g</option>
                              <option value="l">l</option><option value="ml">ml</option><option value="un">un</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <footer style={{ height: 72, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 16px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <span style={{ fontSize: 13, color: totalItens > 0 ? "var(--text-2)" : "var(--text-3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{footerResumo}</span>
              <button type="button" onClick={() => setCarrinhoAberto(true)} disabled={totalItens === 0}
                style={{ height: 48, minWidth: 160, background: "#22C55E", color: "#fff", border: "none", borderRadius: 10, padding: "0 24px", fontSize: 15, fontWeight: 700, cursor: totalItens === 0 ? "not-allowed" : "pointer", opacity: totalItens === 0 ? 0.4 : 1, flexShrink: 0, whiteSpace: "nowrap" }}>
                Revisar e Enviar
              </button>
            </footer>
          </div>
        )}

        {/* ── ABA RECEBIMENTO ──────────────────────────────────────────── */}
        {abaAtiva === "recebimento" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>

            {pedidoConferencia ? (() => {
              const rec = pedidoConferencia.recebimento;
              const isFinalizado = rec?.status === "finalizado";
              const isRascunho = rec?.status === "rascunho";
              const isEditMode = !isFinalizado;

              return (
                <>
                  {/* Header conferência */}
                  <header style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", minHeight: 64 }}>
                    <button type="button" onClick={handleVoltarRecebimento}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, marginTop: 2 }}>
                      <ArrowLeft size={15} /> Voltar
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                        {isFinalizado
                          ? `Finalizado em ${formatDateTime(rec?.created_at)}`
                          : `Recebendo: ${formatDateTime(pedidoConferencia.data_pedido)}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                        {isFinalizado
                          ? `Recebido por: ${rec?.assinatura_nome ?? "—"}`
                          : `${pedidoConferencia.purchase_order_items.length} itens · ${unit.name}`}
                      </div>
                      {isRascunho && (
                        <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 3, fontWeight: 600 }}>
                          🟠 Rascunho salvo em {rascunhoSalvoEm ?? formatDateTime(rec?.created_at)}
                        </div>
                      )}
                      {!isRascunho && rascunhoSalvoEm && (
                        <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 3, fontWeight: 600 }}>
                          🟠 Rascunho salvo às {rascunhoSalvoEm}
                        </div>
                      )}
                    </div>
                    {(isFinalizado || isRascunho) && (
                      <button type="button" onClick={() => handlePdfRecebimento(pedidoConferencia)}
                        style={{ display: "flex", alignItems: "center", gap: 6, height: 36, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                        📄 Relatório PDF
                      </button>
                    )}
                  </header>

                  {/* Corpo */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                    {isFinalizado && rec ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {rec.recebimento_itens.map((ri) => {
                          const conf = STATUS_CONF[ri.status as keyof typeof STATUS_CONF] ?? STATUS_CONF.ok;
                          return (
                            <div key={ri.id} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${conf.border}`, borderRadius: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{ri.nome}</span>
                                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{conf.emoji} {conf.label}</span>
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                                Pedido: {ri.quantidade_pedida} {ri.unidade ?? ""} · Recebido: {ri.quantidade_recebida} {ri.unidade ?? ""}
                              </div>
                              {ri.observacao && (
                                <div style={{ fontSize: 11, color: "var(--text-3)", fontStyle: "italic", marginTop: 4 }}>{ri.observacao}</div>
                              )}
                            </div>
                          );
                        })}
                        {rec.observacao && (
                          <div style={{ marginTop: 8, background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "3px solid var(--text-3)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
                            Obs geral: {rec.observacao}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {Array.from(groupItemsByCategoria(pedidoConferencia.purchase_order_items, produtosPorNome)).map(([cat, items]) => (
                          <div key={cat}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.7, paddingBottom: 6, marginBottom: 8, borderBottom: "1px solid var(--border)" }}>
                              {cat} ({items.length})
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {items.map((item: PurchaseOrderItemRow) => {
                                const qtdPedida = Number(item.quantidade);
                                const qtdRec = qtdsRecebidas[item.id] ?? qtdPedida;
                                const status = getItemStatus(item.id, qtdPedida);
                                const conf = STATUS_CONF[status];
                                const catProd = produtosPorNome.get(item.nome)?.categoria ?? "";
                                return (
                                  <div key={item.id} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderLeft: `3px solid ${conf.border}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                                      <div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.2 }}>{item.nome}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{LABEL_MAP[catProd] ?? catProd}</div>
                                        <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Pedido: {qtdPedida} {item.unidade ?? ""}</div>
                                      </div>
                                      <span style={{ fontSize: 12, color: "var(--text-2)", flexShrink: 0 }}>{conf.emoji} {conf.label}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>Recebido:</span>
                                      <button type="button"
                                        onClick={() => setQtdsRecebidas((p) => ({ ...p, [item.id]: Math.max(0, (p[item.id] ?? qtdPedida) - 1) }))}
                                        disabled={qtdRec <= 0}
                                        style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", color: "var(--text)", fontSize: 20, fontWeight: 700, cursor: qtdRec <= 0 ? "not-allowed" : "pointer", opacity: qtdRec <= 0 ? 0.3 : 1 }}>−</button>
                                      <input type="number" inputMode="decimal" min="0" step="any" value={qtdRec === 0 ? "" : qtdRec} placeholder="0"
                                        onChange={(e) => { const n = parseFloat(e.target.value); setQtdsRecebidas((p) => ({ ...p, [item.id]: isNaN(n) || n < 0 ? 0 : n })); }}
                                        style={{ width: 60, height: 44, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", padding: "0 4px" }} />
                                      <button type="button"
                                        onClick={() => setQtdsRecebidas((p) => ({ ...p, [item.id]: (p[item.id] ?? qtdPedida) + 1 }))}
                                        style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-2)", color: "var(--text)", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>+</button>
                                      <span style={{ fontSize: 12, color: "var(--text-3)" }}>{item.unidade ?? ""}</span>
                                    </div>
                                    <input type="text" placeholder="Obs: ex: chegou amassado…"
                                      value={obsItens[item.id] ?? ""}
                                      onChange={(e) => setObsItens((p) => ({ ...p, [item.id]: e.target.value }))}
                                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 12, padding: "7px 10px", outline: "none", width: "100%" }} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Observação geral</div>
                          <textarea rows={2} placeholder="Observações do recebimento (opcional)…"
                            value={obsGeralRecebimento}
                            onChange={(e) => setObsGeralRecebimento(e.target.value)}
                            style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "10px 12px", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer + modais inline — só em modo edição */}
                  {isEditMode && conferenceSummary && (
                    <>
                      {/* Modal inline: salvar rascunho */}
                      {isRascunhoModalAberto && (
                        <div style={{ flexShrink: 0, padding: "14px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>Nome de quem está recebendo *</div>
                          <input
                            type="text"
                            placeholder="Digite seu nome completo"
                            value={assinaturaNome}
                            onChange={(e) => setAssinaturaNome(e.target.value)}
                            autoFocus
                            style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, padding: "10px 12px", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => setIsRascunhoModalAberto(false)}
                              style={{ flex: 1, height: 44, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                              Cancelar
                            </button>
                            <button type="button"
                              onClick={handleSalvarRascunho}
                              disabled={assinaturaNome.trim().length === 0 || isSalvandoPending}
                              style={{ flex: 2, height: 44, background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: assinaturaNome.trim().length === 0 || isSalvandoPending ? "not-allowed" : "pointer", opacity: assinaturaNome.trim().length === 0 || isSalvandoPending ? 0.5 : 1 }}>
                              {isSalvandoPending ? "Salvando…" : "Salvar rascunho"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Modal inline: finalizar */}
                      {isFinalizarModalAberto && (
                        <div style={{ flexShrink: 0, padding: "14px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 8 }}>Nome de quem recebeu *</div>
                          <input
                            type="text"
                            placeholder="Digite seu nome completo"
                            value={assinaturaNome}
                            onChange={(e) => setAssinaturaNome(e.target.value)}
                            autoFocus
                            style={{ width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, padding: "10px 12px", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => setIsFinalizarModalAberto(false)}
                              style={{ flex: 1, height: 44, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                              Cancelar
                            </button>
                            <button type="button"
                              onClick={handleFinalizarRecebimento}
                              disabled={assinaturaNome.trim().length === 0 || isRecebendoPending}
                              style={{ flex: 2, height: 44, background: "#22C55E", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: assinaturaNome.trim().length === 0 || isRecebendoPending ? "not-allowed" : "pointer", opacity: assinaturaNome.trim().length === 0 || isRecebendoPending ? 0.5 : 1 }}>
                              {isRecebendoPending ? "Finalizando…" : "Confirmar e finalizar"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Footer com dois botões */}
                      <footer style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
                        <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>
                          🟢 {conferenceSummary.ok} · 🟡 {conferenceSummary.parcial} · 🔴 {conferenceSummary.nao_recebido}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button"
                            onClick={() => { setIsRascunhoModalAberto((v) => !v); setIsFinalizarModalAberto(false); setAssinaturaNome(rec?.assinatura_nome ?? ""); }}
                            disabled={isRascunhoModalAberto}
                            style={{ height: 48, padding: "0 16px", background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: isRascunhoModalAberto ? "default" : "pointer", whiteSpace: "nowrap" }}>
                            Salvar rascunho
                          </button>
                          <button type="button"
                            onClick={() => { setIsFinalizarModalAberto((v) => !v); setIsRascunhoModalAberto(false); setAssinaturaNome(rec?.assinatura_nome ?? ""); }}
                            disabled={isFinalizarModalAberto}
                            style={{ height: 48, padding: "0 20px", background: "#22C55E", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isFinalizarModalAberto ? "default" : "pointer", whiteSpace: "nowrap" }}>
                            Finalizar →
                          </button>
                        </div>
                      </footer>
                    </>
                  )}
                </>
              );
            })() : (
              // ── LISTA DE PEDIDOS PARA RECEBIMENTO ──────────────────────
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 24 }}>

                {/* Grupo: Em andamento */}
                {pedidosEmAndamento.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      🟠 Em andamento ({pedidosEmAndamento.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pedidosEmAndamento.map((p) => (
                        <div key={p.id} onClick={() => handleSelecionarPedido(p)}
                          style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid #F59E0B", borderLeft: "3px solid #F59E0B", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{formatDateTime(p.data_pedido)}</span>
                              <StatusBadge status={p.status} />
                              <span style={{ fontSize: 11, fontWeight: 700, background: "#92400E", color: "#FDE68A", borderRadius: 99, padding: "2px 8px" }}>🟠 Rascunho</span>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                              {p.purchase_order_items.length} {p.purchase_order_items.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                          <ChevronRight size={18} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grupo: Aguardando recebimento */}
                {pedidosAguardando.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                      Aguardando recebimento ({pedidosAguardando.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pedidosAguardando.map((p) => (
                        <div key={p.id} onClick={() => handleSelecionarPedido(p)}
                          style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{formatDateTime(p.data_pedido)}</span>
                              <StatusBadge status={p.status} />
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                              {p.purchase_order_items.length} {p.purchase_order_items.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                          <ChevronRight size={18} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grupo: Finalizados */}
                {pedidosFinalizados.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#15803D", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                      ✓ Finalizados ({pedidosFinalizados.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {pedidosFinalizados.map((p) => (
                        <div key={p.id} onClick={() => handleSelecionarPedido(p)}
                          style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, opacity: 0.65 }}>
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{formatDateTime(p.data_pedido)}</span>
                              <StatusBadge status={p.status} />
                              <span style={{ fontSize: 11, fontWeight: 700, background: "#15803D", color: "#fff", borderRadius: 99, padding: "2px 8px" }}>✓ Recebido</span>
                            </div>
                            {p.recebimento?.assinatura_nome && (
                              <span style={{ fontSize: 12, color: "var(--text-3)" }}>Recebido por: {p.recebimento.assinatura_nome}</span>
                            )}
                          </div>
                          <ChevronRight size={18} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pedidosEmAndamento.length === 0 && pedidosAguardando.length === 0 && pedidosFinalizados.length === 0 && (
                  <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 48 }}>Nenhum pedido encontrado.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ABA HISTÓRICO ────────────────────────────────────────────── */}
        {abaAtiva === "historico" && (
          <div style={{ height: "100%", overflowY: "auto", padding: "16px 16px" }}>
            {pedidosVisiveis.length === 0 ? (
              <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "48px 0" }}>Nenhum pedido encontrado para esta unidade.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pedidosVisiveis.map((p) => {
                  if (p.status === "rascunho") {
                    return (
                      <div key={p.id} style={{ background: "var(--surface)", border: "1px solid #F59E0B", borderLeft: "3px solid #F59E0B", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: "#92400E", color: "#FDE68A", borderRadius: 99, padding: "2px 8px" }}>
                              📝 Rascunho{p.solicitante_nome ? ` · ${p.solicitante_nome}` : ""}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                            {p.purchase_order_items.length} {p.purchase_order_items.length === 1 ? "item" : "itens"} · {formatDateTime(p.data_pedido)}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleCarregarRascunho(p)}
                          style={{ height: 36, padding: "0 12px", background: "#F59E0B", color: "#000", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                          ✏️ Continuar
                        </button>
                      </div>
                    );
                  }
                  const isExpanded = expandedId === p.id;
                  const isConfirming = confirmingDelete === p.id;
                  const isDeleting = deletingId === p.id;
                  return (
                    <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <div onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, padding: "12px 16px", cursor: "pointer", borderBottom: isExpanded ? "1px solid var(--border)" : "none", background: isExpanded ? "var(--surface-2)" : "var(--surface)" }}>
                        <span style={{ color: "var(--text-3)", display: "flex", flexShrink: 0 }}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                        <span style={{ fontSize: 13, color: "var(--text-2)", flexShrink: 0 }}>{formatDateTime(p.data_pedido)}</span>
                        <StatusBadge status={p.status} />
                        <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>{p.purchase_order_items.length} {p.purchase_order_items.length === 1 ? "item" : "itens"}</span>
                        {(p as PedidoComItens).solicitante_nome && (
                          <span style={{ fontSize: 12, color: "var(--text-3)", flexShrink: 0 }}>· {(p as PedidoComItens).solicitante_nome}</span>
                        )}
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => handlePdfExport(p)} style={smallBtn()}>📄 PDF</button>
                          {isConfirming ? (
                            <>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-2)", cursor: "pointer" }}>
                                <input type="checkbox" checked={deleteChecked} onChange={(e) => setDeleteChecked(e.target.checked)} />
                                Confirmar exclusão
                              </label>
                              <button type="button" onClick={() => { setConfirmingDelete(null); setDeleteChecked(false); }} style={smallBtn()}>Cancelar</button>
                              <button type="button" disabled={!deleteChecked || isDeleting} onClick={() => handleDeleteConfirm(p.id)} style={smallBtn(deleteChecked && !isDeleting, true)}>
                                {isDeleting ? "Excluindo…" : "Excluir"}
                              </button>
                            </>
                          ) : (
                            <button type="button" onClick={() => { setConfirmingDelete(p.id); setDeleteChecked(false); }} style={smallBtn()}>🗑️ Excluir</button>
                          )}
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "16px 20px" }}>
                          {p.purchase_order_items.length === 0 ? (
                            <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center" }}>Sem itens.</div>
                          ) : (
                            Array.from(groupItemsByCategoria(p.purchase_order_items, produtosPorNome)).map(([cat, items]) => (
                              <div key={cat} style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6, marginBottom: 6, borderBottom: "1px solid var(--border)" }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.7 }}>{cat}</span>
                                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>({items.length})</span>
                                </div>
                                {items.map((item: PurchaseOrderItemRow) => (
                                  <div key={item.id} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                                    <span style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>{item.nome}</span>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-2)", flexShrink: 0 }}>{item.quantidade}</span>
                                    <span style={{ fontSize: 11, color: "var(--text-3)", width: 28, textAlign: "right", flexShrink: 0 }}>{item.unidade ?? ""}</span>
                                  </div>
                                ))}
                              </div>
                            ))
                          )}
                          {p.observacoes && (
                            <div style={{ marginTop: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderLeft: "3px solid var(--text-3)", borderRadius: 6, padding: "10px 12px", fontSize: 13, color: "var(--text-3)", fontStyle: "italic" }}>
                              Obs: {p.observacoes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ══ CARRINHO DRAWER ═════════════════════════════════════════════════ */}
      {carrinhoAberto && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} onClick={() => setCarrinhoAberto(false)} />
          <div style={{ position: "fixed", top: 0, right: 0, height: "100dvh", width: 320, background: "var(--surface)", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 64, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>Carrinho{totalItens > 0 ? ` (${totalItens})` : ""}</span>
              <button type="button" onClick={() => setCarrinhoAberto(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 8, display: "flex", alignItems: "center" }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {carrinho.length === 0 ? (
                <div style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", paddingTop: 32 }}>
                  <div>Nenhum item adicionado.</div>
                  {rascunhoId && (
                    <button type="button" onClick={handleDescartarRascunho} disabled={isPending}
                      style={{ marginTop: 16, height: 36, padding: "0 16px", background: "transparent", border: "1px solid #EF4444", borderRadius: 8, color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.5 : 1 }}>
                      {isPending ? "Descartando…" : "🗑️ Descartar rascunho salvo"}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {carrinho.map((item) => (
                    <div key={item.ingrediente_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--text)", lineHeight: 1.3 }}>{item.nome}</span>
                      <input type="number" inputMode="decimal" min="0" step="any" value={item.quantidade}
                        onChange={(e) => handleQtdChange(item.nome, e.target.value)}
                        style={{ width: 52, height: 36, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", fontSize: 14, fontWeight: 700, textAlign: "center", outline: "none", padding: "0 4px" }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", minWidth: 22, textAlign: "center" }}>{item.unidade}</span>
                      <button type="button" onClick={() => handleRemoverItem(item.nome)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4, display: "flex", alignItems: "center", flexShrink: 0 }}><X size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 }}>Seu nome *</div>
                  <input type="text" placeholder="Nome de quem está pedindo" value={solicitanteNome} onChange={(e) => setSolicitanteNome(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "10px 12px", outline: "none", boxSizing: "border-box" }} />
                </div>
                <textarea placeholder="Observações (opcional)…" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "10px 12px", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button type="button" onClick={handleEnviar} disabled={totalItens === 0 || isPending}
                style={{ width: "100%", height: 48, background: "#22C55E", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: totalItens === 0 || isPending ? "not-allowed" : "pointer", opacity: totalItens === 0 || isPending ? 0.4 : 1 }}>
                {isPending ? "Enviando…" : "Enviar Pedido"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
