-- Supabase default table privileges are broad: narrow them explicitly.
revoke all on public.ork_imports, public.ork_evidence, public.ork_issues,
 public.ork_issue_decisions, public.ork_facts from authenticated, anon, public;
grant select on public.ork_imports, public.ork_evidence, public.ork_issues,
 public.ork_issue_decisions, public.ork_facts to authenticated;
grant insert(unit_id,issue_id,status,explanation) on public.ork_issue_decisions to authenticated;
-- Canonical confirmation stays disabled until category/link validation is implemented.

create function public.ork_reject_automatic_cnpj_mapping() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if exists(select 1 from public.units where id=new.unit_id and reconciliation_source_unit_id is not null) then
  raise exception 'Unidade de conciliação não aceita roteamento automático por CNPJ';
 end if;
 return new;
end $$;
revoke all on function public.ork_reject_automatic_cnpj_mapping() from public,anon,authenticated;
create trigger ork_no_automatic_cnpj before insert or update on public.unit_cnpjs
 for each row execute function public.ork_reject_automatic_cnpj_mapping();
