"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@kph/db/supabase/server";
import { requireUser } from "@kph/auth/server";
import { getCurrentUnit } from "@kph/auth/unit";
import type { ActionResult } from "@/lib/result";

const BUCKET = "manutencao-comprovantes";
const REVALIDATE_PATH = "/operacao/manutencao";

// ── Tipos de linha (schema confirmado via information_schema) ────────────────

export type ChamadoStatus = "aberto" | "em_andamento" | "em_aprovacao" | "concluido" | "cancelado";
export type AprovadoStatus = "SIM" | "NAO" | "PENDENTE";

export type ManutencaoChamadoRow = {
  id: string;
  unit_id: string;
  operacao: string;
  categoria: string;
  local: string;
  andar: string;
  prioridade: string;
  servico: string;
  motivo: string;
  data_solicitacao: string;
  data_execucao: string | null;
  executado_por: string | null;
  status: ChamadoStatus;
  valor_previsto: number | null;
  observacoes: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
};

export type ManutencaoAprovacaoRow = {
  id: string;
  unit_id: string;
  chamado_id: string | null;
  operacao: string;
  categoria: string;
  local: string;
  andar: string;
  prioridade: string;
  servico: string;
  data_solicitacao: string;
  valor_previsto: number;
  forma_pagamento: string;
  numero_parcelas: number;
  valor_parcela: number; // GENERATED — nunca insert/update
  aprovado: AprovadoStatus;
  data_aprovacao: string | null;
  aprovado_por: string | null;
  data_execucao: string | null;
  garantia_dias: number | null;
  data_vence_garantia: string | null; // GENERATED — nunca insert/update
  numero_nota_fiscal: string | null;
  observacoes: string | null;
  criado_por: string;
  created_at: string;
  updated_at: string;
};

export type ManutencaoParcelaRow = {
  id: string;
  aprovacao_id: string;
  numero: number;
  competencia: string;
  valor: number;
  pago: boolean;
  data_pagamento: string | null;
  comprovante_url: string | null;
  comprovante_nome: string | null;
  created_at: string;
};

export type AprovacaoComParcelas = ManutencaoAprovacaoRow & {
  manutencao_parcelas: ManutencaoParcelaRow[];
};

// ── Inputs ─────────────────────────────────────────────────────────────────

export type NovoChamadoInput = {
  operacao: string;
  categoria: string;
  local: string;
  andar: string;
  prioridade: string;
  data_solicitacao: string;
  servico: string;
  motivo: string;
  valor_previsto: number | null;
};

export type AtualizarChamadoInput = Partial<{
  operacao: string;
  categoria: string;
  local: string;
  andar: string;
  prioridade: string;
  data_solicitacao: string;
  servico: string;
  motivo: string;
  valor_previsto: number | null;
  observacoes: string | null;
  status: ChamadoStatus;
  data_execucao: string | null;
  executado_por: string | null;
}>;

export type NovaAprovacaoInput = {
  operacao: string;
  categoria: string;
  local: string;
  andar: string;
  prioridade: string;
  servico: string;
  data_solicitacao: string;
  valor_previsto: number;
  forma_pagamento: string;
  numero_parcelas: number;
};

export type DadosFinanceirosPromocao = {
  valor_previsto: number;
  forma_pagamento: string;
  numero_parcelas: number;
};

export type AtualizarAprovacaoInput = Partial<{
  data_execucao: string | null;
  garantia_dias: number | null;
  numero_nota_fiscal: string | null;
  observacoes: string | null;
}>;

// ── Helpers de data ────────────────────────────────────────────────────────

function parseDateParts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function firstDayOfMonthPlus(dateStr: string, monthsAhead: number): string {
  const { y, m } = parseDateParts(dateStr);
  const total = (m - 1) + monthsAhead;
  const targetYear = y + Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
}

function todayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function calcularParcelas(dataSolicitacao: string, valorPrevisto: number, numeroParcelas: number) {
  const base = Math.round((valorPrevisto / numeroParcelas) * 100) / 100;
  const parcelas: Array<{ numero: number; competencia: string; valor: number }> = [];
  let acumulado = 0;
  for (let i = 1; i <= numeroParcelas; i++) {
    const isUltima = i === numeroParcelas;
    const valor = isUltima ? Math.round((valorPrevisto - acumulado) * 100) / 100 : base;
    acumulado += valor;
    parcelas.push({ numero: i, competencia: firstDayOfMonthPlus(dataSolicitacao, i), valor });
  }
  return parcelas;
}

// ── Chamados ───────────────────────────────────────────────────────────────

