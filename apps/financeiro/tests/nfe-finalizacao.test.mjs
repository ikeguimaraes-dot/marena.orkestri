import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

function actions(fail) {
  return loadTs('src/app/financeiro/dre/cmv/actions.ts', {
    '@maza/auth/unit-display': {}, '@maza/auth/unit': {}, '@maza/db/supabase/server': {},
    '@maza/auth/server': { requireUser: async () => {} },
    '@/lib/financeiro/db/client': { createFinanceiroClient: async () => ({ from: () => ({ select: async () => ({ data: [{ id: 'unit' }], error: null }) }) }) },
    '@/lib/financeiro/razao/gerar': {},
    '@/lib/financeiro/razao/refresh': { refreshUnits: async (_, ids) => { assert.deepEqual(Array.from(ids), ['unit']); if (fail) throw new Error('statement timeout'); } },
  });
}
test('finalização retorna falha tratável para timeout e permite nova tentativa', async () => {
  const failed = await actions(true).finalizarImportacaoNfe(['unit']);
  assert.equal(failed.ok, false);
  assert.match(failed.error, /notas foram salvas/);
  assert.equal((await actions(false).finalizarImportacaoNfe(['unit'])).ok, true);
});
test('descoberta de competências não percorre itens das notas de saída', async () => {
  const filters = [];
  const { refreshUnits } = loadTs('src/lib/financeiro/razao/refresh.ts', {
    '@/lib/financeiro/razao/gerar': {},
    './gerar': { fetchAllPaginado: async build => (await build(0, 999)).data, gerarRazao: async () => { throw new Error('sem competências a recalcular'); } },
  });
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: table => ({
      select() { return this; }, eq(key, value) { filters.push([table, key, value]); return this; }, in() { return this; },
      range: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: { revisao: 1 }, error: null }),
    }),
  };
  await refreshUnits(db, ['unit']);
  assert.ok(filters.some(([table, key, value]) => table === 'produtos_relatorio' && key === 'direcao_nfe' && value === 'entrada'));
});
