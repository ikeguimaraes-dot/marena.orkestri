# Resumo do projeto Marena / Restaurante Ork

> Atualizado em 09/10/2026. Este arquivo existe para retomar o trabalho depois de
> reiniciar o computador ou abrir uma nova conversa. Leia também `AGENTS.md`,
> `apps/financeiro/AGENTS.md` e `docs/restaurante-ork.md` antes de alterar código.
> Não há senhas, tokens ou chaves neste documento.

## 1. Objetivo do projeto

O sistema financeiro atende a Marena e usa Supabase, Next.js e Vercel. O trabalho
atual é incorporar, no layout nativo do sistema, as informações da planilha
`Painel de Controle - 2025 e 2026.xlsx` e compará-las com as fontes contábeis e
fiscais já existentes.

A planilha não deve aparecer como uma planilha online. Cada informação deve ir
para o menu correspondente: receita, despesas, cartões, caixa, sócios,
investimentos, orçamento, documentos fiscais e inteligência.

Foi criada uma visão de DRE gerencial preliminar, organizada pelos CCs da planilha.
Ela não é uma DRE homologada nem alimenta a DRE legada: serve para entender receita,
CMV, folha, ocupação, manutenção, marketing, administrativas, tributos e demais
componentes enquanto a base canônica é conciliada. Divergências e dúvidas não devem
ser apagadas ou resolvidas por suposição: elas devem aparecer na Inteligência e ser
respondidas com histórico.

## 2. Empresa e unidade original

- Razão social: FOOD-SOCIETY HG VOLANO LTDA
- CNPJ: 55.631.066/0001-71
- Nome fantasia: Marena
- Unidade: Marena
- Endereço: Rua Pais de Araújo, 138 - Itaim Bibi, São Paulo - SP, 04531-090
- ID da unidade Marena: `0c6c377a-2fe2-4325-9e84-3caad46542f9`
- ID da marca: `4709909e-fe9c-4f03-9cad-33a6d6fe1b61`

A Marena original continua ativa e participa do consolidado. Seus registros não
foram migrados, apagados nem substituídos.

## 3. Unidade Restaurante Ork

Foi criada uma unidade isolada chamada **Restaurante Ork** no seletor de unidades.
Ela é um ambiente de conciliação da Marena, e não uma nova empresa fiscal.

- ID: `5fa10a15-9329-47fe-90c1-7fb67b4686e8`
- `reconciliation_source_unit_id`: unidade Marena
- `include_in_consolidated`: `false`
- sem CNPJ próprio
- sem mapeamento em `unit_cnpjs`
- bloqueada para lançamentos nos módulos operacionais e na DRE legada
- permissões de leitura/escrita limitadas por unidade e função

O menu da Ork possui:

- Inteligência
- Revisão de registros
- Receita
- Despesas e contas a pagar
- Cartões e recebimentos
- Caixa
- Sócios e outras empresas
- Investimentos
- Orçamento
- Documentos fiscais
- DRE preliminar e seus componentes

Ao selecionar Restaurante Ork, a navegação é redirecionada para esse espaço. Ela
não deve aparecer nos totais consolidados do grupo.

## 4. Fontes preservadas no banco

Projeto Supabase: `hneehjanflbyajrpsdpf`.

Contagens importadas no espaço Ork:

- 29.606 evidências da planilha
- 1.795 notas fiscais capturadas da Marena
  - 499 notas de entrada, total aproximado de R$ 1.010.639,68
  - 1.296 notas de saída, total aproximado de R$ 1.388.265,02
- 1 registro EFD de junho/2026
  - receita: R$ 2.540.327,33
  - PIS: R$ 14.423,75
  - COFINS: R$ 66.557,10
- 140 perguntas/divergências inicialmente geradas
- nenhuma evidência foi transformada em fato financeiro definitivo

As fontes são evidências independentes. Planilha, EFD e notas de saída nunca devem
ser somadas entre si. Diferença entre elas não prova venda omitida; pode representar
bases, coberturas e critérios diferentes.

