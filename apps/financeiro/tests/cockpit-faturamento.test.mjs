import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { faturamentoPorMes } = loadTs('src/components/financeiro/cockpit/faturamento.ts');
const janela = ['2026-06-01', '2026-07-01'];
test('faturamento soma valores fiscais completos em centavos, por unidade e mês', () => {
 const notas = [
 {unit_id:'a',emissao:'2026-06-10T12:00:00-03:00',valor_total:1402614.90},
 {unit_id:'a',emissao:'2026-06-15T12:00:00-03:00',valor_total:1401159.56},
 {unit_id:'b',emissao:'2026-06-15T12:00:00-03:00',valor_total:100},
 {unit_id:'a',emissao:'2026-07-10T12:00:00-03:00',valor_total:50}];
 assert.equal(faturamentoPorMes(['a'],janela,notas)[janela[0]].valor,2803774.46);
 assert.equal(faturamentoPorMes(['a'],janela,notas)[janela[1]].valor,50);
 assert.equal(faturamentoPorMes(['a','b'],janela,notas)[janela[0]].valor,2803874.46);
});
test('fronteira do mês segue São Paulo como a listagem de NF-e Saída', () => {
 const notas = [{unit_id:'a',emissao:'2026-07-01T02:59:59Z',valor_total:10}, {unit_id:'a',emissao:'2026-07-01T03:00:00Z',valor_total:20}];
 const result = faturamentoPorMes(['a'],janela,notas);
 assert.equal(result[janela[0]].valor,10);
 assert.equal(result[janela[1]].valor,20);
});
test('distingue nota com valor zero de ausência de notas', () => {
 const result = faturamentoPorMes(['a'],janela,[{unit_id:'a',emissao:'2026-06-01T12:00:00Z',valor_total:0}]);
 assert.equal(result[janela[0]].valor,0);
 assert.equal(result[janela[1]].valor,null);
});
