# Decisões de domínio complementares - V4

Registro das definições confirmadas em 30/09/2026. Estas decisões complementam a especificação V4 e devem ser respeitadas nas etapas futuras.

## Diretor de Unidade e Secretário Escolar

Podem cadastrar e alterar:

- os dados da própria unidade;
- os profissionais vinculados à própria unidade.

Para fins de escopo cadastral, a unidade administrativa do profissional é a unidade da `lotacao_sede` ativa. Se não houver sede ativa, usa-se a unidade do `exercicio_profissional` ativo. Sem nenhum desses vínculos ativos, o profissional só pode ser administrado pelo `ADMINISTRADOR`. A sede sempre prevalece quando sede e exercício apontam para unidades diferentes.

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
- O exercício atual deriva de `exercicio_profissional`.
- Alterações acontecem pelos fluxos próprios de movimentação.
- Correções excepcionais podem ocorrer no Módulo de Correção Administrativa.

## Ações ainda sem regra definitiva

Ausência, desistência e “manter na mesma sede” não devem receber comportamento funcional definitivo até nova orientação.

## Preparação da fila

A fila permanece em `RASCUNHO` durante a preparação. Participantes, critérios e posição oficial são congelados somente quando o Operador inicia o evento. O texto conflitante do mockup deverá ser corrigido quando a Etapa 6 for autorizada.
