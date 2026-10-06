# Etapa 7 — Central Operacional de Remoção/Listão

## Escopo

A Central Operacional atende eventos `REMOCAO` e `LISTAO` que já foram iniciados. A fila oficial é a sequência congelada na Etapa 6: nenhuma classificação é recalculada e o participante atual é sempre o registro `AGUARDANDO` de menor posição.

Eventos `PERMUTA` não são operados nesta etapa. Ausência, desistência e salto de participante também não possuem ação funcional.

## Fila e situação do participante

A Central apresenta o participante atual, os próximos cinco, a fila completa e os totais por status. Participantes já atendidos permanecem no histórico, mas nunca voltam a ser considerados como o atual.

A situação administrativa é derivada dos históricos ativos de lotação de sede e exercício. A Central não grava sede ou exercício diretamente no cadastro do profissional.

## Período operacional

O período usado para consultar vagas é resolvido no backend:

1. exercícios ativos têm prioridade sobre a sede;
2. quando todos os exercícios ativos apontam para um único período, esse período é usado;
3. na ausência de exercício ativo, usa-se o período da lotação de sede ativa;
4. sem vínculo que determine o período, ou com exercícios em períodos diferentes, a escolha é bloqueada com `EVENT_PERIOD_RULE_REQUIRED`.

Os filtros da interface não substituem essa validação.

## Vagas e simulação

As vagas pertencem ao mesmo ano, cargo e período do atendimento. A disponibilidade `COM_SEDE` ou `SEM_SEDE` é calculada pelo motor da Etapa 5; postos indisponíveis continuam excluídos da escolha.

A simulação executa as mesmas validações de compatibilidade usadas na confirmação e não produz escrita. Ela informa origem, destino, tipo de destino, eventual profissional substituído e impactos esperados.

## Confirmação transacional

O cliente envia somente o participante esperado e o posto escolhido. O servidor volta a determinar o participante atual e rejeita requisições obsoletas, impedindo que duas confirmações concorrentes atendam pessoas diferentes por acidente.

A escolha ocorre em uma única transação:

- bloqueia o evento, o participante, os profissionais e os postos envolvidos em ordem consistente;
- revalida status, tipo do evento, posição atual, período, cargo e disponibilidade;
- registra ou encerra os históricos necessários;
- cria uma `movimentacao` e exatamente um `movimentacao_item`;
- marca o participante como `ATENDIDO`.

Falhas revertem integralmente a operação.

### Destino COM SEDE

A lotação anterior é encerrada e uma nova lotação ativa é criada no posto escolhido. Um posto de origem com ocupante temporário ativo não pode ser liberado silenciosamente. Exercícios ativos compatíveis com a regra de múltiplos exercícios continuam preservados.

### Destino SEM SEDE

O titular da sede de destino é preservado e o participante passa a exercê-la como substituição. Exatamente um exercício anterior pode ser encerrado; uma situação ambígua com múltiplos exercícios ativos é bloqueada. O tipo registrado é `SUBSTITUICAO` para quem possui sede e `SEM_SEDE` para quem não possui.

## Concorrência

O bloqueio pessimista do evento serializa escolhas do mesmo evento. O bloqueio dos postos impede que eventos diferentes consumam simultaneamente a mesma disponibilidade. A ordem fixa dos bloqueios reduz o risco de deadlock, e conflitos transacionais são devolvidos como conflito de operação, sem efeito parcial.

## Encerramento

Somente um `OPERADOR` pode operar ou encerrar a Central. O encerramento é permitido apenas quando não restar participante `AGUARDANDO`; a data final é definida pelo servidor. `ADMINISTRADOR`, `DIRETOR` e `SECRETARIO` não executam o evento.

## API

Rotas internas, exclusivas de `OPERADOR`:

- `GET /eventos/:id/central`;
- `GET /eventos/:id/vagas`;
- `GET /eventos/:id/simular-escolha`;
- `POST /eventos/:id/escolha`;
- `GET /eventos/:id/movimentacoes`;
- `POST /eventos/:id/encerrar`.

Rotas públicas, sem autenticação:

- `GET /publico/eventos/:id/telao`;
- `GET /publico/eventos/:id/escolhas`.

## Telão público

O telão mostra o evento, o participante atual, os próximos da fila, totais, vagas agregadas e as escolhas já realizadas. A resposta pública é montada por DTO próprio e não expõe CPF, matrícula, nascimento, endereço, telefone, identificadores internos de profissional/posto ou detalhes administrativos desnecessários.

Eventos encerrados continuam disponíveis como resultado histórico. Rascunhos, cancelados e tipos não suportados não são publicados como uma Central ativa.

## Limite desta etapa

A Etapa 7 não implementa Permuta operacional, ausência, desistência, salto de participante, auditoria automática ou correção administrativa. Nenhuma dessas situações recebe comportamento implícito.
