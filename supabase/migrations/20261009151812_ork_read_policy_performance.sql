-- Keep the same authorization predicates, but compute them once per statement
-- (and once per visible unit), not once per financial evidence row.
-- No SECURITY DEFINER, permission grants, source changes or timeout increases.
do $$
declare t text; policy_name text;
begin
 foreach t in array array['ork_imports','ork_evidence','ork_issues','ork_issue_decisions','ork_facts','ork_evidence_reviews'] loop
  policy_name := case when t='ork_evidence_reviews' then 'ork_review_read' else 'read_unit' end;
  execute format('alter policy %I on public.%I using (
   (select auth.uid()) is not null and (
    (select public.kph_is_founder()) or
    unit_id = any(array(select u.id from public.units u where public.financeiro_can_read(u.id)))
   )
  )',policy_name,t);
 end loop;
end $$;