export async function getChamados(unitId: string): Promise<ManutencaoChamadoRow[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = (await supabase
    .from("manutencao_chamados" as never)
    .select("*")
    .eq("unit_id", unitId)
    .order("data_solicitacao", { ascending: false })) as unknown as {
    data: ManutencaoChamadoRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[getChamados]", error.message);
    return [];
  }
  return data ?? [];
}

export async function criarChamado(dados: NovoChamadoInput): Promise<ActionResult<ManutencaoChamadoRow>> {
  if (!dados.servico.trim()) return { ok: false, error: "Descreva o serviço solicitado." };
  if (!dados.data_solicitacao) return { ok: false, error: "Informe a data de solicitação." };

  const user = await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) return { ok: false, error: "Nenhuma unidade selecionada." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = (await supabase
    .from("manutencao_chamados" as never)
    .insert({
      unit_id: unit.id,
      operacao: dados.operacao,
      categoria: dados.categoria,
      local: dados.local,
      andar: dados.andar,
      prioridade: dados.prioridade,
      data_solicitacao: dados.data_solicitacao,
      servico: dados.servico,
      motivo: dados.motivo,
      valor_previsto: dados.valor_previsto,
      status: "aberto",
      criado_por: user.id,
    } as never)
    .select()
    .single()) as unknown as { data: ManutencaoChamadoRow | null; error: { message: string } | null };

  if (error || !data) {
    console.error("[criarChamado]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao criar chamado." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data };
}

export async function atualizarChamado(
  id: string,
  dados: AtualizarChamadoInput,
): Promise<ActionResult<ManutencaoChamadoRow>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = (await supabase
    .from("manutencao_chamados" as never)
    .update(dados as never)
    .eq("id", id)
    .select()
    .single()) as unknown as { data: ManutencaoChamadoRow | null; error: { message: string } | null };

  if (error || !data) {
    console.error("[atualizarChamado]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao atualizar chamado." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data };
}

export async function excluirChamado(id: string): Promise<ActionResult<void>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { error } = (await supabase
    .from("manutencao_chamados" as never)
    .delete()
    .eq("id", id)) as unknown as { error: { message: string } | null };

  if (error) {
    console.error("[excluirChamado]", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: undefined };
}

// ── Aprovações ─────────────────────────────────────────────────────────────

function ordenarParcelas(aprovacoes: AprovacaoComParcelas[]): AprovacaoComParcelas[] {
  return aprovacoes.map((a) => ({
    ...a,
    manutencao_parcelas: [...a.manutencao_parcelas].sort((x, y) => x.numero - y.numero),
  }));
}

export async function getAprovacoes(unitId: string): Promise<AprovacaoComParcelas[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .select("*, manutencao_parcelas(*)")
    .eq("unit_id", unitId)
    .order("data_solicitacao", { ascending: false })) as unknown as {
    data: AprovacaoComParcelas[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[getAprovacoes]", error.message);
    return [];
  }
  return ordenarParcelas(data ?? []);
}

async function inserirParcelas(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  aprovacaoId: string,
  dataSolicitacao: string,
  valorPrevisto: number,
  numeroParcelas: number,
): Promise<{ error: string | null }> {
  const parcelas = calcularParcelas(dataSolicitacao, valorPrevisto, numeroParcelas);
  const { error } = (await supabase
    .from("manutencao_parcelas" as never)
    .insert(
      parcelas.map((p) => ({
        aprovacao_id: aprovacaoId,
        numero: p.numero,
        competencia: p.competencia,
        valor: p.valor,
        pago: false,
      })) as never,
    )) as unknown as { error: { message: string } | null };

  return { error: error?.message ?? null };
}

async function buscarAprovacaoComParcelas(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  aprovacaoId: string,
): Promise<AprovacaoComParcelas | null> {
  const { data } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .select("*, manutencao_parcelas(*)")
    .eq("id", aprovacaoId)
    .single()) as unknown as { data: AprovacaoComParcelas | null; error: unknown };

  if (!data) return null;
  return ordenarParcelas([data])[0]!;
}

