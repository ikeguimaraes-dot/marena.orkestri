# Importações de receita fiscal e notas de saída

## Receita fiscal EFD (Domínio)

Em Financeiro → DRE → Receita → Importar arquivos, selecionar o demonstrativo
completo no bloco **Receita fiscal · EFD PIS/COFINS**. Conferir CNPJ, competência,
receita e contribuições na prévia e clicar em **Confirmar importação fiscal**.

A leitura ocorre no navegador, sem IA. Apenas o texto das páginas de resumo e
apuração é enviado ao servidor, que refaz a extração e verifica o CNPJ da unidade.
São aceitos PDFs com texto, até 50 MB e 2.000 páginas, com um único CNPJ e mês.
O original não é arquivado por esse fluxo; conservar o PDF de origem.

O relatório repete as receitas para PIS e COFINS. Os dois totais devem coincidir;
somente um é salvo. PIS e COFINS vêm do saldo devedor final, incluindo os ajustes
do demonstrativo. Reimportar atualiza a chave unidade/CNPJ/competência.

O resumo mensal é exibido separadamente dos indicadores operacionais e não
alimenta automaticamente DRE, caixa, metas, clientes, turnos ou produtos por dia.
Essa separação evita somar EFD, XML e relatórios de venda como novas receitas.

## Notas de saída

Em Financeiro → DRE → NF-e Saída → Importar NF-e Saída, selecionar um ou vários
XMLs ou ZIPs contendo XMLs, inclusive subpastas. A prévia mostra quantidade,
cancelamentos, total fiscal e arquivos rejeitados. Conferir e confirmar.

O parser existente aceita NF-e e NFC-e (`nfeProc/NFe`, modelos 55 e 65).
O emitente precisa estar vinculado à unidade em `unit_cnpjs`. Notas de saída
são evidências fiscais; não são adicionadas ao CMV nem à receita operacional.

## Validação com os arquivos fornecidos

- EFD completo: 542 páginas, competência 06/2026.
- Receita fiscal: R$ 2.540.327,33, igual nos resumos PIS e COFINS.
- Saldo devedor PIS: R$ 14.423,75; COFINS: R$ 66.557,10.
- XML NFC-e: modelo 65, nota 42731, série 1, emissão 02/06/2026,
  status 100 (autorizada), seis itens, valor fiscal R$ 393,25.
- Os arquivos financeiros foram lidos para teste, sem importação de valores no banco.

## Ativação

Migração `20261007183112_receita_fiscal_efd.sql` aplicada ao Supabase Marena em
07/10/2026. A tabela usa RLS e as regras financeiras de acesso por unidade.
O arquivo local usa a mesma versão registrada no histórico remoto.
O cadastro de marca, unidade e CNPJ Marena foi concluído no banco remoto.
