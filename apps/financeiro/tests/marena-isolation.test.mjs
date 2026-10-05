import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';

test('sem canal delivery configurado, compras permanecem na unidade selecionada',async()=>{
 const previous=process.env.NEXT_PUBLIC_DELIVERY_UNIT_ID;
 delete process.env.NEXT_PUBLIC_DELIVERY_UNIT_ID;
 try {
  const {importarLinhasCompra}=loadTs('src/lib/financeiro/importacao/compras/importarCompras.ts');
  let captured;
  const db={async rpc(name,args){assert.equal(name,'financeiro_importar_titulos');captured=args.p_rows;return {error:null};}};
  const result=await importarLinhasCompra(db,[{dCompetencia:'2026-10-01',vTitulo:100,ehIkyDelivery:true,fornecedorNome:'Fornecedor exemplo'}],'11111111-1111-4111-8111-111111111111','compra','nf_pedidos');
  assert.equal(result.ok,true);assert.equal(captured[0].unit_id,'11111111-1111-4111-8111-111111111111');assert.equal(result.roteadosParaIky,0);
 } finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_DELIVERY_UNIT_ID;else process.env.NEXT_PUBLIC_DELIVERY_UNIT_ID=previous;}
});

test('nomes das unidades são os cadastros do cliente, sem apelidos herdados',()=>{
 const {unitDisplayName}=loadTs('lib/maza/auth/unit-display.ts');
 assert.equal(unitDisplayName({id:'11111111-1111-4111-8111-111111111111',name:'Marena Centro'}),'Marena Centro');
});
