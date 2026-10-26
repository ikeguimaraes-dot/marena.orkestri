import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { parseRecibosItems } = loadTs('src/lib/folha/dominio/recibos.ts');
function recibo(mes = 'Junho', continuation = false) {
  const items = [];
  const row = (y, values) => values.forEach(([x,text]) => items.push({x,y,text,page:1}));
  row(773,[[40,'EMPRESA TESTE']]);
  row(763,[[40,'CNPJ:'],[77,'12.345.678/0001-90']]);
  row(753,[[438,mes],[468,'de'],[482,'2026']]);
  row(733,[[50,'1'],[81,'PESSOA TESTE'],[371,'513415'],[442,'5'],[487,'1']]);
  row(723,[[81,'Cumim'],[374,'Admissão:'],[453,'01/07/2025']]);
  row(706,[[375,'Vencimentos']]);
  row(695,[[42,'8781'],[68,'DIAS NORMAIS'],[329,'30,00'],[388,'100,00']]);
  row(685,[[42,'998'],[68,'INSS'],[329,'10,00'],[472,'10,00']]);
  row(521,[[375,'Total de Vencimentos'],[451,'Total de Descontos']]);
  row(506,[[387,continuation?'*********':'100,00'],[462,continuation?'*********':'10,00']]);
  if(continuation) row(506,[[37,'A'],[47,'TRANSPORTAR']]);
  row(487,[[361,'Valor Líquido'],[462,'90,00']]);
  row(473,[[65,'Salário Base'],[145,'Sal. Contr. INSS'],[227,'Base Cálc. FGTS'],[312,'F.G.T.S do Mês'],[393,'Base Cálc. IRRF']]);
  row(463,[[57,'100,00'],[140,'100,00'],[223,'100,00'],[311,'8,00'],[388,'90,00']]);
  return items;
}
test('usa mês do conteúdo mesmo com nome incorreto e elimina segunda via', () => {
  for(const [index,mes] of ['Junho','Julho','Agosto','Setembro'].entries()) {
    const page=recibo(mes);
    const result=parseRecibosItems('arquivo-01-2025.pdf',[[...page,...page.map(i=>({...i,y:i.y-380}))]]);
    const comp=result.competencias[0];
    assert.equal(comp.competencia,`2026-0${index+6}`);
    assert.equal(comp.colaboradores.length,1);
    assert.equal(comp.totalGeralProventos,100);
    assert.equal(comp.totalGeralDescontos,10);
    assert.equal(comp.valorFgts,8);
    assert.equal(comp.linhasProvento.length,1);
    assert.equal(comp.linhasDesconto.length,1);
  }
});
test('agrupa meses distintos sem misturar valores',()=>{
  const result=parseRecibosItems('folha.pdf',[recibo('Junho'),recibo('Julho')]);
  assert.equal(result.competencias.length,2);
  assert.equal(result.competencias[1].liquidoGeral,90);
});
test('rejeita documento incompleto ou totais divergentes',()=>{
  assert.throws(()=>parseRecibosItems('folha.pdf',[recibo('Junho',true)]),/incompleto/);
  const page=recibo();page.find(i=>i.y===506&&i.x===387).text='200,00';
  assert.throws(()=>parseRecibosItems('folha.pdf',[page]),/não conferem/);
  assert.throws(()=>parseRecibosItems('folha.pdf',[[]]),/sem texto/);
});
test('soma continuação, sem duplicar as duas vias de cada página',()=>{
  const first=recibo('Junho',true).filter(i=>i.y!==685);
  const last=recibo().filter(i=>i.y!==695);
  const duplicate=page=>[...page,...page.map(i=>({...i,y:i.y-380}))];
  const result=parseRecibosItems('folha.pdf',[duplicate(first),duplicate(last)]);
  assert.equal(result.competencias[0].totalGeralProventos,100);
  assert.equal(result.competencias[0].colaboradores.length,1);
});
