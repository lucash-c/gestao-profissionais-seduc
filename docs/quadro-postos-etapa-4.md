# Etapa 4 — Quadro de Necessidades e Postos

## Escopo

A Etapa 4 torna funcionais `quadro_necessidade` e `posto_trabalho`. Não existe tabela ou entidade independente de vaga: cada necessidade materializa postos individuais e preserva sua identidade histórica.

Não fazem parte desta etapa os fluxos de lotação, exercício, afastamento, substituição, movimentação, evento ou disponibilidade `SEM_SEDE`.

## Permissões

- `ADMINISTRADOR`: consulta e gerencia quadros e postos;
- `OPERADOR`: consulta quadros e postos, sem mutações;
- `DIRETOR` e `SECRETARIO`: não consultam nem administram este módulo estrutural.

As restrições são aplicadas pela política central e pelos endpoints. O frontend replica as permissões somente para experiência visual.

## Materialização e quantidade

Ao criar uma necessidade com quantidade `N`, a mesma transação cria o quadro e exatamente `N` postos ativos.

Ao aumentar a quantidade, são criados somente os postos adicionais. Ao reduzir, postos livres são inativados sem exclusão física. A seleção é determinística e prioriza postos sem histórico; nenhum registro histórico é removido.

Postos com sede ativa ou exercício ativo não podem ser inativados. Se não houver postos livres suficientes, toda a alteração é rejeitada com conflito HTTP 409.

A inativação ou reativação manual de um posto livre também ajusta a quantidade do quadro na mesma transação. A quantidade pode chegar a zero, mantendo o quadro sem postos ativos e preservando os postos inativos para histórico.

## Integridade e concorrência

Toda alteração de quantidade bloqueia a linha de `quadro_necessidade` com `SELECT … FOR UPDATE`. Requisições concorrentes para o mesmo quadro são serializadas e recalculam a diferença usando o estado confirmado mais recente.

Criação, aumento, redução e alteração manual de status são atômicos. A unidade, o ano letivo, o cargo, o período e o segmento tornam-se imutáveis depois que existem postos materializados.

A compatibilidade entre cargo/função e tipo de unidade é consultada em `cargo_tipo_unidade`; não existem combinações hardcoded.

## Estado estrutural

A consulta de postos expõe separadamente:

- ativo ou inativo;
- titular de sede ativo, quando houver;
- ocupante em exercício ativo, quando houver;
- `Com sede: disponível`, apenas para posto ativo sem titular de sede;
- `Com sede: ocupado`, quando existe titular ativo;
- `Inativo`.

Nenhum posto é rotulado como `SEM_SEDE` nesta etapa.

## Endpoints

- `GET /quadros`
- `POST /quadros`
- `GET /quadros/:id`
- `PATCH /quadros/:id`
- `GET /postos`
- `GET /postos/:id`
- `PATCH /postos/:id/status`

Não existe endpoint de exclusão física.
