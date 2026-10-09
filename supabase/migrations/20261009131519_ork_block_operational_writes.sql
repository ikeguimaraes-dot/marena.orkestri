create function public.ork_can_write(p_unit uuid) returns boolean
language sql stable security invoker set search_path=public as $$
 select auth.uid() is not null and exists(select 1 from units where id=p_unit and reconciliation_source_unit_id is not null)
 and (public.kph_is_founder() or exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
  where ur.user_id=auth.uid() and ur.unit_id=p_unit and r.name<>'socio_readonly'))
$$;
revoke all on function public.ork_can_write(uuid) from public,anon;
grant execute on function public.ork_can_write(uuid) to authenticated;
alter policy append_decision on public.ork_issue_decisions with check(public.ork_can_write(unit_id) and created_by=(select auth.uid()));
alter policy confirm_fact on public.ork_facts with check(public.ork_can_write(unit_id) and confirmed_by=(select auth.uid()));

-- Same permissions on existing operational units, never writes on reconciliation units.
create or replace function public.financeiro_can_write(p_unit uuid) returns boolean
language sql stable set search_path=public as $$
 select auth.uid() is not null
 and not exists(select 1 from public.units where id=p_unit and reconciliation_source_unit_id is not null)
 and (public.kph_is_founder() or exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
  where ur.user_id=auth.uid() and ur.unit_id=p_unit and r.name<>'socio_readonly'))
$$;
