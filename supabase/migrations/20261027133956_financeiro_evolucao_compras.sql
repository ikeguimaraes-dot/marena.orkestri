-- Read-only, caller's permissions and existing RLS remain in effect.
create or replace function public.financeiro_evolucao_compras(p_unit uuid default null)
returns jsonb language sql stable security invoker set search_path = public
as $$
with compras as materialized (
 select distinct on (p.chave_nfe,p.item_codigo)
   p.fornecedor_codigo,p.fornecedor_nome,p.item_codigo,p.dt_emissao,
   p.nr_danfe,p.chave_nfe,p.v_custo_compra,p.q_embalagem,p.v_total_danfe,d.produto_id
 from public.produtos_relatorio p
 join public.produtos_depara d on d.fornecedor_cnpj=p.fornecedor_codigo and d.item_codigo=p.item_codigo
 join public.produtos_catalogo c on c.id=d.produto_id
 where p.direcao_nfe='entrada' and p.chave_nfe is not null
   and (p_unit is null or p.unit_id=p_unit)
   and (p.v_total_danfe is null or p.v_total_danfe not in (0,0.01))
 order by p.chave_nfe,p.item_codigo,p.dt_emissao,p.id
), ids as materialized (
 select produto_id from compras group by produto_id
 having count(*) >= 2 and count(v_custo_compra)>0
)
select jsonb_build_object(
 'compras',coalesce((select jsonb_agg(to_jsonb(p) order by p.dt_emissao,p.chave_nfe,p.item_codigo)
   from compras p join ids i on i.produto_id=p.produto_id),'[]'::jsonb),
 'catalogo',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'codigo',c.codigo,'nome',c.nome,'ncm',c.ncm,'unidade_padrao',c.unidade_padrao))
   from public.produtos_catalogo c join ids i on i.produto_id=c.id),'[]'::jsonb)
);
$$;
revoke all on function public.financeiro_evolucao_compras(uuid) from public, anon;
grant execute on function public.financeiro_evolucao_compras(uuid) to authenticated;
