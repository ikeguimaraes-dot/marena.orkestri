export type NotaFaturamento = { unit_id: string; emissao: string; valor_total: number | null };
export type FaturamentoMes = { valor: number | null; criterio: string };
const calendario = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' });

// Recebe apenas documentos de saída não cancelados, nunca itens da nota.
export function faturamentoPorMes(unitIds: string[], janela: string[], notas: NotaFaturamento[]): Record<string, FaturamentoMes> {
  const unidades = new Set(unitIds);
  const totais = new Map<string, number>();
  for (const nota of notas) {
    if (!unidades.has(nota.unit_id) || nota.valor_total == null) continue;
    const parts = calendario.formatToParts(new Date(nota.emissao));
    const mes = `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-01`;
    totais.set(mes, (totais.get(mes) ?? 0) + Math.round(Number(nota.valor_total) * 100));
  }
  return Object.fromEntries(janela.map(mes => [mes, {
    valor: totais.has(mes) ? totais.get(mes)! / 100 : null,
    criterio: 'Total das NF-e/NFC-e de saída · exclui canceladas',
  }]));
}
