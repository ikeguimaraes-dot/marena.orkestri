import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {parseWorkbook} from '../scripts/ork-workbook.mjs';
function workbook(sheets) {
 const b=XLSX.utils.book_new();
 for(const [name,cells] of Object.entries(sheets)) XLSX.utils.book_append_sheet(b,{'!ref':'A1:AA220',...cells},name);
 return XLSX.write(b,{type:'buffer',bookType:'xlsx'});
}
const n=v=>({t:'n',v}),s=v=>({t:'s',v}),d=v=>({t:'d',v:new Date(`${v}T00:00:00Z`)});
test('receita não repete subtotais, separa não monetários e acusa diferença',()=>{
 const {rows,issues}=parseWorkbook(workbook({'jun-26':{B7:d('2026-06-01'),C7:n(100),L7:n(20),O7:n(120),O108:n(130)}}));
 assert.equal(rows.length,2);assert.equal(rows[0].amount,100);assert.equal(rows[1].kind,'nao_monetario');
 assert.ok(issues.some(i=>i.title==='Receita não fecha com o total da planilha'));
});
test('não presume data, quitação ou categoria ausentes; conserva negativo e zero',()=>{
 const {rows}=parseWorkbook(workbook({'Despesas Operacionais - 2026':{E3:s('Estorno'),F3:n(-20),F4:n(0)}}));
 assert.equal(rows.length,2);assert.equal(rows[0].occurred_on,null);assert.equal(rows[0].category_original,null);
 assert.equal(rows[0].details.date_meaning,'a_confirmar');assert.equal(rows[1].amount,0);
});
test('parcela usa vencimento sem somar resumo da fatura',()=>{
 const {rows}=parseWorkbook(workbook({'Cartão Crédito - Itaú':{C4:d('2026-06-15'),C5:n(-500),B7:d('2026-05-02'),C7:n(-100),Z7:s('Equipamento')}}));
 assert.equal(rows.length,1);assert.equal(rows[0].amount,-100);assert.equal(rows[0].occurred_on,'2026-06-15');
});
test('mesmo arquivo tem identidade estável e referências únicas',()=>{
 const bytes=workbook({'Despesas Operacionais - 2026':{E3:s('Gasto'),F3:n(100),E4:s('Gasto'),F4:n(100)}});
 const a=parseWorkbook(bytes),b=parseWorkbook(bytes);
 assert.equal(a.checksum,b.checksum);assert.equal(new Set(a.rows.map(r=>r.source_ref)).size,a.rows.length);
 assert.ok(a.issues.some(i=>i.title==='Possível repetição de despesa'));
});
test('erro de fórmula é pendência, não zero fabricado',()=>{
 const {issues}=parseWorkbook(workbook({'Consolidado - 2026':{B14:s('Despesa'),D14:{t:'n',v:0,f:'IFERROR(#REF!,0)'}}}));
 assert.ok(issues.some(i=>i.title==='Referência quebrada na planilha'));
});
