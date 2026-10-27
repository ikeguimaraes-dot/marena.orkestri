export type ReceitaDia = { unit_id: string; data: string; receita_liquida: number | null };
export type ReceitaFiscal = { unit_id: string; competencia: string; receita: number; pis: number; cofins: number };
export type FaturamentoMes = { valor: number | null; criterio: string };

// A EFD é mensal: não somar com dias operacionais da mesma unidade/mês.
export function faturamentoPorMes(unitIds: string[], janela: string[], dias: ReceitaDia[], fiscal: ReceitaFiscal[]): Record<string, FaturamentoMes> {
  return Object.fromEntries(janela.map(mes => {
    let valor = 0;
    let presentes = 0;
    const fontes = new Set<string>();
    for (const unitId of unitIds) {
      const efd = fiscal.filter(r => r.unit_id === unitId && r.competencia === mes.slice(0, 7));
      const operacional = dias.filter(r => r.unit_id === unitId && r.data.startsWith(mes.slice(0, 7)));
      if (efd.length) {
        valor += efd.reduce((s, r) => s + Number(r.receita) - Number(r.pis) - Number(r.cofins), 0);
        presentes++;
        fontes.add('EFD: receita menos PIS e Cofins');
      } else if (operacional.length && operacional.every(r => r.receita_liquida != null)) {
        valor += operacional.reduce((s, r) => s + Number(r.receita_liquida), 0);
        presentes++;
        fontes.add('Receita líquida operacional');
      }
    }
    return [mes, { valor: presentes === unitIds.length && presentes > 0 ? Math.round(valor * 100) / 100 : null,
      criterio: presentes < unitIds.length ? 'Receita não disponível para todas as unidades no período' : [...fontes].join(' · ') }];
  }));
}
