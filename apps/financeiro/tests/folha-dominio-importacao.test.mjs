import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

function setup(mapping, error = null, failures = {}) {
  const writes = [];
  const filters = [];
  const refreshes = [];
  const { importarExtratoDominioParaBanco } = loadTs('src/lib/folha/dominio/importar.ts', {
    '@/lib/financeiro/razao/refresh': { refreshUnits: async (_db, units) => { refreshes.push(units); if (failures.refresh) throw new Error('recálculo falhou'); } },
    '@/lib/financeiro/db/atomic': { applyBatch: async (_db, operations, options) => { assert.equal(options.refresh, false); if (failures.write) throw new Error("gravação falhou"); writes.push(operations); } },
  });
  const query = {
    select() { return this; },
    eq(column, value) { filters.push([column, value]); return this; },
    async in(column, values) {
      filters.push([column, values]);
      return { data: mapping.filter(row => filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)), error };
    },
  };
  const db = { from(table) { assert.equal(table, 'unit_cnpjs'); return query; } };
  const resultado = { arquivoOrigem: 'recibos.pdf', avisos: [], competencias: [{
    cnpj: '55631066000171', competencia: '2026-06', codEmpresaDominio: '',
    colaboradores: [], linhasProvento: [], linhasDesconto: [], resumoRubricas: [],
  }] };
  return { run: () => importarExtratoDominioParaBanco(db, resultado), writes, filters, refreshes };
}

for (const papel of ['faturamento', 'compras', 'folha']) {
  test(`importa na unidade do CNPJ ativo com papel ${papel}`, async () => {
    const s = setup([{ cnpj: '55631066000171', unit_id: 'marena', papel, ativo: true }]);
    const result = await s.run();
    assert.equal(result.ok, true);
    assert.equal(result.competencias[0].unitId, 'marena');
    assert.equal(s.writes.length, 1);
    for (const op of s.writes[0]) {
      if (op.scope) assert.equal(op.scope.unit_id, 'marena');
      for (const row of op.rows ?? []) assert.equal(row.unit_id, 'marena');
    }
  });
}

test('não grava CNPJ inativo, desconhecido ou sem acesso por RLS', async () => {
  for (const mapping of [[], [{ cnpj: '55631066000171', unit_id: 'marena', papel: 'folha', ativo: false }]]) {
    const s = setup(mapping);
    const result = await s.run();
    assert.equal(result.ok, false);
    assert.match(result.competencias[0].error, /sem vínculo ativo/);
    assert.equal(s.writes.length, 0);
  }
});

test('erro na consulta impede gravação', async () => {
  const s = setup([], { message: 'Falha na consulta' });
  await assert.rejects(s.run, /Falha na consulta/);
  assert.equal(s.writes.length, 0);
});

const mapping = [{ cnpj: '55631066000171', unit_id: 'marena', papel: 'folha', ativo: true }];
test('folha salva continua sendo sucesso quando o recálculo falha', async () => {
  const s = setup(mapping, null, { refresh: true });
  const result = await s.run();
  assert.equal(s.writes.length, 1);
  assert.equal(s.refreshes.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.competencias[0].ok, true);
  assert.match(result.competencias[0].aviso, /Folha salva/);
  assert.equal(result.competencias[0].error, undefined);
});
test('falha de gravação não é confundida com aviso de recálculo', async () => {
  const s = setup(mapping, null, { write: true });
  const result = await s.run();
  assert.equal(result.ok, false);
  assert.equal(s.refreshes.length, 0);
  assert.match(result.competencias[0].error, /Não foi possível salvar/);
  assert.equal(result.competencias[0].aviso, undefined);
});
