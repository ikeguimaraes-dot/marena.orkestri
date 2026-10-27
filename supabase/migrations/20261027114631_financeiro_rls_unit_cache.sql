-- Preserve the existing predicate, evaluating access once per unit per statement.
-- The founder branch preserves access to nullable unit_id rows.
do $$
declare p record;
begin
 for p in select tablename, policyname from pg_policies
   where schemaname='public' and cmd='SELECT'
     and tablename in ('produtos_relatorio', 'nfe_documentos', 'lancamentos')
     and qual='financeiro_can_read(unit_id)'
 loop
  execute format('alter policy %I on public.%I using (
    (select auth.uid()) is not null and (
      (select public.kph_is_founder()) or
      unit_id = any(array(select u.id from public.units u where public.financeiro_can_read(u.id)))
    )
  )', p.policyname, p.tablename);
 end loop;
end $$;
