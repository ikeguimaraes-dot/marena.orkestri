import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {contasOperacionais,categoriaOperacional}=loadTs('src/lib/dre/regras-operacionais.ts');
const {classificarItemNfeDespesa,agregarItensNfeDespesa}=loadTs('src/lib/dre/nfe-despesas.ts');
test('utilidades reconhecem contas de consumo sem confundir água para revenda ou limpeza',()=>{
 assert.equal(categoriaOperacional('CONSUMO ÁGUA'),'Água e esgoto');
 assert.equal(categoriaOperacional('CONSUMO DE ENERGIA'),'Energia elétrica');
 assert.equal(categoriaOperacional('AGUA SANITARIA'),null);
 assert.equal(categoriaOperacional('BEBIDAS - AGUA'),null);
 const t=(descricao,v)=>({id:descricao,descricao_c_gerencial:descricao,v_titulo:v,d_competencia:'2026-08-01',ref_mes:null});
 const rows=[t('ALUGUEL',43217.64),t('ENERGIA',8494.18),t('CONSUMO ÁGUA',6167.82),t('INTERNET',333.56)];
 assert.equal(contasOperacionais('Ocupação',rows,[])[0].total,43217.64);
 assert.equal(contasOperacionais('Utilidades',rows,[]).reduce((s,c)=>s+c.total,0),14995.56);
 assert.equal(contasOperacionais('Manutenção',rows,[]).length,0);
});
test('itens de NF-e de entrada seguem o plano de contas operacional',()=>{
 const item=(descricao,ncm='',fornecedor='')=>({item_descricao:descricao,tipo_item:ncm,fornecedor_nome:fornecedor});
 const gas=classificarItemNfeDespesa(item('ONU 1075 GLP 2.1 - P-13','27111910')); assert.equal(gas.linha,'Utilidades');assert.equal(gas.conta,'Gás Encanado');
 const limpeza=classificarItemNfeDespesa(item('NEUTER SUPER - 05 LT GL DETERGENTE','34029039')); assert.equal(limpeza.linha,'Operação');assert.equal(limpeza.conta,'Material de Limpeza');
 const embalagem=classificarItemNfeDespesa(item('SACO PLAST.P/VACUO 35X45 0,18 C/500','39239090')); assert.equal(embalagem.linha,'Operação');assert.equal(embalagem.conta,'Embalagens');
 const manutencao=classificarItemNfeDespesa(item('COMP ELGIN ECB2480E 2.0 220V','84143019','CAPITAL REFRIG - SP')); assert.equal(manutencao.linha,'Manutenção');assert.equal(manutencao.conta,'Manutenção e Conservação');
 const adm=classificarItemNfeDespesa(item('TONER BROTHER TNB021BR','84439933')); assert.equal(adm.linha,'Administrativo');assert.equal(adm.conta,'Material de Escritório');
 assert.equal(classificarItemNfeDespesa(item('FREEZER VERTICAL BUCHOLZ','84185090','MAQGEL')),null,'imobilizado ambíguo não entra automaticamente na DRE');
 assert.equal(classificarItemNfeDespesa(item('RICOTA NO SACO COM 2 KG','04061090')),null,'alimento com palavra saco continua no CMV');
});
test('agregação de NF-e ignora canceladas e soma competência sem arredondamento acumulado',()=>{
 const base={fornecedor_nome:'DISTUDO',tipo_item:'34029039',ano_lancamento:2026,mes_lancamento:6,v_total_embalagem:null};
 const contas=agregarItensNfeDespesa([
  {...base,chave_nfe:'ok',item_descricao:'DETERGENTE NEUTRO',v_custo_total:10.125},
  {...base,chave_nfe:'ok',item_descricao:'DETERGENTE NEUTRO',v_custo_total:2.125},
  {...base,chave_nfe:'cancelada',item_descricao:'DETERGENTE NEUTRO',v_custo_total:99},
 ],new Set(['ok']),2026);
 assert.equal(contas.length,1);assert.equal(contas[0].total,12.26);assert.equal(contas[0].meses['2026-06-01'],12.26);
});
test('administrativo inclui somente Cintia e soma pagamento e bonificação sem descontar nem somar vale',()=>{
 const f=(nome,etapa,pagamento,bonificacao)=>({nome,etapa,pagamento,bonificacao,competencia:'2026-08'});
 const rows=[f('CINTIA OLIVEIRA DE CARVALHO','mensal',3253.42,2772.99),f('CINTIA OLIVEIRA DE CARVALHO','adiantamento',1004.60,1845.36),f('OUTRA PESSOA','mensal',9999,0)];
 const c=contasOperacionais('Administrativo',[],rows);
 assert.equal(c.length,1);assert.equal(c[0].total,6026.41);assert.equal(c[0].meses['2026-08-01'],6026.41);
});
test('impostos usam lançamentos da planilha e financeiro inclui apenas contabilidade',()=>{
 const t=(id,descricao,valor,status)=>({id,descricao_c_gerencial:descricao,v_titulo:valor,d_competencia:'2026-07-01',liquidacao_origem:status});
 const rows=[t('1','IMPOSTOS - PIS **YOSHIMORI**',2439.70,'OK'),t('2','IMPOSTOS - COFINS **YOSHIMORI**',11255.53,'**'),t('3','CONTABILIDADE - ***YOSHIMORI***',3500,'OK - confirmado pelo usuário'),t('4','BEBIDAS',100,'OK')];
 const imposto=contasOperacionais('Impostos',rows,[]);
 assert.equal(imposto.length,2);assert.equal(imposto.reduce((s,c)=>s+c.total,0),13695.23);
 assert.equal(imposto[0].pagamentos_confirmados['2026-07-01'],true);
 assert.equal(imposto[1].pagamentos_confirmados['2026-07-01'],false);
 const financeiro=contasOperacionais('Despesas Financeiras',rows,[]);
 assert.equal(financeiro.length,1);assert.equal(financeiro[0].total,3500);
 assert.equal(financeiro[0].pagamentos_confirmados['2026-07-01'],true);
});
