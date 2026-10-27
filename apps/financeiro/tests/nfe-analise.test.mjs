import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
function setup(fail=false) {
 const calls=[];
 const source=Array.from({length:120},(_,i)=>[0,1].map(j=>({fornecedor_codigo:`f${i}`,fornecedor_nome:`Fornecedor ${i}`,item_codigo:`c${i}`,dt_emissao:`2026-06-${j?'20':'10'}T12:00:00-03:00`,nr_danfe:String(j),chave_nfe:`${i}-${j}`,v_custo_compra:j?12:10,q_embalagem:1,v_total_danfe:100}))).flat();
 const db={from(table){let filter;return {
 select(){return this},eq(){return this},not(){return this},order(){return this},
 in(column,values){calls.push({table,column,size:values.length});filter={column,values};return this},
 range(){return this},then(resolve){if(fail) return Promise.resolve({data:null,error:{message:'timeout'}}).then(resolve);
 const rows=table==='produtos_relatorio'?source:table==='produtos_depara'?Array.from({length:120},(_,i)=>({fornecedor_cnpj:`f${i}`,item_codigo:`c${i}`,produto_id:`p${i}`})):Array.from({length:120},(_,i)=>({id:`p${i}`,codigo:`c${i}`,nome:`Produto ${i}`,ncm:null,unidade_padrao:'KG'}));
 return Promise.resolve({data:filter?rows.filter(r=>filter.values.includes(r[filter.column])):rows,error:null}).then(resolve);},
 };}};
 const {getEvolucaoPorCompra}=loadTs('src/app/financeiro/dre/cmv/actions.ts',{
 '@maza/auth/unit-display':{},'@maza/auth/server':{},'@maza/auth/unit':{},'@maza/db/supabase/server':{},
 '@/lib/financeiro/db/client':{createFinanceiroClient:async()=>db},
 '@/lib/financeiro/razao/gerar':{fetchAllPaginado:async build=>{const r=await build(0,999);if(r.error)throw new Error(r.error.message);return r.data;}},
 });
 return {getEvolucaoPorCompra,calls};
}
test('análise consulta lotes limitados e compara compras sem perder produtos',async()=>{
 const {getEvolucaoPorCompra,calls}=setup();const result=await getEvolucaoPorCompra('unit');
 assert.equal(result.length,120);
 assert.equal(result[0].ultimaVarPct,20);
 assert.equal(result[0].compras.length,2);
 assert.ok(calls.filter(c=>c.table==='produtos_depara').every(c=>c.size<=50&&c.column==='fornecedor_cnpj'));
 assert.equal(calls.filter(c=>c.table==='produtos_catalogo').length,2);
 assert.ok(calls.filter(c=>c.table==='produtos_catalogo').every(c=>c.size<=100));
});
test('falha de consulta não se apresenta como ausência de produtos',async()=>{
 await assert.rejects(setup(true).getEvolucaoPorCompra('unit'),/Não foi possível carregar/);
});