export async function criarAprovacao(
  dados: NovaAprovacaoInput,
): Promise<ActionResult<AprovacaoComParcelas>> {
  if (dados.numero_parcelas <= 0) return { ok: false, error: "Número de parcelas inválido." };
  if (dados.valor_previsto <= 0) return { ok: false, error: "Valor previsto inválido." };

  const user = await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) return { ok: false, error: "Nenhuma unidade selecionada." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data: aprovacao, error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .insert({
      unit_id: unit.id,
      chamado_id: null,
      operacao: dados.operacao,
      categoria: dados.categoria,
      local: dados.local,
      andar: dados.andar,
      prioridade: dados.prioridade,
      servico: dados.servico,
      data_solicitacao: dados.data_solicitacao,
      valor_previsto: dados.valor_previsto,
      forma_pagamento: dados.forma_pagamento,
      numero_parcelas: dados.numero_parcelas,
      aprovado: "PENDENTE",
      criado_por: user.id,
    } as never)
    .select()
    .single()) as unknown as { data: ManutencaoAprovacaoRow | null; error: { message: string } | null };

  if (error || !aprovacao) {
    console.error("[criarAprovacao]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao criar aprovação." };
  }

  const { error: parcelasError } = await inserirParcelas(
    supabase,
    aprovacao.id,
    dados.data_solicitacao,
    dados.valor_previsto,
    dados.numero_parcelas,
  );
  if (parcelasError) {
    console.error("[criarAprovacao] parcelas", parcelasError);
    return { ok: false, error: parcelasError };
  }

  const completa = await buscarAprovacaoComParcelas(supabase, aprovacao.id);
  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: completa ?? { ...aprovacao, manutencao_parcelas: [] } };
}

export async function promoverChamadoParaAprovacao(
  chamadoId: string,
  dadosFinanceiros: DadosFinanceirosPromocao,
): Promise<ActionResult<AprovacaoComParcelas>> {
  if (dadosFinanceiros.numero_parcelas <= 0) return { ok: false, error: "Número de parcelas inválido." };
  if (dadosFinanceiros.valor_previsto <= 0) return { ok: false, error: "Valor previsto inválido." };

  const user = await requireUser();
  const unit = await getCurrentUnit();
  if (!unit) return { ok: false, error: "Nenhuma unidade selecionada." };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data: chamado, error: chamadoError } = (await supabase
    .from("manutencao_chamados" as never)
    .select("*")
    .eq("id", chamadoId)
    .single()) as unknown as { data: ManutencaoChamadoRow | null; error: { message: string } | null };

  if (chamadoError || !chamado) {
    console.error("[promoverChamadoParaAprovacao] chamado", chamadoError?.message);
    return { ok: false, error: chamadoError?.message ?? "Chamado não encontrado." };
  }

  const { data: aprovacao, error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .insert({
      unit_id: unit.id,
      chamado_id: chamadoId,
      operacao: chamado.operacao,
      categoria: chamado.categoria,
      local: chamado.local,
      andar: chamado.andar,
      prioridade: chamado.prioridade,
      servico: chamado.servico,
      data_solicitacao: chamado.data_solicitacao,
      data_execucao: chamado.data_execucao ?? null,
      valor_previsto: dadosFinanceiros.valor_previsto,
      forma_pagamento: dadosFinanceiros.forma_pagamento,
      numero_parcelas: dadosFinanceiros.numero_parcelas,
      aprovado: "PENDENTE",
      observacoes: chamado.motivo ? `Motivo do chamado: ${chamado.motivo}` : null,
      criado_por: user.id,
    } as never)
    .select()
    .single()) as unknown as { data: ManutencaoAprovacaoRow | null; error: { message: string } | null };

  if (error || !aprovacao) {
    console.error("[promoverChamadoParaAprovacao] insert", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao criar aprovação." };
  }

  const { error: parcelasError } = await inserirParcelas(
    supabase,
    aprovacao.id,
    chamado.data_solicitacao,
    dadosFinanceiros.valor_previsto,
    dadosFinanceiros.numero_parcelas,
  );
  if (parcelasError) {
    console.error("[promoverChamadoParaAprovacao] parcelas", parcelasError);
    return { ok: false, error: parcelasError };
  }

  await (supabase
    .from("manutencao_chamados" as never)
    .update({ status: "em_aprovacao" } as never)
    .eq("id", chamadoId) as unknown as Promise<unknown>);

  const completa = await buscarAprovacaoComParcelas(supabase, aprovacao.id);
  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: completa ?? { ...aprovacao, manutencao_parcelas: [] } };
}

export async function definirAprovacao(
  id: string,
  aprovado: AprovadoStatus,
): Promise<ActionResult<ManutencaoAprovacaoRow>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .update({
      aprovado,
      data_aprovacao: todayDateStr(),
      aprovado_por: user.id,
    } as never)
    .eq("id", id)
    .select()
    .single()) as unknown as { data: ManutencaoAprovacaoRow | null; error: { message: string } | null };

  if (error || !data) {
    console.error("[definirAprovacao]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao atualizar aprovação." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data };
}

export async function atualizarAprovacao(
  id: string,
  dados: AtualizarAprovacaoInput,
): Promise<ActionResult<ManutencaoAprovacaoRow>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .update(dados as never)
    .eq("id", id)
    .select()
    .single()) as unknown as { data: ManutencaoAprovacaoRow | null; error: { message: string } | null };

  if (error || !data) {
    console.error("[atualizarAprovacao]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao atualizar aprovação." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data };
}

