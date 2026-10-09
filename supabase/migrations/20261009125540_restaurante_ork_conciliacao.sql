-- Reconciliation workspace: evidence never writes into the operational ledger.
alter table public.units add column reconciliation_source_unit_id uuid references public.units(id);
alter table public.units add column include_in_consolidated boolean not null default true;
alter table public.units add constraint units_reconciliation_isolated
  check (reconciliation_source_unit_id is null or (reconciliation_source_unit_id <> id and not include_in_consolidated and cnpj is null));

insert into public.units (brand_id, name, address, reconciliation_source_unit_id, include_in_consolidated, active)
select brand_id, 'Restaurante Ork', address, id, false, false from public.units
where cnpj = '55631066000171' and reconciliation_source_unit_id is null;

-- Preserve existing access scope, without granting new roles to other users.
insert into public.user_roles (user_id, role_id, unit_id)
select ur.user_id, ur.role_id, target.id from public.user_roles ur
join public.units target on target.reconciliation_source_unit_id = ur.unit_id;

create table public.ork_imports (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
 filename text not null, checksum text not null, parser_version text not null,
 status text not null default 'staging' check (status in ('staging','ready','failed')),
 manifest jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(unit_id, checksum, parser_version), unique(unit_id, id)
);
create table public.ork_evidence (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
 import_id uuid not null, source text not null check(source in ('planilha','nfe','efd')),
 source_ref text not null, area text not null check(area in ('receita','despesas','cartoes','caixa','socios','investimentos','orcamento','documentos')),
 kind text not null, occurred_on date, period text check(period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 description text not null, entity text, amount numeric(18,6), category_original text,
 details jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(unit_id, import_id, source_ref), unique(unit_id,id),
 foreign key(unit_id,import_id) references public.ork_imports(unit_id,id)
);
create index ork_evidence_filter on public.ork_evidence(unit_id,area,period,occurred_on);
create index ork_evidence_import on public.ork_evidence(unit_id,import_id);
create table public.ork_issues (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
 issue_key text not null, period text, title text not null, question text not null,
 severity text not null check(severity in ('atencao','critico','informacao')),
 evidence jsonb not null default '{}', created_at timestamptz not null default now(),
 unique(unit_id,issue_key), unique(unit_id,id)
);
-- Append-only decisions keep every explanation and author, not only the latest status.
create table public.ork_issue_decisions (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null, issue_id uuid not null,
 status text not null check(status in ('aberto','aguardando_cliente','resolvido')),
 explanation text not null check(length(trim(explanation)) between 5 and 5000),
 created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(),
 foreign key(unit_id,issue_id) references public.ork_issues(unit_id,id)
);
create index ork_decisions_issue on public.ork_issue_decisions(unit_id,issue_id,created_at desc);

-- Canonical facts are separate from raw evidence; no DRE is generated here.
create table public.ork_facts (
 id uuid primary key default gen_random_uuid(), unit_id uuid not null references public.units(id),
 evidence_id uuid not null, category_dre text not null,
 explanation text not null check(length(trim(explanation)) between 5 and 5000),
 confirmed_by uuid not null default auth.uid() references auth.users(id), confirmed_at timestamptz not null default now(),
 unique(unit_id,evidence_id), foreign key(unit_id,evidence_id) references public.ork_evidence(unit_id,id)
);

do $$ declare t text; begin
 foreach t in array array['ork_imports','ork_evidence','ork_issues','ork_issue_decisions','ork_facts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy read_unit on public.%I for select to authenticated using (public.financeiro_can_read(unit_id))',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('revoke all on public.%I from anon',t);
 end loop;
end $$;
create policy append_decision on public.ork_issue_decisions for insert to authenticated
 with check(public.financeiro_can_write(unit_id) and created_by = (select auth.uid()));
grant insert(unit_id,issue_id,status,explanation) on public.ork_issue_decisions to authenticated;
-- Import evidence is immutable for app users. Ingestion is performed by the audited importer.
-- Approval remains explicit; observed records are never promoted by a numerical similarity.
create policy confirm_fact on public.ork_facts for insert to authenticated
 with check(public.financeiro_can_write(unit_id) and confirmed_by = (select auth.uid()));
grant insert(unit_id,evidence_id,category_dre,explanation) on public.ork_facts to authenticated;

create or replace function public.ork_totals(p_unit uuid, p_area text, p_period text default null)
returns table(source text, kind text, records bigint, amount numeric)
language sql stable security invoker set search_path=public as $$
 select e.source,e.kind,count(*),sum(e.amount) from ork_evidence e
 join ork_imports i on i.id=e.import_id and i.unit_id=e.unit_id and i.status='ready'
 where e.unit_id=p_unit and e.area=p_area and (p_period is null or e.period=p_period)
 group by e.source,e.kind
$$;
revoke all on function public.ork_totals(uuid,text,text) from public,anon;
grant execute on function public.ork_totals(uuid,text,text) to authenticated;
