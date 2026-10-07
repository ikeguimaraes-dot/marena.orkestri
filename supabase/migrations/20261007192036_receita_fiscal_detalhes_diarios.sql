alter table public.receita_fiscal_efd
  add column vendas_diarias jsonb not null default '[]'::jsonb,
  add constraint receita_fiscal_efd_vendas_diarias_array
    check (jsonb_typeof(vendas_diarias) = 'array');

comment on column public.receita_fiscal_efd.vendas_diarias is
  'Totais e produtos por data extraídos somente da seção PIS; COFINS é repetição fiscal.';
