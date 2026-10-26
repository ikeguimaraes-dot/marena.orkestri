import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

for (const canWrite of [true, false]) {
  test(`recálculo respeita permissão de escrita: ${canWrite}`, async () => {
    let calls = 0;
    let authenticated = false;
    const db = { rpc: async (name, args) => {
      assert.equal(authenticated, true);
      assert.equal(name, 'financeiro_can_write');
      assert.equal(args.p_unit, 'marena');
      return { data: canWrite, error: null };
    } };
    const { recalcularIndicadoresFolha } = loadTs('src/app/financeiro/folha/dominio/actions.ts', {
      '@maza/auth/server': { requireUser: async () => { authenticated = true; } },
      '@/lib/financeiro/db/client': { createFinanceiroClient: async () => db },
      '@/lib/folha/dominio/importar': {},
      '@/lib/financeiro/razao/refresh': { refreshUnits: async (client, units) => {
        assert.equal(client, db);
        assert.equal(units.join(','), 'marena');
        calls++;
      } },
    });
    const result = await recalcularIndicadoresFolha('marena');
    assert.equal(result.ok, canWrite);
    assert.equal(calls, canWrite ? 1 : 0);
  });
}
