export type EfdResumo = {
  cnpj: string;
  competencia: string;
  receita: number;
  pis: number;
  cofins: number;
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
