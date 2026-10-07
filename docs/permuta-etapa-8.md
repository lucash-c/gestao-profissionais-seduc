# Etapa 8 — Permuta

## Escopo

A Etapa 8 implementa a operação presencial de eventos do tipo `PERMUTA`. Somente o perfil `OPERADOR` acessa a central e confirma trocas. A fila oficial permanece congelada desde o início do evento: o participante atual é sempre a menor posição com status `AGUARDANDO`, e o segundo participante é escolhido entre os demais aguardando no mesmo evento.

Ausência, desistência, salto de participante e quaisquer operações da Etapa 9 permanecem fora deste escopo.

## Validação bilateral

A simulação e a confirmação usam a mesma validação. Os dois participantes devem estar ativos, aguardando no mesmo evento e vinculados ao cargo do evento. Cada um precisa possuir exatamente uma sede oficial ativa em posto ativo, no ano e cargo do evento, e ambas as sedes devem pertencer ao mesmo período.

A operação é bloqueada quando a situação não pode ser trocada com segurança, incluindo:

- exercício ativo ou afastamento ativo de qualquer participante;
- ocupante temporário ativo em qualquer um dos postos;
- sede inexistente, ambígua, inativa ou incompatível com cargo, ano ou período;
- alteração de participante atual ou de sede entre simulação e confirmação.

A implementação não desloca terceiros. Situações ambíguas devem ser regularizadas pelos fluxos administrativos próprios antes da Permuta.

## Simulação e confirmação

A tela apresenta os dois lados e compara explicitamente `ANTES` e `DEPOIS`. A simulação não grava dados. Ela devolve também os identificadores esperados do participante atual e das duas sedes; a confirmação os exige para detectar uma tela obsoleta sem permitir que o cliente determine os destinos.

Na confirmação, uma única transação PostgreSQL:

1. bloqueia o evento, os participantes, os profissionais e as posições em ordem consistente;
2. repete toda a validação bilateral;
3. encerra as duas lotações de sede existentes;
4. cria as duas novas lotações com os postos trocados;
5. cria uma movimentação `PERMUTA` com exatamente dois itens;
6. marca os dois participantes como `ATENDIDO`.

Qualquer falha desfaz a operação inteira. Reenvios, confirmações simultâneas e duas operações concorrentes envolvendo os mesmos postos não produzem troca parcial nem movimentação duplicada.

## Histórico

As lotações anteriores são preservadas com data de encerramento. A movimentação registra usuário e data/hora no servidor, as duas origens e os dois destinos. A central exibe a fila congelada e as últimas Permutas concluídas.

Quando não resta participante `AGUARDANDO`, o `OPERADOR` pode encerrar a Permuta pelo mesmo endpoint de encerramento dos demais eventos. A transação bloqueia o evento, confere novamente a fila, define `ENCERRADO` e a data final do servidor e registra a mudança na auditoria técnica. O encerramento não cria movimentação. Eventos encerrados permanecem consultáveis na central de Permuta em modo somente leitura e não aceitam novas confirmações.
