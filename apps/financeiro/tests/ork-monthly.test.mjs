import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {groupMonthlyEvidence}=loadTs('src/lib/ork/monthly.ts');
const row=(id,date,source,kind,amount)=>({id,occurred_on:date,source,kind,amount,description:id,source_ref:id,entity:null,category_original:null,details:{}});
test('groups evidence by day and keeps different meanings in separate groups',()=>{
 const days=groupMonthlyEvidence([row('a','2026-06-01','planilha','recebimento_previsto',100),row('b','2026-06-01','planilha','recebimento_informado',90),row('c','2026-06-02','nfe','nfe_saida',50)]);
 assert.equal(days.length,2);assert.equal(days[1].groups.length,2);
 assert.equal(days[1].groups.some(g=>g.key==='planilha:recebimento_previsto'),true);
 assert.equal(days[1].groups.some(g=>g.key==='planilha:recebimento_informado'),true);
});
test('keeps undated monthly references in an explicit row',()=>{
 const [day]=groupMonthlyEvidence([row('a',null,'planilha','orcamento_referencia',100)]);
 assert.equal(day.key,'sem-data');assert.equal(day.date,null);assert.equal(day.total,100);
});
