create or replace function public.financeiro_categorias_produtos()
returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from (
 select desc_gerencial,count(*) quantidade from public.produtos_relatorio
 where desc_gerencial is not null group by desc_gerencial order by desc_gerencial
 ) s;
$$;
create or replace function public.financeiro_meses_produtos(p_unit uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from (
 select mes_lancamento mes,ano_lancamento ano,count(*) total from public.produtos_relatorio
 where unit_id=p_unit and chave_nfe is not null
 group by ano_lancamento,mes_lancamento order by ano_lancamento,mes_lancamento
 ) s;
$$;
revoke all on function public.financeiro_categorias_produtos() from public,anon;
revoke all on function public.financeiro_meses_produtos(uuid) from public,anon;
grant execute on function public.financeiro_categorias_produtos() to authenticated;
grant execute on function public.financeiro_meses_produtos(uuid) to authenticated;
