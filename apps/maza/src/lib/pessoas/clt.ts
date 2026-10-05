// Cálculo de holerite — CLT 2024 / Sinthoresp.
//
// Sem dependência de Supabase ou React: pode ser importado tanto pelo server
// (Server Actions, API routes) quanto pelo client (preview de cálculo).
//
// **Atenção:** valores monetários internos circulam como `number`. Convertemos
// para string com 2 casas só na fronteira (insert no Supabase). Arredondamento
// usa Math.round em centavos pra evitar drift.

import { hoursWorked, timeToMinutes } from "./labor";
import type { Shift } from "@maza/db/types/pessoas";

export const HORAS_MES = 220;
export const DEDUCAO_DEPENDENTE = 189.59;

// ── INSS 2024 ──────────────────────────────────────────────────
// Tabela progressiva: cada faixa aplica sua alíquota só sobre o trecho que
// excede a anterior. Teto em R$ 7.786,02 (qualquer salário acima paga o cap).

type InssFaixa = { ate: number; aliquota: number };

const INSS_FAIXAS: ReadonlyArray<InssFaixa> = [
  { ate: 1412.0,  aliquota: 0.075 },
  { ate: 2666.68, aliquota: 0.09  },
  { ate: 4000.03, aliquota: 0.12  },
  { ate: 7786.02, aliquota: 0.14  },
];

export function calcINSS(salarioBruto: number): number {
  if (!Number.isFinite(salarioBruto) || salarioBruto <= 0) return 0;
  const base = Math.min(salarioBruto, INSS_FAIXAS[INSS_FAIXAS.length - 1]?.ate ?? 0);
  let total = 0;
  let limiteAnterior = 0;
  for (const faixa of INSS_FAIXAS) {
    if (base <= limiteAnterior) break;
    const trecho = Math.min(base, faixa.ate) - limiteAnterior;
    if (trecho > 0) total += trecho * faixa.aliquota;
    limiteAnterior = faixa.ate;
  }
  return round2(total);
}

// ── IRRF 2024 ──────────────────────────────────────────────────
// Tabela progressiva com dedução. Aplicar (base * aliquota) - dedução.

type IrrfFaixa = { ate: number; aliquota: number; deducao: number };

const IRRF_FAIXAS: ReadonlyArray<IrrfFaixa> = [
  { ate: 2259.20,        aliquota: 0,      deducao: 0     },
  { ate: 2826.65,        aliquota: 0.075,  deducao: 169.44 },
  { ate: 3751.05,        aliquota: 0.15,   deducao: 381.44 },
  { ate: 4664.68,        aliquota: 0.225,  deducao: 662.77 },
  { ate: Number.POSITIVE_INFINITY, aliquota: 0.275, deducao: 896.00 },
];

export function calcIRRF(baseCalculo: number, dependentes: number = 0): number {
  if (!Number.isFinite(baseCalculo) || baseCalculo <= 0) return 0;
  const base = baseCalculo - dependentes * DEDUCAO_DEPENDENTE;
  if (base <= 0) return 0;
  for (const faixa of IRRF_FAIXAS) {
    if (base <= faixa.ate) {
      const valor = base * faixa.aliquota - faixa.deducao;
      return valor > 0 ? round2(valor) : 0;
    }
  }
  return 0;
}

// ── DSR sobre gorjeta (art. 457-A CLT) ─────────────────────────
// DSR = gorjeta_mensal × (dias_repouso / dias_uteis)
// dias_uteis  = segunda a sábado (excluindo feriados)
// dias_repouso = domingos + feriados
//
// V1: só conta domingos. Feriados ficam pendentes — quando tabela de feriados
// (cct_versions / locale específico) estiver wired, integrar aqui.

export function calcDSR(gorjeta: number, mes: number, ano: number): number {
  if (!Number.isFinite(gorjeta) || gorjeta <= 0) return 0;
  const { domingos, diasUteis } = countDomingosUteis(mes, ano);
  if (diasUteis === 0) return 0;
  return round2((gorjeta / diasUteis) * domingos);
}

