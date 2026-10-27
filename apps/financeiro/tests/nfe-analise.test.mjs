import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
function setup(fail=false) {
 const calls=[];
 const compras=Array.from({length:120},(_,i)=>[0,1].map(j=>({produto_id:`p${i}`,fornecedor_codigo:`f${i}`,fornecedor_nome:`Fornecedor ${i}`,item_codigo:`c${i}`,dt_emissao:`2026-06-${j?'20':'10'}T12:00:00-03:00`,nr_danfe:String(j),chave_nfe:`${i}-${j}`,v_custo_compra:j?12:10,q_embalagem:1,v_total_danfe:100}))).flat();
 const catalogo=Array.from({length:120},(_,i)=>({id:`p${i}`,codigo:`c${i}`,nome:`Produto ${i}`,ncm:null,unidade_padrao:'KG'}));
 const db={rpc:async(name,args)=>{calls.push({name,args});return fail?{data:null,error:{message:'timeout'}}:{data:{compras,catalogo},error:null};}};
 const {getEvolucaoPorCompra}=loadTs('src/app/financeiro/dre/cmv/actions.ts',{
 '@maza/auth/unit-display':{},'@maza/auth/server':{},'@maza/auth/unit':{},'@maza/db/supabase/server':{},
 '@/lib/financeiro/db/client':{createFinanceiroClient:async()=>db},
 '@/lib/financeiro/razao/gerar':{},
 });
 return {getEvolucaoPorCompra,calls};
}
test('análise carrega histórico em uma consulta e preserva variações',async()=>{
 const {getEvolucaoPorCompra,calls}=setup();const result=await getEvolucaoPorCompra('unit');
 assert.equal(result.length,120);
 assert.equal(result[0].ultimaVarPct,20);
 assert.equal(result[0].compras.length,2);
 assert.equal(result[0].precoMinimo,10);
 assert.equal(result[0].precoMaximo,12);
 assert.equal(result[0].precoMedio,11);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'financeiro_evolucao_compras');
 assert.equal(calls[0].args.p_unit,'unit');
});
test('falha de consulta não se apresenta como ausência de produtos',async()=>{
 await assert.rejects(setup(true).getEvolucaoPorCompra('unit'),/Não foi possível carregar/);
});
