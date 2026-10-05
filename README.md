# Marena · Orkestri

Sistema independente para a Marena, com código e estrutura do sistema original e sem dados operacionais do cliente anterior.

## Aplicações

| Aplicação | Diretório | Porta local |
|---|---|---|
| Portal, login, Pessoas, Eventos, Inteligência | `apps/maza` | 3000 |
| Financeiro | `apps/financeiro` | 3001 |
| Operação | `apps/operacao` | 3003 |
| Compras | `apps/compras` | 3004 |
| MISE · visão geral | `apps/mise-visao` | 3008 |
| MISE · backoffice | `apps/mise-backoffice` | 3009 |

O diretório do portal e os identificadores internos `@maza`, `@kph` e nomes de tabelas/funções foram preservados para compatibilidade. O produto e o banco de destino são da Marena.

## Desenvolvimento

Use Node.js 22+ e npm. Na raiz:

```sh
npm ci
cp .env.example .env.local
```

Copie também o `.env.example` de cada aplicação para `.env.local` e preencha as chaves do **Supabase Marena**. A chave `service_role` só pode ficar em variáveis de servidor. Nunca use prefixo `NEXT_PUBLIC_` para essa chave nem a grave no Git.

```sh
npm run dev
npm run type-check
npm run build
npm run test:ui --workspace marena-financeiro
npm run test:dashboard --workspace marena-shell
node scripts/verify-isolation.mjs
```

O portal encaminha `/financeiro`, `/operacao`, `/compras` e `/mise` para as aplicações correspondentes. MISE backoffice tem acesso direto pela porta 3009.

## Supabase

Projeto: `hneehjanflbyajrpsdpf`.

As duas migrações de `supabase/migrations` já foram aplicadas no projeto indicado. Não reaplique o baseline manualmente nesse banco. Para uma instalação vazia, aplique as migrações pela CLI. Há 278 tabelas, sem dados operacionais, quatro buckets vazios e catálogos básicos (perfis e plano de contas).

**Pendente de autorização:** incluir `mise` nos schemas expostos da Data API. As tabelas existem, mas os módulos MISE dependem dessa configuração para consultá-las. Consulte [o procedimento oficial](https://supabase.com/docs/guides/api/using-custom-schemas).

O primeiro administrador deve ser criado com um e-mail novo. Informe a senha por variável de ambiente temporária `MARENA_ADMIN_PASSWORD` (mínimo 12 caracteres) e execute:

```sh
node --env-file=.env.local scripts/create-admin.mjs administrador@exemplo.com
```

O script não envia e-mail e não altera usuários existentes. Depois, cadastre as marcas, unidades e CNPJs próprios da Marena. Nenhum cadastro empresarial da origem foi copiado.

## Configuração específica do cliente

As unidades disponíveis são consultadas no banco e respeitam a sessão. O financeiro usa a conta de receita `1.01` por padrão. Se houver canal de delivery, configure `NEXT_PUBLIC_DELIVERY_UNIT_ID` com a unidade cadastrada na Marena; ela usará `1.02`. `DELIVERY_IMPORT_MARKER` habilita roteamento por texto de planilha somente quando configurado. Sem essas variáveis, as compras ficam na unidade escolhida pelo usuário.

`ERP_COMPANY_BY_UNIT_JSON` mapeia UUIDs de unidades para códigos de empresa do ERP; o padrão é vazio. Não reutilize os códigos do cliente anterior.

Integrações de IA, Discord, webhooks, impressoras e automações precisam de credenciais/configuração próprias. Elas não foram copiadas nem ativadas.

## Hospedagem

Crie um projeto por aplicação, usando este mesmo repositório e o respectivo diretório raiz. Defina as variáveis do `.env.example` em cada projeto. No portal, `FINANCEIRO_APP_URL`, `OPERACAO_APP_URL`, `COMPRAS_APP_URL` e `MISE_APP_URL` devem ser as URLs dos módulos **Marena**. Em todos os módulos, `NEXT_PUBLIC_SHELL_URL` deve ser a URL do portal. Configure `NEXT_PUBLIC_APP_URL` e as URLs de redirecionamento do Supabase Auth para esse domínio.

Nenhum fallback de produção aponta para a Maza. Configure as origens antes do build de produção. As configurações de hospedagem da origem não foram clonadas.

## Validação e limitações

Veja [VALIDACAO.md](docs/VALIDACAO.md) para os testes, o inventário sem dados, a pendência da API MISE e os alertas de segurança herdados. Esta entrega não inclui uma auditoria completa de segurança nem publicação em produção.