Em junho/2026, a planilha possui 30 dias de faturamento e até dois turnos por dia.
Ela não contém detalhe de produtos ou quantidade de pratos vendidos. Esse tipo de
análise depende dos relatórios do PDV/Lorean ou de outra fonte com itens.

## 5. Estrutura de banco criada

Migrações relevantes:

- `20261009125540_restaurante_ork_conciliacao.sql`
- `20261009130536_ork_access_hardening.sql`
- `20261009131519_ork_block_operational_writes.sql`
- `20261009133615_ork_evidence_reviews.sql`
- `20261009151812_ork_read_policy_performance.sql`

Tabelas principais:

- `ork_imports`: lotes e manifesto das fontes
- `ork_evidence`: registros imutáveis das fontes
- `ork_issues`: divergências e perguntas
- `ork_issue_decisions`: respostas append-only das divergências
- `ork_evidence_reviews`: revisão/classificação append-only por evidência
- `ork_facts`: reservada para a futura base canônica; permanece vazia

Funções importantes:

- `financeiro_can_read(unit_id)`: verifica leitura
- `ork_can_write(unit_id)`: permite escrever apenas no espaço de conciliação
- `financeiro_can_write(unit_id)`: bloqueia a Ork nos módulos operacionais
- `ork_totals(unit_id, area, period)`: totaliza fontes separadamente

RLS está habilitado nas tabelas Ork. Usuário sem vínculo retorna zero evidências,
revisões e totais. Usuários do app não podem editar ou apagar evidências. Autor e
data dos históricos são atribuídos pelo banco.

### Correção de timeout

Receita e Despesas falhavam com `canceling statement due to statement timeout`.
A política de leitura repetia a autorização em cada uma das milhares de linhas.
A migração de performance passou essa autorização para InitPlans sem relaxar RLS.
No teste autenticado, a listagem de despesas caiu de aproximadamente 4.026 ms para
11,7 ms. Não foi aumentado o timeout.

## 6. Parser da planilha

Arquivo principal:

- `apps/financeiro/scripts/ork-workbook.mjs`

O parser identifica o arquivo por SHA-256 e usa `PARSER_VERSION = 'ork-1'`. Ele lê
os valores salvos no Excel; não recalcula fórmulas. Referências quebradas geram
pendências em vez de valores fabricados.

Tratamentos implementados:

- abas mensais: receita por dia, turno e forma de pagamento
- Despesas Operacionais 2025/2026
- Cartão Crédito
- Despesas Pré Op - Allora
- Cartão Crédito - Itaú
- Caixa Dinheiro
- Resumo Financeiro
- Consolidado 2025/2026 como orçamento de referência
- cobertura explícita para abas/blocos não convertidos

Receita mensal lê apenas as células fonte. Subtotais diários/mensais não são
reimportados. Almoço e Jantar permanecem separados; formas de pagamento são
preservadas. Permutas, assinados e cortesias são marcados como não monetários.

Scripts auxiliares:

- `ork-import-sql.mjs`: importação administrativa em lotes
- `ork-snapshot.sql`: captura inicial de NF-e/EFD
- `ork-compare.sql`: comparações mensais e de cartões

O upload self-service de uma nova versão da planilha ainda não foi criado. Não
importar uma segunda versão manualmente sem implementar versão ativa/substituição,
pois os dois arquivos poderiam ser somados.

## 7. Interface atual

Rota principal: `/financeiro/ork/[section]`.

Arquivos centrais:

- `apps/financeiro/src/app/financeiro/ork/[section]/page.tsx`
- `apps/financeiro/src/app/financeiro/ork/[section]/page.module.css`
- `apps/financeiro/src/lib/ork/config.ts`
- `apps/financeiro/src/components/financeiro/OrkBoundary.tsx`

### Receita

A Receita foi refeita no commit `0783ec9` para seguir o formato solicitado:

- seleção de mês e ano
- uma linha por dia
- a linha principal mostra somente o faturamento do dia
- botão/seta acessível expande o dia
- dentro da expansão: Almoço e Jantar separados
- dentro de cada turno: formas de pagamento e valores
- permutas, assinados e cortesias continuam visíveis, mas identificados como não
  monetários
