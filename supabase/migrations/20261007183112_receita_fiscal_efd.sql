-- Monthly fiscal evidence is kept separate from workdays and XML sales.
create table public.receita_fiscal_efd (
  unit_id uuid not null references public.units(id),
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  competencia text not null check (competencia ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  receita numeric(16,2) not null check (receita >= 0),
  pis numeric(16,2) not null check (pis >= 0),
  cofins numeric(16,2) not null check (cofins >= 0),
  arquivo text not null,
  resumo_texto text not null,
  atualizado_em timestamptz not null default now(),
  primary key (unit_id, cnpj, competencia)
);
alter table public.receita_fiscal_efd enable row level security;
revoke all on public.receita_fiscal_efd from anon, authenticated;
grant select, insert, update on public.receita_fiscal_efd to authenticated;
grant all on public.receita_fiscal_efd to service_role;
create policy receita_fiscal_read on public.receita_fiscal_efd for select to authenticated
  using (public.financeiro_can_read(unit_id));
create policy receita_fiscal_insert on public.receita_fiscal_efd for insert to authenticated
  with check (public.financeiro_can_write(unit_id) and exists (
    select 1 from public.unit_cnpjs c where c.unit_id = receita_fiscal_efd.unit_id and c.cnpj = receita_fiscal_efd.cnpj and c.ativo
  ));
create policy receita_fiscal_update on public.receita_fiscal_efd for update to authenticated
  using (public.financeiro_can_write(unit_id))
  with check (public.financeiro_can_write(unit_id) and exists (
    select 1 from public.unit_cnpjs c where c.unit_id = receita_fiscal_efd.unit_id and c.cnpj = receita_fiscal_efd.cnpj and c.ativo
  ));
