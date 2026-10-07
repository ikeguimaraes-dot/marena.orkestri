import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { parseEfdResumo, efdPageText } = loadTs('src/lib/receita/efd.ts');
const text = `CNPJ: 55.631.066/0001-71
Competência: 06/2026
RESUMO DAS CONTRIBUIÇÕES DO PIS
Total das Receitas tributadas 2.288.351,08
Total das Receitas 2.540.327,33
Saldo devedor da Contribuição PIS/PASEP 14.423,75
RESUMO DAS CONTRIBUIÇÕES DO COFINS
Total das Receitas 2.540.327,33
Saldo devedor da Contribuição COFINS 66.557,10`;
test('counts the repeated fiscal revenue once and reads final tax adjustments', () => {
  const result = parseEfdResumo(text);
  assert.equal(result.receita, 2540327.33);
  assert.equal(result.pis, 14423.75);
  assert.equal(result.cofins, 66557.10);
  assert.equal(result.competencia, '2026-06');
});
test('rejects inconsistent, incomplete and mixed reports', () => {
  assert.throws(() => parseEfdResumo(text.replace('2.540.327,33', '2.540.327,34')), /divergentes/);
  assert.throws(() => parseEfdResumo(text + '\nCNPJ: 11.222.333/0001-81'), /único CNPJ/);
  assert.throws(() => parseEfdResumo(text + '\nCompetência: 07/2026'), /competência/);
  assert.throws(() => parseEfdResumo(text.replace('Saldo devedor da Contribuição COFINS', 'Sem apuração')), /ausente/);
  assert.throws(() => parseEfdResumo('relatório de caixa'), /CNPJ/);
});
test('reconstructs visual rows irrespective of PDF text ordering', () => {
  const item = (str, x, y) => ({ str, transform: [1,0,0,1,x,y] });
  assert.equal(efdPageText([item('100,00', 200, 80), item('CNPJ:', 0, 100), item('Total das Receitas',0,80)]), 'CNPJ:\nTotal das Receitas 100,00');
});

test('server refuses an unmapped CNPJ and never writes', async () => {
  let writes = 0;
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; }, upsert() { writes++; } };
  const { saveEfd } = loadTs('src/app/financeiro/dre/receita/efd-actions.ts', {
    '@/lib/financeiro/db/client': { createFinanceiroClient: async () => ({ from: () => query }) },
  });
  const result = await saveEfd({ unitId: '00000000-0000-4000-8000-000000000001', text, filename: 'efd.pdf' });
  assert.equal(result.ok, false);
  assert.match(result.error, /CNPJ/);
  assert.equal(writes, 0);
});

test('server reparses evidence and upserts the monthly key rather than adding totals', async () => {
  let payload, options;
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { unit_id: 'unit' }, error: null }; }, async upsert(row, opts) { payload = row; options = opts; return { error: null }; } };
  const { saveEfd } = loadTs('src/app/financeiro/dre/receita/efd-actions.ts', {
    '@/lib/financeiro/db/client': { createFinanceiroClient: async () => ({ from: () => query }) },
  });
  const result = await saveEfd({ unitId: '00000000-0000-4000-8000-000000000001', text, filename: 'efd.pdf', receita: 999 });
  assert.equal(result.ok, true);
  assert.equal(payload.receita, 2540327.33);
  assert.equal(options.onConflict, 'unit_id,cnpj,competencia');
});
