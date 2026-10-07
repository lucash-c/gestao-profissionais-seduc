# Etapa 9 — Auditoria e Correção Administrativa

## Dois históricos distintos

`movimentacao` e `movimentacao_item` registram decisões presenciais de Remoção, Listão e Permuta. Esses registros continuam sendo a fonte do histórico operacional dos eventos.

`auditoria` registra alterações administrativas normais. Cada linha contém o usuário autenticado, a entidade, o registro, a ação (`CREATE`, `UPDATE` ou `DELETE`), os estados anterior e posterior em JSONB e a data/hora do servidor. Inativação é `UPDATE`. Uma atualização sem mudança persistida não cria linha.

A auditoria é criada na mesma transação da alteração. Se sua gravação falhar, a alteração é revertida; uma transação revertida não deixa auditoria.

## Matriz de cobertura

| Rota ou fluxo mutável normal                                                       | Entidade auditada                       | Ação                        | Teste principal                             |
| ---------------------------------------------------------------------------------- | --------------------------------------- | --------------------------- | ------------------------------------------- |
| Unidades: criar/editar/inativar                                                    | `UNIDADE`                               | CREATE/UPDATE               | integração Etapa 9 e regressão de cadastros |
| Telefones de unidade: criar/editar/excluir                                         | `UNIDADE_TELEFONE`                      | CREATE/UPDATE/DELETE        | integração Etapa 9 e regressão de cadastros |
| Profissionais: criar/editar/inativar, flags Remoção/Permuta e coleção de telefones | `PROFISSIONAL`                          | CREATE/UPDATE               | regressão PostgreSQL de cadastros           |
| Telefones de profissional: criar/editar/excluir                                    | `PROFISSIONAL_TELEFONE`                 | CREATE/UPDATE/DELETE        | regressão PostgreSQL de cadastros           |
| Pontuação oficial                                                                  | `PROFISSIONAL_PONTUACAO`                | UPDATE                      | regressão PostgreSQL de cadastros           |
| Usuários e vínculos de unidade                                                     | `USUARIO`                               | CREATE/UPDATE               | integração Etapa 9 e regressão de cadastros |
| Redefinição de senha                                                               | `USUARIO_CREDENCIAL`                    | UPDATE sem conteúdo secreto | teste de segurança da Etapa 9               |
| Quadro de necessidades e materialização/inativação decorrente de postos            | `QUADRO_NECESSIDADE`                    | CREATE/UPDATE               | regressão PostgreSQL de quadro              |
| Ativação/inativação individual de posto                                            | `POSTO_TRABALHO`                        | UPDATE                      | regressão PostgreSQL de quadro              |
| Afastamento administrativo: criar/encerrar                                         | `AFASTAMENTO_PROFISSIONAL`              | CREATE/UPDATE               | regressão PostgreSQL de vínculos            |
| Evento: criar/editar/preparar/iniciar/encerrar                                     | `EVENTO` ou `EVENTO_PREPARACAO`         | CREATE/UPDATE               | regressão PostgreSQL de eventos             |
| Escolhas de Remoção/Listão e Permuta                                               | `movimentacao` + itens, não `auditoria` | histórico operacional       | integrações das Etapas 7 e 8                |

Não existem, nesta etapa, endpoints administrativos normais para editar diretamente lotação de sede ou exercício. As alterações executadas por eventos continuam registradas exclusivamente como movimentação. Uma futura correção excepcional desses vínculos exige regra formal própria e não foi improvisada.

## Segurança e consulta

Campos relacionados a senha, hash, token, cookie, segredo, credencial ou conexão são removidos de qualquer JSON de auditoria. A redefinição de senha registra somente que a credencial foi alterada. O telão e os endpoints públicos não consultam nem expõem auditoria.

Somente `ADMINISTRADOR` acessa `GET /auditoria`. A consulta é paginada no servidor, ordenada por `dataHora DESC, id DESC`, e aceita filtros por período, usuário, entidade, registro, ação, unidade e profissional. Os identificadores de unidade/profissional são preenchidos pelo backend quando a relação é verificável.

Não existem endpoints de alteração ou exclusão de auditoria.

## Correção Administrativa

O módulo usa router, service, schemas e páginas próprios em `/correcao-administrativa`. Somente `ADMINISTRADOR` possui acesso global. Não existe `skipAudit`, `ignoreHistory` nem outro bypass nos endpoints normais.

O fluxo é explícito: informar entidade, registro, campo permitido e novo valor; solicitar a prévia; conferir `ANTES` e `DEPOIS`; confirmar em diálogo. O payload submetido à prévia fica congelado para a confirmação, junto com uma versão criptográfica do estado conferido. O botão bloqueia submissão duplicada. Um aviso permanente esclarece que a exceção se limita às tabelas de negócio.

As correções permitidas são uma lista fechada:

- unidade: nome, código INEP e estado ativo;
- profissional: nome, matrícula, CPF, datas civis de nascimento e ingresso, número de filhos, flags Remoção/Permuta e estado ativo.

A transação bloqueia o registro e, depois do bloqueio, confere se a versão permanece igual à da prévia. Uma alteração concorrente invalida a confirmação com `409` e obriga nova prévia, sem escrita parcial. Todas as constraints do PostgreSQL permanecem ativas. Correções não geram `auditoria`, `movimentacao` ou `movimentacao_item`, mas também não removem históricos legítimos existentes.

Não é permitido pelo módulo: SQL arbitrário; campos inesperados; exclusão física de históricos; alteração de filas, snapshots, posições ou movimentações; criação de sede/exercício incompatível; desativação de constraints. Correções de lotação, exercício ou outro vínculo histórico que demandem regras adicionais permanecem bloqueadas até decisão administrativa formal.
