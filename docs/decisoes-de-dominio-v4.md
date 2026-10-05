# Decisões de domínio complementares - V4

Registro das definições confirmadas em 30/09/2026. Estas decisões complementam a especificação V4 e devem ser respeitadas nas etapas futuras.

## Diretor de Unidade e Secretário Escolar

Podem cadastrar e alterar:

- os dados da própria unidade;
- os profissionais vinculados à própria unidade.

Para fins de escopo administrativo de Diretor/Secretário, todos os registros ativos de `exercicio_profissional` possuem prioridade sobre a `lotacao_sede` ativa. Suas unidades distintas formam o conjunto administrativo do profissional. A sede é usada como fallback somente quando não existir nenhum exercício ativo. Sem nenhum desses vínculos ativos, o profissional só pode ser administrado pelo `ADMINISTRADOR`. Essa precedência vale apenas para RBAC e não altera os dois históricos independentes.

Somente profissionais em cargos com `permite_multiplos_exercicios = TRUE` podem possuir mais de um exercício ativo. A capacidade é configurável no cargo e não deve ser inferida pelo nome “Diretor”. Os demais cargos continuam limitados a um exercício ativo.

O usuário com perfil `DIRETOR` pode administrar uma ou várias unidades, mantidas exclusivamente em `usuario_unidade`. O perfil `SECRETARIO` exige exatamente uma unidade. `ADMINISTRADOR` e `OPERADOR` não mantêm esses vínculos; o Administrador possui escopo global. Para Diretor e Secretário, a autorização de um profissional ocorre quando há interseção entre suas unidades autorizadas e o conjunto administrativo calculado do profissional.

A criação inicial de profissional é exclusiva do `ADMINISTRADOR`. Diretor e Secretário editam somente profissionais abrangidos pelo cálculo acima; esse cadastro não cria lotação ou exercício automaticamente.

Não podem:

- administrar quadro de necessidades;
- criar ou alterar postos de trabalho ou vagas;
- alterar lotação/sede ou exercício;
- executar movimentações de evento.

## Sede e exercício na ficha do profissional

- Podem ser exibidos para consulta.
- Não são campos cadastrais comuns sobrescrevíveis.
- A sede atual deriva do histórico de `lotacao_sede`.
- Os exercícios atuais derivam de `exercicio_profissional` e podem ser plurais quando o cargo permitir.
- Alterações acontecem pelos fluxos próprios de movimentação.
- Correções excepcionais podem ocorrer no Módulo de Correção Administrativa.

## Ações ainda sem regra definitiva

Ausência, desistência e “manter na mesma sede” não devem receber comportamento funcional definitivo até nova orientação.

## Preparação da fila

A fila permanece em `RASCUNHO` durante a preparação. Participantes, critérios e posição oficial são congelados somente quando o Operador inicia o evento. O texto conflitante do mockup deverá ser corrigido quando a Etapa 6 for autorizada.
