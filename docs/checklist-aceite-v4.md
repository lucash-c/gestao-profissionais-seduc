# Checklist de aceite V4

Status usados: **ATENDIDO**, **NÃO APLICÁVEL** e **PENDÊNCIA FORMAL**.

As evidências automatizadas estão nas suítes `packages/database/tests/integration`,
`apps/api/tests/integration`, `apps/api/tests/unit` e `apps/web/tests`. O CI usa PostgreSQL 17.

| Item                                                | Status           | Evidência                                                                      |
| --------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| Diretor/Secretário limitados às unidades vinculadas | ATENDIDO         | política backend, escopo administrativo e testes de cadastros                  |
| Diretor em múltiplas unidades; Secretário em uma    | ATENDIDO         | migration aditiva, constraints e testes PostgreSQL                             |
| somente Administrador altera pontuação              | ATENDIDO         | autorização backend e testes de cadastros                                      |
| pontuação inicial de professor em zero              | ATENDIDO         | default/constraint e testes de banco                                           |
| `remocao`/`permuta` default `FALSE`                 | ATENDIDO         | schema/migration e testes de defaults                                          |
| Operador não altera flags durante sessão            | ATENDIDO         | UI somente leitura e autorização do cadastro                                   |
| preparação mantém todos do cargo visíveis           | ATENDIDO         | serviço e testes de preparação/frontend                                        |
| seletores apenas marcam/desmarcam                   | ATENDIDO         | testes de preparação/frontend                                                  |
| fila permanece RASCUNHO na preparação               | ATENDIDO         | estados e testes PostgreSQL                                                    |
| fila/snapshots congelados ao iniciar                | ATENDIDO         | constraints, transação e testes de eventos                                     |
| ranking e empate usam somente critérios V4          | ATENDIDO         | testes de evento/ranking                                                       |
| telão e histórico público sanitizados               | ATENDIDO         | projeções dedicadas e integração HTTP                                          |
| múltiplos telefones                                 | ATENDIDO         | modelo relacional e testes de cadastros                                        |
| quadro normalizado com cargo/período/segmento       | ATENDIDO         | schema, índices parciais e testes de banco                                     |
| quantidade zero e inativação histórica de postos    | ATENDIDO         | migration, transação e testes de quadro                                        |
| postos individuais                                  | ATENDIDO         | `posto_trabalho` e integrações                                                 |
| sede histórica, sem campo simples no profissional   | ATENDIDO         | `lotacao_sede`, índices parciais e testes                                      |
| titular de sede x ocupante em exercício             | ATENDIDO         | relações/constraints e testes PostgreSQL                                       |
| disponibilidade COM SEDE/SEM SEDE calculada         | ATENDIDO         | motor e testes de lotação/eventos                                              |
| substituições em cadeia                             | ATENDIDO         | motor, triggers e testes de concorrência                                       |
| regra de período FIXED/ANY/BLOCKED                  | ATENDIDO         | simulação/confirmação e testes PostgreSQL                                      |
| movimentação registra operador/data                 | ATENDIDO         | transação de escolha/permuta e testes                                          |
| somente Operador cria/opera eventos                 | ATENDIDO         | política RBAC backend e testes HTTP                                            |
| sem autoatendimento/login de profissional           | ATENDIDO         | rotas administrativas e tela de login                                          |
| Permuta atômica                                     | ATENDIDO         | locks, movimentação única e concorrência real                                  |
| encerramento de Remoção/Listão/Permuta              | ATENDIDO         | estados, pendências e regressão PostgreSQL                                     |
| auditoria das alterações normais                    | ATENDIDO         | escrita transacional e testes da Etapa 9                                       |
| Correção Administrativa                             | REMOVIDO         | módulo retirado da entrega final na Etapa 11                                   |
| Exclusão administrativa protegida                   | ATENDIDO         | senha atual e bloqueio de históricos                                           |
| filtros cargo/período e paginação                   | ATENDIDO         | APIs e testes server-side                                                      |
| RBAC dos CRUDs                                      | ATENDIDO         | autorização e integrações por perfil                                           |
| pontuação não é calculada pelo sistema              | ATENDIDO         | valor administrativo persistido/snapshot                                       |
| elegibilidade Remoção/Permuta                       | ATENDIDO         | preparação e testes de flags/vínculos                                          |
| constraints, migrations vazias e upgrade            | ATENDIDO         | suítes do pacote database no PostgreSQL 17                                     |
| concorrência e rollback integral                    | ATENDIDO         | testes reais de lotação, exercício, eventos, permuta e correção                |
| Docker Compose de produção                          | ATENDIDO         | config/build no CI; banco não publicado                                        |
| healthchecks live/ready                             | ATENDIDO         | testes unitários e PostgreSQL real                                             |
| backup custom e restauração                         | ATENDIDO         | scripts seguros e prova PostgreSQL 17 no CI                                    |
| credencial conhecida em produção                    | NÃO APLICÁVEL    | bootstrap conhecido bloqueado em `production`; bootstrap explícito obrigatório |
| ausência/desistência em evento                      | PENDÊNCIA FORMAL | regra de negócio não definida na V4                                            |
| salto de participante                               | PENDÊNCIA FORMAL | regra de negócio não definida                                                  |
| “manter na mesma sede”                              | PENDÊNCIA FORMAL | regra de negócio não definida                                                  |

Nenhuma pendência formal acima foi preenchida por comportamento inventado.