- EFD aparece em cartão de conferência separado e nunca é somado ao dia

Arquivos:

- `RevenuePage.tsx`
- `RevenueTable.tsx`
- `src/lib/ork/revenue.ts`
- `tests/ork-revenue.test.mjs`

Não mostrar metas, clientes, ticket médio, desconto, gorjeta ou CMV nessa tela até
existir uma fonte válida para esses dados.

### Revisão de registros

Permite registrar, sem alterar a evidência:

- situação: pendente, aguardando cliente, revisado ou possível duplicidade
- natureza
- categoria revisada
- justificativa/pergunta
- vínculo com outra evidência possivelmente duplicada

Valor igual é apenas candidato; nunca comprova duplicidade. O histórico é
append-only. A última revisão define o estado exibido, sem apagar anteriores.

A listagem segue agora o padrão das demais áreas: filtro por intervalo mensal, uma
linha por dia e expansão dos registros. Natureza corresponde à coluna E da planilha
e CC à coluna H. Natureza/CC revisados continuam separados dos valores originais.

Arquivos:

- `ReviewPage.tsx`
- `ReviewForm.tsx`
- `src/lib/ork/review.ts`
- `tests/ork-review.test.mjs`

### Demais abas mensais

Despesas, Cartões, Caixa, Sócios, Investimentos, Orçamento e Documentos fiscais
seguem o mesmo padrão de Receita: seletor de mês/ano, resumo mensal, uma linha por
dia e seta para os detalhes. A apresentação é comum, mas a matemática respeita a
natureza de cada área. Cartões mantém previsto, informado, despesas e parcelas em
grupos separados; Documentos mantém entrada e saída separadas; Caixa mantém
entradas, saídas e pendências separadas. Referências sem data aparecem numa linha
explícita "Sem data informada".

Todas as telas Ork aceitam filtro por período. Despesas e Cartões também permitem
identificar explicitamente as origens `Despesas Operacionais` e `Cartão Crédito`.

### DRE preliminar

O menu DRE organiza as evidências da planilha por CC, com submenus de Receita, CMV
e insumos, Folha e pessoal, Ocupação, Manutenção, Marketing, Administrativas,
Tributos, Financeiras, Outras despesas, Investimentos/empréstimos/ativos e Não
classificados. Além do intervalo, há filtro pelo mês do ano. INSS, FGTS e IRRF ficam
em Tributos. Reembolsos voltam às despesas e depósitos judiciais são separados das
custas judiciais pela Natureza. A base de despesas padrão é `Despesas Operacionais`;
Cartão Crédito pode ser visto à parte. Selecionar todas as fontes não deduplica
gastos possivelmente repetidos.

Arquivos reutilizáveis:

- `MonthlyAreaPage.tsx`
- `MonthlyAreaTable.tsx`
- `src/lib/ork/monthly.ts`
- `tests/ork-monthly.test.mjs`

## 8. Publicação e repositório

- Repositório: `https://github.com/ikeguimaraes-dot/marena.orkestri.git`
- Branch: `main`
- App público/shell: `https://marenaorkestri.vercel.app/`
- Projeto financeiro: `https://marena-financeiro.vercel.app/`
- Vercel team: `team_ulJarooO9YnQ8PN054EigvFZ`
- Vercel project: `prj_EwSBH6pUDyEzomjIKOP64Cc3YOMe`
- Root Directory na Vercel: `apps/financeiro`

Commits principais, em ordem:

- `ef30392` — espaço isolado Restaurante Ork
- `5b1871f` — navegação alinhada à unidade selecionada
- `899ea47` — revisão auditável de evidências
- `3b8ff23` — otimização de leitura/RLS e correção de timeout
- `0783ec9` — receita mensal por dia, turno e pagamento

O deploy do commit `0783ec9` ficou `READY` em produção:

- deployment ID: `dpl_57AaiEXzknE8Tvn6dw6u1V39joRv`
- URL imutável: `https://marena-financeiro-lb4zluluq-henriques-projects-0f1cdf7f.vercel.app`

