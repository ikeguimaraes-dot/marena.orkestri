import { z } from 'zod';

export const REVIEW_STATUS = {pendente:'Pendente',aguardando_cliente:'Aguardando cliente',revisado:'Classificação revisada',possivel_duplicidade:'Possível duplicidade'} as const;
export const REVIEW_NATURE = {a_confirmar:'A confirmar',receita:'Receita',custo:'Custo',despesa:'Despesa',ativo:'Ativo / investimento',passivo:'Passivo / empréstimo',patrimonio:'Patrimônio / aporte',transferencia:'Transferência',nao_financeiro:'Não financeiro / referência'} as const;
export const reviewSchema = z.object({
 evidence_id:z.uuid(),status:z.enum(Object.keys(REVIEW_STATUS) as [keyof typeof REVIEW_STATUS,...(keyof typeof REVIEW_STATUS)[]]),
 nature:z.enum(Object.keys(REVIEW_NATURE) as [keyof typeof REVIEW_NATURE,...(keyof typeof REVIEW_NATURE)[]]),
 category:z.string().trim().max(120).transform(s=>s||null),
 related_evidence_id:z.union([z.uuid(),z.literal('')]).transform(s=>s||null),
 explanation:z.string().trim().min(5).max(5000),
}).superRefine((v,ctx)=>{
 if(v.category && v.category.length<2) ctx.addIssue({code:'custom',message:'Informe uma categoria com pelo menos 2 caracteres.'});
 if(v.status==='revisado'&&(!v.category||v.nature==='a_confirmar')) ctx.addIssue({code:'custom',message:'Para concluir a revisão, informe a natureza e a categoria.'});
 if(v.status==='possivel_duplicidade'&&!v.related_evidence_id) ctx.addIssue({code:'custom',message:'Selecione o registro possivelmente duplicado.'});
 if(v.related_evidence_id===v.evidence_id) ctx.addIssue({code:'custom',message:'Um registro não pode ser vinculado a si mesmo.'});
});
