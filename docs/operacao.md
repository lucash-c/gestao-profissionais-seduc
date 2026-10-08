# Operação do sistema

## Papéis

- **Administrador:** cadastros globais, pontuação, usuários, quadro/postos e consulta de auditoria.
- **Operador:** cria, prepara, inicia, opera e encerra Remoção, Listão e Permuta.
- **Diretor:** atualiza a própria unidade e profissionais pertencentes às suas unidades.
- **Secretário:** atualiza a própria unidade e profissionais pertencentes à sua unidade.

Diretor/Secretário não alteram lotação, exercício, vagas, postos ou movimentações de evento pelos
cadastros. Sede e exercício são históricos alterados nos fluxos próprios.

## Preparação e início

1. o Operador cria o evento em `RASCUNHO` com cargo e ano;
2. abre a preparação; todos os profissionais do cargo permanecem visíveis;
3. seletores alteram checkboxes, não filtram linhas;
4. inelegíveis para Remoção/Permuta continuam visíveis e bloqueados;
5. salva a preparação e confere a prévia persistida;
6. alterações locais não salvas bloqueiam “Iniciar evento”;
7. ao iniciar, o servidor cria snapshots, ranking/empates e congela a fila.

Não edite pontuação, data ou filhos esperando mudar evento já iniciado: os snapshots oficiais não
são recalculados.

## Remoção e Listão

O painel destaca participante atual, próximos, regra de período, vagas e últimas movimentações.
A simulação e a confirmação usam a mesma regra:

- `FIXED`: destino precisa usar o período obrigatório;
- `ANY`: sem sede e sem exercício pode escolher qualquer período disponível;
- `BLOCKED`: exercícios ativos em períodos divergentes impedem escolha.

A confirmação cria uma movimentação transacional, atualiza sede/exercício conforme o caso e só
avança a fila após commit integral. Concorrência pela mesma vaga resulta em um vencedor e uma
resposta de conflito, nunca ocupação dupla.

## Permuta

O Operador seleciona dois participantes aguardando, confere a prévia “antes/depois” e confirma a
troca atômica. As duas sedes mudam na mesma transação, com uma movimentação e dois itens. Se uma
sede, participante ou evento mudou desde a prévia, a confirmação é recusada.

O evento só pode ser encerrado sem participante `AGUARDANDO`. Evento encerrado fica somente leitura
e não aceita nova operação.

## Auditoria e exclusões administrativas

Alterações realizadas por Diretor ou Secretário registram entidade, ação, usuário, horário e estados
antes/depois na mesma transação. CRUD direto do Administrador não gera `Auditoria` nem
`Movimentacao`; operações reais de eventos preservam seus históricos próprios. A consulta de
auditoria é exclusiva de Administrador e possui filtros/paginação server-side.

Exclusões administrativas exigem a senha atual do Administrador. Registros com histórico protegido
respondem conflito e permanecem íntegros. O módulo de Correção Administrativa não integra a entrega
final e suas rotas e telas não estão disponíveis.

## Recuperação operacional

- `409`: recarregue a tela e refaça prévia/simulação; não repita cegamente;
- `403`: confirme perfil e unidades vinculadas; não altere dados para contornar autorização;
- readiness `503`: suspenda operações e verifique PostgreSQL/volume antes de reiniciar;
- falha após clique: consulte fila/movimentações antes de tentar novamente;
- suspeita de inconsistência: preserve logs, interrompa escrita e acione Administrador/TI;
- recuperação de banco: siga `docs/backup-restauracao.md`.

Ausência, desistência, salto de participante e “manter na mesma sede” não possuem comportamento
funcional definitivo. Não simule esses casos por alterações manuais em banco.