O domínio `marenaorkestri.vercel.app` é o shell que redireciona para o financeiro.
Rotas sem login retornam redirecionamento para `/login`.

## 9. Testes e comandos úteis

Dentro de `apps/financeiro`:

```bash
npm run type-check
npm run test:ui
npm exec next build -- --webpack
```

Estado na última publicação:

- 87 testes aprovados
- type-check aprovado
- build webpack aprovado
- logs iniciais da Vercel sem erros

O `npm run build` local com Turbopack já falhou por restrição de porta/processo do
ambiente. Para validação local, `next build --webpack` funcionou. A Vercel consegue
construir normalmente com Turbopack.

Antes de alterar Next.js, ler a documentação desta versão em
`apps/financeiro/node_modules/next/dist/docs/`, pois o `AGENTS.md` alerta que ela
possui mudanças incompatíveis com versões conhecidas.

## 10. Decisões que não podem ser esquecidas

1. Preservar os dados originais da Marena.
2. Restaurante Ork não entra no consolidado e não recebe CNPJ.
3. A DRE disponível é apenas uma visão gerencial preliminar; não homologar nem
   alimentar a DRE legada antes da conciliação da base canônica.
4. Não somar planilha, EFD e NF-e como se fossem a mesma base.
5. Não classificar automaticamente aportes, empréstimos, transferências ou gastos
   de sócios como despesas da DRE.
6. Não presumir que a data da planilha é pagamento ou competência.
7. Não excluir duplicidades automaticamente.
8. Toda confirmação deve ter evidência, autor, data e histórico.
9. A base canônica futura pode vincular múltiplas evidências a um único fato, sem
   contar esse fato duas vezes.
10. Informações que não existem na fonte devem ser exibidas como pendência, não
    inventadas ou substituídas por zero.

## 11. Próximos passos prioritários

### 1. Validar visualmente a nova Receita

Entrar autenticado, selecionar Restaurante Ork, abrir Receita e verificar junho de
2026. Conferir linha diária, seta, Almoço/Jantar, pagamentos e responsividade. O
deploy foi validado tecnicamente, mas a sessão autenticada ainda precisa de revisão
visual do usuário.

### 2. Validar visualmente as demais abas mensais

Conferir mês, linha diária, expansão e agrupamentos em Despesas, Cartões, Caixa,
Sócios, Investimentos, Orçamento e Documentos. Ajustar apenas a hierarquia visual;
não transformar datas ou referências em fatos contábeis sem confirmação.

### 3. Upload e versionamento da planilha

Criar upload self-service seguro, mantendo o arquivo original, SHA-256 e versão do
parser. Nova versão deve entrar em staging, ser validada e somente depois se tornar
ativa. A versão anterior deve ficar auditável, mas não pode continuar nos totais.
Evitar HTTP 413 usando Storage/upload direto e processamento servidor.

### 4. Base canônica confirmada

Evoluir `ork_facts` para representar o fato escolhido (data, valor, natureza,
categoria e estado) e criar vínculos muitos-para-muitos com evidências. Usar
revisões append-only e confirmação explícita. Não alimentar DRE ainda.

### 5. Classificação homologada

Substituir categoria revisada em texto livre por um plano de categorias aprovado.
Separar custo, despesa, ativo, passivo, patrimônio, transferência e não financeiro.
Tudo que continuar desconhecido deve permanecer na Inteligência.

## 12. Arquivos de origem usados durante o trabalho

Estes caminhos são locais da máquina e podem não existir após mover arquivos:

- `/Users/henriqueguimaraes/Downloads/Painel de Controle - 2025 e 2026.xlsx`
- `/Users/henriqueguimaraes/Downloads/Projeto Marena/Demonstrativo EFD PIS e COFINS 06- C.pdf`
- pasta de XMLs de junho/2026 em `/Users/henriqueguimaraes/Downloads/Projeto Marena/06.2026- ENTRADA SAIDA/`

SHA-256 da planilha analisada:

`4cc80a9144c3a429a7232bd32ebba4b03ac4c9bc6c42412d3e47943f95c7a665`

Relatório detalhado complementar: `docs/restaurante-ork.md`.
