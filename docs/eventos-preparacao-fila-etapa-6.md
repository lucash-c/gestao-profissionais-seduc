# Etapa 6 — Eventos e preparação da fila

## Evento em RASCUNHO

Eventos são criados exclusivamente por usuários `OPERADOR` e sempre nascem em `RASCUNHO`, sem usuário de início nem datas de sessão. Nome, ano, tipo e cargo/função podem ser editados nessa fase. A troca de tipo ou cargo é rejeitada quando já existem participantes, exigindo que o operador limpe e revise a preparação.

O cargo/função é obrigatório em `evento.cargo_funcao_id`. A migration não infere cargo para dados legados: sua aplicação falha explicitamente se encontrar eventos anteriores sem uma associação legítima.

## Elegibilidade e seletores

A preparação retorna todos os profissionais ativos do cargo do evento. A busca visual apenas realça nome ou matrícula e nunca remove linhas. CPF, endereço e outros dados pessoais desnecessários não são expostos.

- `REMOCAO`: exige `profissional.remocao = true`;
- `PERMUTA`: exige `profissional.permuta = true`;
- `LISTAO`: todos os profissionais ativos do cargo são elegíveis.

Inelegíveis permanecem visíveis, com motivo e seleção bloqueada. O backend revalida toda seleção e rejeita IDs inexistentes, inativos, repetidos, de outro cargo ou inelegíveis.

Os seletores `TODOS`, `COM SEDE`, `SEM SEDE`, `REMOÇÃO` e `PERMUTA` alteram os checkboxes somente dentro do conjunto elegível. `COM SEDE` significa possuir `lotacao_sede` ativa; não representa a disponibilidade de um posto.

## Prévia e classificação

A prévia usa os dados atuais, não grava posição e não congela critérios. Para cargo com pontuação, a ordem é:

1. pontuação decrescente;
2. entrada na Prefeitura crescente;
3. nascimento crescente;
4. número de filhos decrescente.

Para cargo sem pontuação, a pontuação não participa; aplicam-se somente entrada, nascimento e número de filhos, nessa ordem.

Nome, matrícula, CPF, UUID e ordem de inserção não são critérios. Igualdade em todos os critérios oficiais forma um grupo `EMPATE_PENDENTE`. A prévia não atribui posição a esse grupo e o início retorna `409 EVENT_HAS_PENDING_TIES` sem efeitos parciais.

## Início, snapshots e congelamento

O início bloqueia o evento com `SELECT ... FOR UPDATE` e executa em uma única transação. São revalidados status, cargo, participantes, atividade, elegibilidade e empates. O usuário de início vem da sessão autenticada e `data_inicio` usa o relógio do servidor.

No instante do início são gravados:

- `pontuacao_snapshot`, somente para cargo que usa pontuação;
- `data_entrada_snapshot`;
- `data_nascimento_snapshot`;
- `numero_filhos_snapshot`;
- `posicao`, de 1 a N.

Os participantes passam de `SELECIONADO` para `AGUARDANDO` e o evento de `RASCUNHO` para `ATIVO`. Alterações cadastrais posteriores não recalculam os critérios nem as posições oficiais.

Triggers PostgreSQL impedem inserir ou remover participantes e alterar profissional, evento, snapshots ou posição depois do início. A mudança futura apenas do status do participante, como `AGUARDANDO -> ATENDIDO`, permanece permitida. Tipo, ano e cargo do evento também ficam congelados.

Preparações concorrentes e início concorrente são serializados pelo bloqueio do evento. A seleção persistida sempre corresponde integralmente a uma requisição, sem mistura parcial.

## API

Todos os endpoints abaixo são exclusivos de `OPERADOR`:

- `GET /eventos`;
- `POST /eventos`;
- `GET /eventos/:id`;
- `PATCH /eventos/:id`;
- `GET /eventos/:id/preparacao`;
- `PUT /eventos/:id/preparacao`;
- `POST /eventos/:id/iniciar`.

## Limite desta etapa

A Etapa 6 não escolhe vagas, não movimenta profissionais e não implementa Remoção/Listão ou Permuta operacional, Central Operacional, telão público, ausência/desistência, auditoria ou correção administrativa.
