# Validação da clonagem

Destino: Supabase `hneehjanflbyajrpsdpf` e repositório `ikeguimaraes-dot/marena.orkestri`.

- Seis aplicações: portal, financeiro, operação, compras, MISE visão e MISE backoffice.
- Estrutura exportada diretamente do banco: 254 tabelas `public`, 22 `mise`, 2 `opx`; tipos, funções, views, índices, gatilhos, constraints e políticas incluídos.
- Nenhum registro operacional, usuário, arquivo, sessão, funcionário, fornecedor ou empresa da origem importado.
- Catálogos iniciais: 40 contas contábeis, 2 perfis de acesso com IDs novos e grupo Marena.
- Diagnóstico temporário que retornava amostras de dados com service role removido do código novo.
- Quatro buckets privados recriados sem objetos: contratos, protestos, folha-documentos, financeiro-importacoes.
- Verificação de tipos e build de produção dos seis módulos concluídos.
- 68 testes financeiros e de isolamento e 4 testes de roteamento concluídos.
- Smoke local: login HTTP 200; dashboard, financeiro, operação e compras redirecionam para login sem sessão.
- Inventário origem/destino idêntico: 278 tabelas, 3.277 colunas (incluindo views), 728 índices, 106 funções e 937 constraints.
- Teste autenticado com usuário temporário não executado: bloqueado pela revisão automática por envolver concessão de acesso founder.
- O código não utiliza endpoints, credenciais ou IDs de unidades da origem.
- Páginas estáticas antigas de Eventos/Recrutamento conectadas a outro projeto foram substituídas pelas rotas nativas do portal.

## Pendências de ativação

O schema `mise` existe, mas a API retorna PGRST106 enquanto ele não for habilitado nos schemas expostos. A revisão automática bloqueou essa ampliação até autorização explícita do proprietário. Os módulos MISE dependem dela.

Nenhum usuário real foi criado: falta informar o e-mail do primeiro administrador. Unidades, marcas, CNPJs, funcionários e demais cadastros devem ser criados para a Marena.

Deploy e domínio não fazem parte desta entrega ao repositório. Configure os projetos de hospedagem e as variáveis documentadas no README.

## Permissões herdadas

RLS está habilitada nas tabelas e as views usam security_invoker. A clonagem preserva as demais políticas e funções existentes. O advisor apontou permissões legadas amplas, funções SECURITY DEFINER acessíveis e funções sem search_path fixo. Não interpretar esta clonagem como uma auditoria de segurança concluída.

Uma proposta de revisão ampla de permissões foi rejeitada pela revisão automática por exceder o escopo de clonagem e poder afetar acesso/disponibilidade. Ela não foi aplicada. Revisar essas permissões antes de cadastrar dados sensíveis ou abrir acesso público.

O npm audit das dependências herdadas apontou 21 ocorrências (3 moderadas, 17 altas, 1 crítica). Não foi feita atualização indiscriminada de versões nesta clonagem.
