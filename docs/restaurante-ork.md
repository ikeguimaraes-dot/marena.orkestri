# Restaurante Ork: primeira etapa de conciliação

A unidade é um espaço de conciliação da Marena, não uma nova empresa fiscal.
Não recebe CNPJ próprio nem mapeamento `unit_cnpjs`. Está fora do consolidado.
As permissões das unidades operacionais existentes permanecem inalteradas.

## Fontes e interfaces

`/financeiro/ork/[section]` apresenta receita, despesas, cartões, caixa, sócios,
investimentos, orçamento, documentos fiscais e inteligência em UI nativa.
Cada evidência conserva fonte, referência, valor e atributos originais.
As tabelas `ork_*` não alimentam o razão ou a DRE legados.

O arquivo é identificado por SHA-256 e versão do parser. A ingestão idempotente
fica em `staging` até conferir a contagem integral; consultas só mostram lotes
`ready`. Células resumidas não são novas vendas/despesas. Os valores de fórmulas
são os resultados salvos no arquivo, sem recalcular ou corrigir a fonte.

Execução administrativa (caminhos fornecidos pelo operador):

1. `node apps/financeiro/scripts/ork-workbook.mjs arquivo.xlsx /tmp/ork-import.json`
2. `ork-import-sql.mjs /tmp/ork-import.json init` gera SQL para a conexão autorizada.
3. `rows OFFSET LIMIT` gera lotes; executar até cobrir `manifest.records`.
4. `issues` importa os achados; `finalize` valida a contagem e libera o lote.
5. `ork-snapshot.sql` captura notas/EFD sem modificar documentos originais.
6. `ork-compare.sql` compara receitas mensais e recebimentos previstos/informados.

Não executar automaticamente uma segunda versão do arquivo: a seleção de versão
ativa/substituição auditada ainda precisa ser implementada para impedir somar
edições diferentes da mesma fonte. Não usar o parser em layouts diferentes sem
verificar cabeçalhos e ampliar testes.

## Limites explícitos desta etapa

- Não há upload self-service deste modelo de planilha ainda.
- Conciliação mensal é indicativa; não prova equivalência ou omissão de vendas.
- Datas de despesas não foram presumidas como pagamento ou competência.
- Classificação contábil definitiva e confirmação de fatos estão bloqueadas.
- A tabela `ork_facts` reserva a base única futura, mas não é populada nesta etapa.
- Vinculação individual entre comprovantes, confirmação/correção de fatos e
  revisão de categorias precisam de implementação adicional e homologação.
- Cobertura de blocos legados, fluxo e validações não convertidos está no
  manifesto e na Inteligência; não se afirma conversão integral das 45 abas.
- O snapshot fiscal é datado e não sincroniza automaticamente novas notas.
- Respostas são append-only: resolver um alerta não altera a evidência financeira.

## Verificação

Testes em `tests/ork-workbook.test.mjs`: subtotal não duplicado, zero/ausência,
estorno, vencimento de parcela, identidade e referências quebradas.
Permissões: sem vínculo não lê; app não insere/atualiza/apaga evidências, não
falsifica autor/data do histórico e não escreve no razão operacional da Ork.
Antes de ativar a unidade, verificar build publicado e contagens/totais de origem.
