/**
 * Parser do CSV de ponto exportado pelo Totvs.
 * Encoding latin1 (lido no browser como ISO-8859-1).
 * Separador auto-detectado (`;` ou `,`).
 *
 * Adaptação para Marena:
 *   - parsePeriodoIso devolve 'YYYY-MM-01' (DATE no Postgres) em vez de 'YYYY-MM'
 *   - csvRowToTimeRecord devolve shape compatível com `time_records` do Marena
 *   - csvRowToOvertimeRecord devolve shape compatível com `overtime_records`
 */

export type PontoCsvRow = {
  matricula: string;
  nome: string;
  cpf: string;
  periodo: string;            // raw como veio (ex: "jan/26")
  horasPrevistas: string;
  horasTrabalhadas: string;
  bancoHorasPositivo: string;
  bancoHorasNegativo: string;
  saldo: string;
  faltasInjustificadasDias: string;
  atestadoMedico: string;
  afastamentosDias: string;
  feriasDias: string;
  adicionalNoturno: string;
  bancoHorasAcumulado: string;
};

const MONTH_MAP: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04",
  mai: "05", jun: "06", jul: "07", ago: "08",
  set: "09", out: "10", nov: "11", dez: "12",
};

/** 'jan/26' → '2026-01-01'. Retorna null se inválido. */
export function parsePeriodoIso(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes("/")) return null;
  const [monthStr, yearStr] = trimmed.split("/");
  if (!monthStr || !yearStr) return null;
  const month = MONTH_MAP[monthStr];
  if (!month) return null;
  const year = yearStr.length === 2 ? `20${yearStr}` : yearStr;
  return `${year}-${month}-01`;
}

/** Normaliza CPF: só dígitos, padded a 11. */
export function normalizeCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.padStart(11, "0");
}

/** 'HH:MM' ou 'HHH:MM:SS' → decimal ('05:48' → 5.8). null se vazio/zero. */
export function parseHoursToDecimal(val: string | undefined | null): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "00:00" || trimmed === "00:00:00") return null;
  const parts = trimmed.split(":");
  const hours = parseInt(parts[0] ?? "0", 10);
  const mins = parseInt(parts[1] ?? "0", 10);
  if (isNaN(hours) || isNaN(mins)) return null;
  const result = hours + mins / 60;
  return result > 0 ? Math.round(result * 100) / 100 : null;
}

function parseNum(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function trimOrNull(val: string): string | null {
  const t = val.trim();
  return t === "" ? null : t;
}

function detectSeparator(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

export function parsePontoCsv(text: string): PontoCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const separator = detectSeparator(lines[0]!);
  const headers = lines[0]!.split(separator).map((h) => h.trim());
  const colIndex = (name: string) => headers.indexOf(name);

  const iCpf = colIndex("CPF");
  const iNome = colIndex("Nome");
  const iMatricula = colIndex("Matrícula") !== -1 ? colIndex("Matrícula") : colIndex("Matricula");
  const iPeriodo = colIndex("Período") !== -1 ? colIndex("Período") : colIndex("Periodo");
  const iHorasPrev = colIndex("Horas Previstas");
  const iHorasTrab = colIndex("Horas Trabalhadas");
  const iHorasPos = colIndex("Horas mensais positivas");
  const iHorasNeg = colIndex("Horas mensais negativas");
  const iSaldo = colIndex("SALDO");
  const iFaltaDias = colIndex("FALTA INJUSTIFICADA (dias)");
  const iAtestado = colIndex("ATESTADO MEDICO");
  const iAfastDias = colIndex("Afastamentos (dias)");
  const iFeriasDias = colIndex("FERIAS (dias)");
  const iAdicNoturno = colIndex("Adicional Noturno");
  const iBancoAcum = headers.findIndex((h) => h.startsWith("Banco de horas acumulado"));

  const rows: PontoCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(separator);
    const cpfRaw = cols[iCpf]?.trim() ?? "";
    if (!cpfRaw || cpfRaw === " ") continue;

    rows.push({
      matricula: cols[iMatricula]?.trim() ?? "",
      nome: cols[iNome]?.trim() ?? "",
      cpf: cpfRaw,
      periodo: cols[iPeriodo]?.trim() ?? "",
      horasPrevistas: cols[iHorasPrev]?.trim() ?? "",
      horasTrabalhadas: cols[iHorasTrab]?.trim() ?? "",
      bancoHorasPositivo: cols[iHorasPos]?.trim() ?? "",
      bancoHorasNegativo: cols[iHorasNeg]?.trim() ?? "",
      saldo: cols[iSaldo]?.trim() ?? "",
      faltasInjustificadasDias: cols[iFaltaDias]?.trim() ?? "",
      atestadoMedico: cols[iAtestado]?.trim() ?? "",
      afastamentosDias: cols[iAfastDias]?.trim() ?? "",
      feriasDias: cols[iFeriasDias]?.trim() ?? "",
      adicionalNoturno: cols[iAdicNoturno]?.trim() ?? "",
      bancoHorasAcumulado: iBancoAcum >= 0 ? (cols[iBancoAcum]?.trim() ?? "") : "",
    });
  }
  return rows;
}

/** Shape para time_records (Marena). null se período inválido. */
export function csvRowToTimeRecord(
  row: PontoCsvRow,
  employeeId: string,
  unitId: string,
): {
  employee_id: string;
  unit_id: string;
  periodo: string;
  horas_previstas: string | null;
  horas_trabalhadas: string | null;
  banco_horas_positivo: string | null;
  banco_horas_negativo: string | null;
  saldo_banco: string | null;
  banco_horas_acumulado: string | null;
  faltas_injustificadas_dias: number | null;
  atestado_horas: string | null;
  afastamentos_dias: number | null;
  ferias_dias: number | null;
  adicional_noturno: string | null;
  fonte: string;
} | null {
  const periodo = parsePeriodoIso(row.periodo);
  if (!periodo) return null;
  return {
    employee_id: employeeId,
    unit_id: unitId,
    periodo,
    horas_previstas: trimOrNull(row.horasPrevistas),
    horas_trabalhadas: trimOrNull(row.horasTrabalhadas),
    banco_horas_positivo: trimOrNull(row.bancoHorasPositivo),
    banco_horas_negativo: trimOrNull(row.bancoHorasNegativo),
    saldo_banco: trimOrNull(row.saldo),
    banco_horas_acumulado: trimOrNull(row.bancoHorasAcumulado),
    faltas_injustificadas_dias: parseNum(row.faltasInjustificadasDias),
    atestado_horas: trimOrNull(row.atestadoMedico),
    afastamentos_dias: parseNum(row.afastamentosDias),
    ferias_dias: parseNum(row.feriasDias),
    adicional_noturno: trimOrNull(row.adicionalNoturno),
    fonte: "totvs",
  };
}

/** Shape para overtime_records (Marena). null se sem horas positivas. */
export function csvRowToOvertimeRecord(
  row: PontoCsvRow,
  employeeId: string,
  unitId: string,
): {
  employee_id: string;
  unit_id: string;
  date: string;
  hours: number;
  type: "banco";
  periodo: string;
  source: "totvs";
  approved: true;
  reason: string;
} | null {
  const periodo = parsePeriodoIso(row.periodo);
  if (!periodo) return null;
  const hours = parseHoursToDecimal(row.bancoHorasPositivo);
  if (!hours) return null;
  return {
    employee_id: employeeId,
    unit_id: unitId,
    date: periodo, // primeiro dia do mês
    hours,
    type: "banco",
    periodo,
    source: "totvs",
    approved: true,
    reason: "Importado do Totvs",
  };
}
