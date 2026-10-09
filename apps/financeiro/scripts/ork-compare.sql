-- All comparisons read immutable captures, not mixed live/cached data.
with amounts as (
 select e.unit_id,e.period,
 sum(e.amount) filter(where e.source='planilha' and e.area='receita') as planilha,
 sum(e.amount) filter(where e.source='efd' and e.kind='efd') as efd,
 sum(e.amount) filter(where e.kind='nfe_saida') as notas,
 count(*) filter(where e.kind='nfe_saida') as notas_count
 from public.ork_evidence e join public.ork_imports i on i.unit_id=e.unit_id and i.id=e.import_id and i.status='ready'
 group by e.unit_id,e.period
)
insert into public.ork_issues(unit_id,issue_key,period,title,question,severity,evidence)
select unit_id,'monthly-revenue:'||period,period,
 case when efd is null or notas is null then 'Cobertura fiscal incompleta · '||period else 'Conciliar bases de receita · '||period end,
 'Os controles incluem gorjeta, cortesias, permutas ou vendas em períodos diferentes? Confirmar a composição de cada base e a cobertura dos documentos. Diferença não prova omissão de receita.',
 'atencao',jsonb_build_object('planilha',planilha,'efd',efd,'notas_saida',notas,'quantidade_notas',notas_count,'diferenca_planilha_efd',planilha-efd,'diferenca_planilha_notas',planilha-notas)
from amounts where planilha is not null and (efd is null or notas is null or abs(planilha-efd)>0.01 or abs(planilha-notas)>0.01)
on conflict(unit_id,issue_key) do nothing;

with amounts as (
 select e.unit_id,e.period,sum(e.amount) filter(where e.kind='recebimento_previsto') as previsto,
 sum(e.amount) filter(where e.kind='recebimento_informado') as informado
 from public.ork_evidence e join public.ork_imports i on i.id=e.import_id and i.unit_id=e.unit_id and i.status='ready'
 where e.area='cartoes' group by e.unit_id,e.period
)
insert into public.ork_issues(unit_id,issue_key,period,title,question,severity,evidence)
select unit_id,'card-settlement:'||period,period,'Recebimentos de cartão · '||period,
 'Conferir taxas, antecipações, estornos e datas de liquidação com o extrato da adquirente. Os valores previstos e informados estão separados das vendas.',
 'atencao',jsonb_build_object('previsto',previsto,'informado',informado,'diferenca',informado-previsto)
from amounts where previsto is not null and (informado is null or abs(previsto-informado)>0.01)
on conflict(unit_id,issue_key) do nothing;
