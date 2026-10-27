import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { splitNfeBatches } = loadTs('src/lib/nfe/batches.ts');
const note = (i, itens = []) => ({ chave: String(i), xmlOriginal: '<NFe/>', itens });
test('mil saídas usam dez chamadas sem perder notas ou mudar a ordem', () => {
  const notes = Array.from({ length: 1000 }, (_, i) => note(i));
  const batches = splitNfeBatches(notes, 'saida');
  assert.equal(batches.length, 10);
  assert.equal(batches.flat().length, notes.length);
  batches.flat().forEach((entry, i) => assert.equal(entry, notes[i]));
  assert.equal(splitNfeBatches(notes, 'entrada').length, 50);
});
test('lotes respeitam bytes UTF-8 e preservam XMLs completos', () => {
  const notes = Array.from({ length: 3 }, (_, i) => ({ ...note(i), xmlOriginal: 'ç'.repeat(600_000) }));
  const batches = splitNfeBatches(notes, 'saida');
  assert.equal(batches.length, 2);
  for (const batch of batches) assert.ok(Buffer.byteLength(JSON.stringify(batch)) <= 2_500_000);
  assert.equal(batches.flat()[2].xmlOriginal, notes[2].xmlOriginal);
});
test('limite de itens mantém documentos inteiros', () => {
  const notes = [note(1, Array(600).fill({})), note(2, Array(600).fill({})), note(3, Array(1200).fill({}))];
  assert.equal(splitNfeBatches(notes, 'saida').length, 3);
  assert.equal(splitNfeBatches([], 'saida').length, 0);
});
test('saída persiste sem consultar catálogo de compras', async () => {
  const tables = [];
  const mutations = [];
  const db = { from(table) {
    tables.push(table);
    return {
      select() { return this; }, eq() { return this; }, in() { return this; },
      then(resolve) { return Promise.resolve({ data: table === 'unit_cnpjs' ? [{ cnpj: '123', unit_id: 'unit' }] : [], error: null }).then(resolve); },
    };
  } };
  const { importNfe } = loadTs('src/app/financeiro/dre/cmv/actions.ts', {
    '@maza/auth/unit-display': { unitDisplayName: () => 'Test' },
    '@maza/auth/server': { requireUser: async () => ({ id: 'user' }) },
    '@maza/auth/unit': { getCurrentUnit: async () => ({ id: 'unit' }) },
    '@maza/db/supabase/server': {},
    '@/lib/financeiro/db/client': { createFinanceiroClient: async () => db },
    '@/lib/financeiro/razao/gerar': {},
    '@/lib/financeiro/db/atomic': {
      applyBatch: async (_, ops) => mutations.push(...ops),
      replacement: (table, scope, rows) => [{ table, scope, rows }],
    },
  });
  const result = await importNfe({ arquivo: 'test.xml', direcao: 'saida', adiarRecalculo: true, rejeitadas: 0, notas: [{
    ...note('1'.repeat(44)), emitenteCnpj: '123', emissao: '2026-10-01', valorTotal: 10, cancelada: false,
  }] });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.importadas, 1);
  assert.deepEqual(tables, ['unit_cnpjs', 'nfe_documentos']);
  assert.ok(mutations.some(op => op.table === 'nfe_documentos'));
});
