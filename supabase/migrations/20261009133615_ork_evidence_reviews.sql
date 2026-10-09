-- Review metadata only: never changes evidence, canonical facts, or operational ledgers.
create table public.ork_evidence_reviews (
 id bigint generated always as identity primary key,
 unit_id uuid not null references public.units(id),
 evidence_id uuid not null,
 status text not null check(status in ('pendente','aguardando_cliente','revisado','possivel_duplicidade')),
 nature text not null check(nature in ('a_confirmar','receita','custo','despesa','ativo','passivo','patrimonio','transferencia','nao_financeiro')),
 category text check(category is null or length(trim(category)) between 2 and 120),
 related_evidence_id uuid,
 explanation text not null check(length(trim(explanation)) between 5 and 5000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(unit_id,evidence_id) references public.ork_evidence(unit_id,id),
 foreign key(unit_id,related_evidence_id) references public.ork_evidence(unit_id,id),
 check(related_evidence_id is null or related_evidence_id <> evidence_id),
 check(status <> 'possivel_duplicidade' or related_evidence_id is not null),
 check(status <> 'revisado' or (category is not null and nature <> 'a_confirmar'))
);
create index ork_reviews_evidence_idx on public.ork_evidence_reviews(unit_id,evidence_id,id desc);
create index ork_reviews_related_idx on public.ork_evidence_reviews(unit_id,related_evidence_id);
create index ork_reviews_author_idx on public.ork_evidence_reviews(created_by);
alter table public.ork_evidence_reviews enable row level security;
revoke all on public.ork_evidence_reviews from public, anon, authenticated;
grant select on public.ork_evidence_reviews to authenticated;
grant insert(unit_id,evidence_id,status,nature,category,related_evidence_id,explanation) on public.ork_evidence_reviews to authenticated;
grant usage on sequence public.ork_evidence_reviews_id_seq to authenticated;
create policy ork_review_read on public.ork_evidence_reviews for select to authenticated
 using(public.financeiro_can_read(unit_id));
create policy ork_review_append on public.ork_evidence_reviews for insert to authenticated
 with check(public.ork_can_write(unit_id) and created_by=(select auth.uid())
 and exists(select 1 from public.ork_evidence e join public.ork_imports i on i.id=e.import_id
 where e.id=evidence_id and e.unit_id=ork_evidence_reviews.unit_id and i.status='ready'));

create view public.ork_review_queue with (security_invoker=true) as
 select e.*,r.id as review_id,coalesce(r.status,'pendente') as review_status,
 r.nature as reviewed_nature,r.category as reviewed_category,r.related_evidence_id,
 r.explanation as review_explanation,r.created_at as reviewed_at
 from public.ork_evidence e join public.ork_imports i on i.id=e.import_id and i.unit_id=e.unit_id and i.status='ready'
 left join lateral(select r.* from public.ork_evidence_reviews r
 where r.unit_id=e.unit_id and r.evidence_id=e.id order by r.id desc limit 1) r on true;
revoke all on public.ork_review_queue from public,anon,authenticated;
grant select on public.ork_review_queue to authenticated;
