-- Snapshot explicitly scoped to the reconciliation source; no operational write.
begin;
insert into public.ork_imports(unit_id,filename,checksum,parser_version,status,manifest)
select id,'Documentos fiscais da Marena · captura inicial','marena-fiscal-initial','snapshot-1','staging',
 jsonb_build_object('source_unit_id',reconciliation_source_unit_id,'snapshot_at',now())
from public.units where name='Restaurante Ork' and reconciliation_source_unit_id is not null
on conflict(unit_id,checksum,parser_version) do nothing;

insert into public.ork_evidence(unit_id,import_id,source,source_ref,area,kind,occurred_on,period,description,entity,amount,details)
select u.id,i.id,'nfe',n.chave||':'||n.direcao,'documentos','nfe_'||n.direcao,
 (n.emissao at time zone 'America/Sao_Paulo')::date,to_char(n.emissao at time zone 'America/Sao_Paulo','YYYY-MM'),
 'Nota '||coalesce(n.numero::text,'')||' · '||n.direcao,
 case when n.direcao='entrada' then n.emitente_nome else n.destinatario_nome end,
 case when n.cancelada then null else n.valor_total end,
 jsonb_build_object('source_unit_id',n.unit_id,'chave',n.chave,'cancelada',n.cancelada,'status_sefaz',n.status_sefaz,'snapshot_at',i.created_at)
from public.units u join public.ork_imports i on i.unit_id=u.id and i.checksum='marena-fiscal-initial'
join public.nfe_documentos n on n.unit_id=u.reconciliation_source_unit_id
where u.name='Restaurante Ork' and i.status='staging'
on conflict(unit_id,import_id,source_ref) do nothing;

insert into public.ork_evidence(unit_id,import_id,source,source_ref,area,kind,period,description,amount,details)
select u.id,i.id,'efd',e.cnpj||':'||e.competencia,'receita','efd',e.competencia,
 'Demonstrativo EFD · '||e.competencia,e.receita,
 jsonb_build_object('source_unit_id',e.unit_id,'pis',e.pis,'cofins',e.cofins,'arquivo',e.arquivo,'snapshot_at',i.created_at)
from public.units u join public.ork_imports i on i.unit_id=u.id and i.checksum='marena-fiscal-initial'
join public.receita_fiscal_efd e on e.unit_id=u.reconciliation_source_unit_id
where u.name='Restaurante Ork' and i.status='staging'
on conflict(unit_id,import_id,source_ref) do nothing;
update public.ork_imports set status='ready' where checksum='marena-fiscal-initial' and status='staging';
commit;
