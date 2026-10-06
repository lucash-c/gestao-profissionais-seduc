# Etapa 5 — Lotação, exercício, afastamentos e disponibilidade

## Disponibilidade derivada

A disponibilidade não é persistida e não existe tabela de vaga. O mesmo motor calcula o estado de cada `posto_trabalho` a partir de posto ativo, lotação de sede ativa, exercício ativo e afastamentos ativos:

- `INATIVO`: posto inativo;
- `DISPONIVEL_COM_SEDE`: posto ativo, sem titular e sem ocupante;
- `DISPONIVEL_SEM_SEDE`: posto ativo com titular temporariamente fora por afastamento ou exercício em outro posto, e sem ocupante;
- `INDISPONIVEL`: demais situações, inclusive titular presente ou ocupante temporário ativo.

Históricos encerrados não bloqueiam disponibilidade.

## Sede e exercício temporário

A atribuição de sede e o início/encerramento de exercício são use-cases transacionais internos, destinados aos fluxos futuros de movimentação. Não há CRUD público para Diretor, Secretário ou Operador.

Ao iniciar exercício temporário, o backend identifica o titular do posto e calcula:

- `SUBSTITUICAO` quando o ocupante possui sede ativa;
- `SEM_SEDE` quando o ocupante não possui sede ativa.

O cliente não informa `tipo_exercicio` nem `substitui_profissional_id`. Titularidades nunca são transferidas pela substituição. Encerramentos preenchem `data_fim`; históricos não são apagados.

## Afastamentos e RBAC

Os endpoints de afastamento permitem consulta de histórico, registro e encerramento. Administrador possui escopo global; Diretor e Secretário atuam somente sobre profissionais do escopo administrativo atual; Operador possui somente leitura. Exercícios ativos continuam tendo prioridade sobre sede no cálculo desse escopo.

O encerramento do último motivo que mantém um titular fora da própria sede é rejeitado enquanto houver substituto ativo. Transações e locks explícitos serializam operações concorrentes sobre profissionais e postos.
