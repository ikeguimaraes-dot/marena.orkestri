import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { faturamentoPorMes } = loadTs('src/components/financeiro/cockpit/faturamento.ts');
const janela = ['2026-06-01', '2026-07-01'];
test('EFD deduz tributos e não duplica receita operacional do mesmo mês', () => {
 const result = faturamentoPorMes(['a'], janela, [{unit_id:'a',data:'2026-06-01',receita_liquida:500}], [{unit_id:'a',competencia:'2026-06',receita:1000,pis:10,cofins:40}]);
 assert.equal(result[janela[0]].valor,950);
 assert.equal(result[janela[1]].valor,null);
});
test('operacional preserva líquido e zero; consolidado sem fonte não finge total completo', () => {
 const dias = [{unit_id:'a',data:'2026-06-01',receita_liquida:0}, {unit_id:'a',data:'2026-07-02',receita_liquida:120}];
 assert.equal(faturamentoPorMes(['a'],janela,dias,[])[janela[0]].valor,0);
 assert.equal(faturamentoPorMes(['a'],janela,dias,[])[janela[1]].valor,120);
 assert.equal(faturamentoPorMes(['a','b'],janela,dias,[])[janela[1]].valor,null);
});
test('consolida unidades e CNPJs distintos respeitando período', () => {
 const fiscal = [
 {unit_id:'a',competencia:'2026-06',receita:100,pis:1,cofins:4},
 {unit_id:'a',competencia:'2026-06',receita:200,pis:2,cofins:8},
 {unit_id:'b',competencia:'2026-07',receita:1000,pis:0,cofins:0}];
 const dias = [{unit_id:'b',data:'2026-06-15',receita_liquida:50}];
 assert.equal(faturamentoPorMes(['a','b'],janela,dias,fiscal)[janela[0]].valor,335);
});
