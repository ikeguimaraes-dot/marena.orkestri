import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts.mjs';
const { sendNfeBatches } = loadTs('src/lib/nfe/send-batches.ts');
const timeout = { ok:false, error:'Falha ao salvar; a versão anterior foi preservada: canceling statement due to statement timeout' };
const context = {arquivo:'teste.zip',direcao:'saida',rejeitadas:2};
const notes = Array.from({length:8},(_,i)=>({numero:String(i),chave:String(i)}));
test('timeout divide lote, mantém ordem e não repete sucessos nem rejeitadas',async()=>{
 const saved=[], counts=[], progress=[];
 for await (const result of sendNfeBatches([notes],context,async p=>{
  if(p.notas.length>2)return timeout;
  saved.push(...p.notas);counts.push(p.rejeitadas);return {ok:true};
 }))progress.push(result.processed);
 assert.deepEqual(saved,notes);
 assert.deepEqual(counts,[2,0,0,0]);
 assert.deepEqual(progress,[2,4,6,8]);
});
test('falha de rede não é repetida, pois o commit é desconhecido',async()=>{
 let calls=0;
 await assert.rejects(async()=>{for await(const result of sendNfeBatches([notes],context,async()=>{calls++;throw new Error('network');}))void result;},/network/);
 assert.equal(calls,1);
});
test('erro de validação não é repetido',async()=>{
 let calls=0;
 await assert.rejects(async()=>{for await(const result of sendNfeBatches([notes],context,async()=>{calls++;return {ok:false,error:'CNPJ inválido'};}))void result;},/CNPJ/);
 assert.equal(calls,1);
});
test('timeout de nota isolada encerra tentativas',async()=>{
 let calls=0;
 await assert.rejects(async()=>{for await(const result of sendNfeBatches([[notes[0]]],context,async()=>{calls++;return timeout;}))void result;},/mesmo isolada/);
 assert.equal(calls,1);
});
