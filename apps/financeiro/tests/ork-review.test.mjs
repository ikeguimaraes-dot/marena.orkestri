import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTs} from './helpers/load-ts.mjs';
const {reviewSchema}=loadTs('src/lib/ork/review.ts');
const base={evidence_id:'11111111-1111-4111-8111-111111111111',status:'pendente',nature:'a_confirmar',category:'',related_evidence_id:'',explanation:'Perguntar sobre este comprovante.'};
test('review leaves unknown classification explicitly pending',()=>{const v=reviewSchema.parse(base);assert.equal(v.category,null);assert.equal(v.related_evidence_id,null);});
test('review requires nature and category before marking reviewed',()=>{
 assert.equal(reviewSchema.safeParse({...base,status:'revisado'}).success,false);
 assert.equal(reviewSchema.safeParse({...base,status:'revisado',nature:'despesa',category:'Aluguel'}).success,true);
});
test('possible duplicate requires different valid evidence',()=>{
 assert.equal(reviewSchema.safeParse({...base,status:'possivel_duplicidade'}).success,false);
 assert.equal(reviewSchema.safeParse({...base,related_evidence_id:base.evidence_id}).success,false);
 assert.equal(reviewSchema.safeParse({...base,status:'possivel_duplicidade',related_evidence_id:'22222222-2222-4222-8222-222222222222'}).success,true);
});
test('review rejects arbitrary status, short justification and overlong category',()=>{
 for(const change of [{status:'pago'},{explanation:' '},{category:'x'.repeat(121)},{nature:'qualquer'},{evidence_id:'invalido'}]) assert.equal(reviewSchema.safeParse({...base,...change}).success,false);
});
test('review ignores forged identity and timestamps',()=>{
 const v=reviewSchema.parse({...base,created_by:'forged',created_at:'2000-01-01',unit_id:'other'});
 assert.equal(v.created_by,undefined);assert.equal(v.created_at,undefined);assert.equal(v.unit_id,undefined);
});
