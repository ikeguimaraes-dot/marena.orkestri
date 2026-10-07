export type EfdResumo = {
  cnpj: string;
  competencia: string;
  receita: number;
  pis: number;
  cofins: number;
};

export type EfdProdutoDia = {
  codigo: string;
  produto: string;
  bruto: number;
  documentos: number;
};

export type EfdVendaDia = {
  data: string;
  bruto: number;
  gorjeta: number;
  produtos: EfdProdutoDia[];
};

const money = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));

/** Extract only explicit summary labels. PIS and COFINS repeat the same sales. */
export function parseEfdResumo(text: string): EfdResumo {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cnpjs = [...new Set([...normalized.matchAll(/CNPJ:\s*([\d./-]+)/g)].map(m => m[1]!.replace(/\D/g, "")))];
  const periods = [...new Set([...normalized.matchAll(/Competencia:\s*(\d{2})\/(\d{4})/g)].map(m => `${m[2]}-${m[1]}`))];
  if (cnpjs.length !== 1 || !/^\d{14}$/.test(cnpjs[0] ?? "") || periods.length !== 1 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(periods[0] ?? "")) {
    throw new Error("O PDF deve conter um único CNPJ e uma única competência válida.");
  }
  if (!normalized.includes("RESUMO DAS CONTRIBUICOES DO PIS") || !normalized.includes("RESUMO DAS CONTRIBUICOES DO COFINS")) {
    throw new Error("Selecione o demonstrativo EFD completo, com os resumos de PIS e COFINS.");
  }
  const totals = [...normalized.matchAll(/(?:^|\n)\s*Total das Receitas\s+([\d.]+,\d{2})\s*(?=\n|$)/g)].map(m => money(m[1]!));
  if (totals.length !== 2 || totals[0] !== totals[1]) throw new Error("Os totais de receita dos resumos PIS e COFINS estão ausentes ou divergentes.");
  const readTax = (label: string) => {
    const matches = [...normalized.matchAll(new RegExp(`Saldo devedor da Contribuicao ${label}\\s+([\\d.]+,\\d{2})`, "g"))];
    if (matches.length !== 1) throw new Error(`Apuração de ${label} ausente ou duplicada.`);
    return money(matches[0]![1]!);
  };
  return { cnpj: cnpjs[0]!, competencia: periods[0]!, receita: totals[0]!, pis: readTax("PIS/PASEP"), cofins: readTax("COFINS") };
}

export type EfdTextItem = { str: string; transform: number[] };
/** Preserve rows using PDF coordinates, rather than the PDF stream order. */
export function efdPageText(items: EfdTextItem[]): string {
  const rows: { y: number; items: EfdTextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5]!;
    let row = rows.find(row => Math.abs(row.y - y) < 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map(row => row.items.sort((a, b) => a.transform[4]! - b.transform[4]!).map(item => item.str).join(" ")).join("\n");
}

const rowPattern = /^\s*\d+\s+(\d{2}\/\d{2}\/\d{4})\s+NFC-e\s+(\d+)\s+\d-\d{3}\s+(\d+)\s+-\s+(.+)$/i;
const valuePattern = /(?:^|\s)((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})(?=\s|$)/g;

/** Extracts the PIS half only. The COFINS half repeats every fiscal sale. */
export function parseEfdVendaRows(pageTexts: string[]): EfdVendaDia[] {
  const byDay = new Map<string, { bruto: number; gorjeta: number; produtos: Map<string, EfdProdutoDia> }>();
  let inPis = false;
  let parsedRows = 0;
  for (const pageText of pageTexts) {
    const normalized = pageText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (/DEMONSTRATIVO DAS RECEITAS CUMULATIVAS DO COFINS/i.test(normalized)) break;
    if (/DEMONSTRATIVO DAS RECEITAS CUMULATIVAS DO PIS\/PASEP/i.test(normalized)) inPis = true;
    if (!inPis) continue;
    for (const line of normalized.split("\n")) {
      const row = rowPattern.exec(line);
      if (!row) continue;
      const rest = row[4]!;
      const values = [...rest.matchAll(valuePattern)];
      const first = values[0];
      const accountingValue = values[1];
      if (!first || first.index == null || !accountingValue) continue;
      const rawProduct = rest.slice(0, first.index).trim().replace(/\s+\d{2}\s*$/, "").trim();
      if (!rawProduct) continue;
      const [dd, mm, yyyy] = row[1]!.split("/");
      const data = `${yyyy}-${mm}-${dd}`;
      const codigo = row[3]!;
      // Valor Contábil reconciles to "Total das Receitas"; Valor Produto may
      // include amounts excluded from the fiscal revenue summary.
      const bruto = money(accountingValue[1]!);
      const isService = codigo === "9990000000" || /TAXA DE SERVICO/i.test(rawProduct);
      const day = byDay.get(data) ?? { bruto: 0, gorjeta: 0, produtos: new Map() };
      day.bruto += bruto;
      if (isService) day.gorjeta += bruto;
      const key = `${codigo}|${rawProduct}`;
      const product = day.produtos.get(key) ?? { codigo, produto: rawProduct, bruto: 0, documentos: 0 };
      product.bruto += bruto;
      product.documentos += 1;
      day.produtos.set(key, product);
      byDay.set(data, day);
      parsedRows += 1;
    }
  }
  if (!inPis || parsedRows === 0) throw new Error("Não foi possível localizar as vendas NFC-e na seção PIS do demonstrativo.");
  const round = (value: number) => Math.round(value * 100) / 100;
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([data, day]) => ({
    data,
    bruto: round(day.bruto),
    gorjeta: round(day.gorjeta),
    produtos: [...day.produtos.values()].sort((a, b) => b.bruto - a.bruto).map(p => ({ ...p, bruto: round(p.bruto) })),
  }));
}