export async function excluirAprovacao(id: string): Promise<ActionResult<void>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  await (supabase
    .from("manutencao_parcelas" as never)
    .delete()
    .eq("aprovacao_id", id) as unknown as Promise<unknown>);

  const { error } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .delete()
    .eq("id", id)) as unknown as { error: { message: string } | null };

  if (error) {
    console.error("[excluirAprovacao]", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: undefined };
}

// ── Parcelas ───────────────────────────────────────────────────────────────

export async function marcarParcelaPaga(
  parcelaId: string,
  pago: boolean,
  dataPagamento?: string | null,
): Promise<ActionResult<ManutencaoParcelaRow>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data, error } = (await supabase
    .from("manutencao_parcelas" as never)
    .update({
      pago,
      data_pagamento: pago ? (dataPagamento ?? todayDateStr()) : null,
    } as never)
    .eq("id", parcelaId)
    .select()
    .single()) as unknown as { data: ManutencaoParcelaRow | null; error: { message: string } | null };

  if (error || !data) {
    console.error("[marcarParcelaPaga]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao atualizar parcela." };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data };
}

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export async function anexarComprovante(
  parcelaId: string,
  file: File,
): Promise<ActionResult<{ comprovante_url: string; comprovante_nome: string }>> {
  if (!TIPOS_ACEITOS.includes(file.type)) {
    return { ok: false, error: "Formato inválido. Envie PDF, JPG ou PNG." };
  }
  if (file.size > TAMANHO_MAXIMO) {
    return { ok: false, error: "Arquivo muito grande. Máximo de 10MB." };
  }

  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data: parcela, error: parcelaError } = (await supabase
    .from("manutencao_parcelas" as never)
    .select("id, aprovacao_id")
    .eq("id", parcelaId)
    .single()) as unknown as { data: { id: string; aprovacao_id: string } | null; error: { message: string } | null };

  if (parcelaError || !parcela) {
    return { ok: false, error: parcelaError?.message ?? "Parcela não encontrada." };
  }

  const { data: aprovacao, error: aprovacaoError } = (await supabase
    .from("manutencao_aprovacoes" as never)
    .select("id, unit_id")
    .eq("id", parcela.aprovacao_id)
    .single()) as unknown as { data: { id: string; unit_id: string } | null; error: { message: string } | null };

  if (aprovacaoError || !aprovacao) {
    return { ok: false, error: aprovacaoError?.message ?? "Aprovação não encontrada." };
  }

  const path = `${aprovacao.unit_id}/${aprovacao.id}/${parcelaId}-${file.name}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    console.error("[anexarComprovante] upload", uploadError.message);
    return { ok: false, error: uploadError.message };
  }

  const { error: updateError } = (await supabase
    .from("manutencao_parcelas" as never)
    .update({ comprovante_url: path, comprovante_nome: file.name } as never)
    .eq("id", parcelaId)) as unknown as { error: { message: string } | null };

  if (updateError) {
    console.error("[anexarComprovante] update", updateError.message);
    return { ok: false, error: updateError.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: { comprovante_url: path, comprovante_nome: file.name } };
}

export async function removerComprovante(parcelaId: string): Promise<ActionResult<void>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data: parcela } = (await supabase
    .from("manutencao_parcelas" as never)
    .select("comprovante_url")
    .eq("id", parcelaId)
    .single()) as unknown as { data: { comprovante_url: string | null } | null; error: unknown };

  if (parcela?.comprovante_url) {
    await supabase.storage.from(BUCKET).remove([parcela.comprovante_url]);
  }

  const { error } = (await supabase
    .from("manutencao_parcelas" as never)
    .update({ comprovante_url: null, comprovante_nome: null } as never)
    .eq("id", parcelaId)) as unknown as { error: { message: string } | null };

  if (error) {
    console.error("[removerComprovante]", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath(REVALIDATE_PATH);
  return { ok: true, data: undefined };
}

export async function gerarUrlComprovante(parcelaId: string): Promise<ActionResult<string>> {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "Supabase indisponível." };

  const { data: parcela } = (await supabase
    .from("manutencao_parcelas" as never)
    .select("comprovante_url")
    .eq("id", parcelaId)
    .single()) as unknown as { data: { comprovante_url: string | null } | null; error: unknown };

  if (!parcela?.comprovante_url) {
    return { ok: false, error: "Nenhum comprovante anexado." };
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(parcela.comprovante_url, 300);

  if (error || !data) {
    console.error("[gerarUrlComprovante]", error?.message);
    return { ok: false, error: error?.message ?? "Erro ao gerar link do comprovante." };
  }

  return { ok: true, data: data.signedUrl };
}