/** Dias úteis (seg-sáb) e domingos no mês. mes 1-12. */
export function countDomingosUteis(mes: number, ano: number): {
  domingos: number;
  diasUteis: number;
} {
  let domingos = 0;
  let diasUteis = 0;
  const totalDias = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= totalDias; d++) {
    const dow = new Date(ano, mes - 1, d).getDay(); // 0 = domingo
    if (dow === 0) domingos++;
    else diasUteis++;
  }
  return { domingos, diasUteis };
}

// ── Horas extras ───────────────────────────────────────────────
// Jornada normal CLT: 8h/dia. Excedente vira HE.
//   - Em dia útil: primeiras 2h excedentes a 50%, depois a 100%.
//   - Em domingo/feriado: 100% sobre todo excedente.
//
// V1: feriados não tracked → só domingos contam. Folga (tipo='folga') ignorada.

const JORNADA_NORMAL_H = 8;

export function calcHorasExtras(
  shifts: ReadonlyArray<Shift>,
  salarioBase: number,
  mes: number,
  ano: number,
): { valor: number; horas: number } {
  if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
    return { valor: 0, horas: 0 };
  }
  const horaNormal = salarioBase / HORAS_MES;
  let valor = 0;
  let horasTotal = 0;

  for (const s of shifts) {
    if (s.tipo === "folga") continue;
    if (!sameMonth(s.data, mes, ano)) continue;

    const realTotal = hoursWorked(s.hora_inicio, s.hora_fim);
    const nightReal = nightHoursInShift(s.hora_inicio, s.hora_fim);
    const dayReal = realTotal - nightReal;
    const { horasReduzidas } = calcularHoraNoturna(nightReal);

    const trabalhadas = dayReal + horasReduzidas;
    const excedente = trabalhadas - JORNADA_NORMAL_H;

    if (excedente <= 0) continue;
    const isDomingo = isDomingoIso(s.data);
    if (isDomingo || s.tipo === "feriado") {
      valor += excedente * horaNormal * 2.0;
    } else {
      const ate2h = Math.min(excedente, 2);
      const acima2h = Math.max(0, excedente - 2);
      valor += ate2h * horaNormal * 1.5;
      valor += acima2h * horaNormal * 2.0;
    }
    horasTotal += excedente;
  }
  return { valor: round2(valor), horas: round2(horasTotal) };
}

// ── Adicional noturno (art. 73 CLT) ────────────────────────────
// 20% sobre hora normal para horas trabalhadas entre 22h e 05h.
// Hora noturna reduzida (52'30")

const HORA_NOTURNA_FATOR = 60 / 52.5; // 1.142857...
const ADICIONAL_NOTURNO = 0.20;
const INICIO_NOTURNO = 22; // 22h
const FIM_NOTURNO = 5;    // 05h

const NIGHT_START_MIN = INICIO_NOTURNO * 60;
const NIGHT_END_MIN = FIM_NOTURNO * 60 + 24 * 60; // 05:00 do dia seguinte = 1740

export function calcularHoraNoturna(horasNoturnasReais: number): {
  horasReduzidas: number;
  adicionalNoturno: number;
} {
  return {
    horasReduzidas: horasNoturnasReais * HORA_NOTURNA_FATOR,
    adicionalNoturno: horasNoturnasReais * ADICIONAL_NOTURNO, // 20% sobre as horas reais
  };
}

export function calcAdicionalNoturno(
  shifts: ReadonlyArray<Shift>,
  salarioBase: number,
  mes: number,
  ano: number,
): { valor: number; horas: number } {
  if (!Number.isFinite(salarioBase) || salarioBase <= 0) {
    return { valor: 0, horas: 0 };
  }
  const horaNormal = salarioBase / HORAS_MES;
  let horasReais = 0;
  for (const s of shifts) {
    if (s.tipo === "folga") continue;
    if (!sameMonth(s.data, mes, ano)) continue;
    horasReais += nightHoursInShift(s.hora_inicio, s.hora_fim);
  }

  const { adicionalNoturno } = calcularHoraNoturna(horasReais);
  const valor = adicionalNoturno * horaNormal;

  return { valor: round2(valor), horas: round2(horasReais) };
}

