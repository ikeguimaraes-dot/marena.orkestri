import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {groupRevenueByDay}=loadTs('src/lib/ork/revenue.ts');
const row=(id,date,amount,shift,payment,kind='venda')=>({id,occurred_on:date,amount,category_original:payment,kind,details:{shift}});
test('groups one headline per day and splits lunch and dinner payments',()=>{
 const days=groupRevenueByDay([row('1','2026-06-01',10,'Almoço','PIX'),row('2','2026-06-01',20,'Jantar','Visa crédito'),row('3','2026-06-02',7,'Almoço','Dinheiro')]);
 assert.equal(JSON.stringify(days.map(d=>[d.date,d.total])),JSON.stringify([['2026-06-02',7],['2026-06-01',30]]));
 assert.equal(JSON.stringify(days[1].shifts.map(s=>[s.name,s.total])),JSON.stringify([['Almoço',10],['Jantar',20]]));
});
test('keeps non-monetary forms visible but separated from monetary total',()=>{
 const [day]=groupRevenueByDay([row('1','2026-06-01',100,'Almoço','PIX'),row('2','2026-06-01',15,'Almoço','Permuta','nao_monetario')]);
 assert.equal(day.total,115);assert.equal(day.monetary,100);assert.equal(day.nonMonetary,15);
});
test('ignores rows without date or usable amount and orders payments by value',()=>{
 const [day]=groupRevenueByDay([row('1','2026-06-01',3,'Jantar','PIX'),row('2','2026-06-01',8,'Jantar','Dinheiro'),row('3',null,99,'Jantar','Amex'),row('4','2026-06-01',null,'Jantar','Elo')]);
 assert.equal(JSON.stringify(day.shifts[0].payments.map(p=>p.name)),JSON.stringify(['Dinheiro','PIX']));
});
