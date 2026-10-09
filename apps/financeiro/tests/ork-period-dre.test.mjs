import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function load(path){
 const source=readFileSync(new URL(path,import.meta.url),'utf8').replace("import {hojeSaoPaulo} from '@/lib/financeiro/dates';","const hojeSaoPaulo=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);");
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

test('intervalo preserva mês único, aceita legado e corrige ordem',async()=>{
 const {periodRange,periodLabel,defaultOrkPeriod}=await load('../src/lib/ork/period.ts');
 assert.deepEqual(periodRange({period:'2026-06'},'2025-01'),{from:'2026-06',to:'2026-06'});
 assert.deepEqual(periodRange({from:'2026-08',to:'2026-05'},'2025-01'),{from:'2026-05',to:'2026-08'});
 assert.match(periodLabel({from:'2026-05',to:'2026-08'}),/maio de 2026 a agosto de 2026/i);
 assert.equal(defaultOrkPeriod('2027-06',new Date('2026-10-09T12:00:00Z')),'2026-10');
 assert.equal(defaultOrkPeriod('2026-06',new Date('2026-10-09T12:00:00Z')),'2026-06');
});

test('DRE preliminar usa CC, separa investimento e preserva estorno',async()=>{
 const source=readFileSync(new URL('../src/lib/ork/dre.ts',import.meta.url),'utf8').replace("import type {MonthlyEvidence} from './monthly';",'');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2023}}).outputText;
 const {dreGroup,dreSignedAmount,matchesDreMonth}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
 const row=(category_original,amount=100,area='despesas')=>({category_original,amount,area});
 assert.equal(dreGroup(row('salários')),'pessoal');
 assert.equal(dreGroup(row('INSS empresa')),'tributos');
 assert.equal(dreGroup(row('FGTS Rescisão')),'tributos');
 assert.equal(dreGroup(row('manutenção predial')),'manutencao');
 assert.equal(dreGroup(row('assessoria / prestação de serviço (mkt)')),'marketing');
 assert.equal(dreGroup(row('investimento operacional')),'fora_dre');
 assert.equal(dreGroup({...row('depósitos judiciais'),description:'Custas Judiciais - Jerdson'}),'administrativas');
 assert.equal(dreGroup({...row('depósitos judiciais'),description:'Depósito Judicial - Jerdson'}),'fora_dre');
 assert.equal(dreGroup({...row('reembolso de despesas'),description:'CAT - Acidente Funcionário'}),'pessoal');
 assert.equal(dreGroup({...row('reembolso de despesa'),description:'Reembolso - Compra Ferro + Filtro de Água'}),'manutencao');
 assert.equal(dreGroup({...row('reembolso de despesas'),description:'Reembolso de Despesa'}),'administrativas');
 assert.equal(dreSignedAmount(row('salários',-20)),20);
 assert.equal(dreSignedAmount(row(null,50,'receita')),50);
 assert.equal(matchesDreMonth({period:'2025-06'},'06'),true);
 assert.equal(matchesDreMonth({period:'2026-07'},'06'),false);
 assert.equal(matchesDreMonth({period:'2026-07'},null),true);
});