/** Overlap do turno com janela [22:00, 05:00 do dia seguinte], em horas reais. */
export function nightHoursInShift(
  horaInicio: string | null | undefined,
  horaFim: string | null | undefined,
): number {
  const start = timeToMinutes(horaInicio);
  const endRaw = timeToMinutes(horaFim);
  if (start === null || endRaw === null) return 0;
  let end = endRaw;
  if (end <= start) end += 24 * 60;
  // Overlap com [NIGHT_START_MIN, NIGHT_END_MIN]
  const overlap = Math.max(0, Math.min(end, NIGHT_END_MIN) - Math.max(start, NIGHT_START_MIN));
  return overlap / 60;
}

// ── Holerite consolidado ───────────────────────────────────────

export type PayslipCalculated = {
  competencia: string; // "YYYY-MM-01"
  salarioBase: number;
  horasExtras: number;
  horasExtrasQt: number;
  adicionalNoturno: number;
  adicionalNoturnoH: number;
  gorjeta: number;
  dsrGorjeta: number;
  totalProventos: number;
  baseInss: number;
  descontoInss: number;
  baseIrrf: number;
  descontoIrrf: number;
  descontoVT: number;
  descontoVR: number;
  totalDescontos: number;
  liquido: number;
};

export type PayslipInputs = {
  salarioBase: number;
  shifts: ReadonlyArray<Shift>;
  mes: number; // 1-12
  ano: number;
  gorjeta?: number;
  dependentes?: number;
  descontoVT?: number;
  descontoVR?: number;
};

export function gerarHolerite(input: PayslipInputs): PayslipCalculated {
  const {
    salarioBase,
    shifts,
    mes,
    ano,
    gorjeta = 0,
    dependentes = 0,
    descontoVT = 0,
    descontoVR = 0,
  } = input;

  const he = calcHorasExtras(shifts, salarioBase, mes, ano);
  const an = calcAdicionalNoturno(shifts, salarioBase, mes, ano);
  const dsr = calcDSR(gorjeta, mes, ano);

  const totalProventos = round2(salarioBase + he.valor + an.valor + gorjeta + dsr);

  // INSS incide sobre tudo que é remuneração (salário + HE + AdN + gorjeta + DSR).
  const baseInss = totalProventos;
  const descontoInss = calcINSS(baseInss);

  // Base IRRF = bruto - INSS - dependentes.
  const baseIrrf = round2(totalProventos - descontoInss);
  const descontoIrrf = calcIRRF(baseIrrf, dependentes);

  const totalDescontos = round2(descontoInss + descontoIrrf + descontoVT + descontoVR);
  const liquido = round2(totalProventos - totalDescontos);

  const competencia = `${ano}-${String(mes).padStart(2, "0")}-01`;

  return {
    competencia,
    salarioBase: round2(salarioBase),
    horasExtras: he.valor,
    horasExtrasQt: he.horas,
    adicionalNoturno: an.valor,
    adicionalNoturnoH: an.horas,
    gorjeta: round2(gorjeta),
    dsrGorjeta: dsr,
    totalProventos,
    baseInss: round2(baseInss),
    descontoInss,
    baseIrrf,
    descontoIrrf,
    descontoVT: round2(descontoVT),
    descontoVR: round2(descontoVR),
    totalDescontos,
    liquido,
  };
}

// ── Helpers ────────────────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function sameMonth(iso: string, mes: number, ano: number): boolean {
  // iso = "YYYY-MM-DD"
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return y === ano && m === mes;
}

function isDomingoIso(iso: string): boolean {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return new Date(y, m - 1, d).getDay() === 0;
}
