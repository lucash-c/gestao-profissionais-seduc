# Etapa 3 — Cadastros

## Escopo implementado

A Etapa 3 disponibiliza os cadastros administrativos de unidades, profissionais e usuários, além da edição controlada da pontuação oficial. Sede e exercício são projetados na ficha do profissional a partir dos históricos ativos de `lotacao_sede` e `exercicio_profissional` e permanecem somente leitura.

Não foram implementados quadro de necessidades, postos/vagas, movimentações, lotação, exercício, afastamentos ou eventos.

## Proteção CSRF por origem

As rotas mutáveis autenticadas de domínio (`POST`, `PUT`, `PATCH` e `DELETE`) exigem que o cabeçalho `Origin`, quando presente, corresponda exatamente a uma das origens configuradas em `CORS_ORIGIN`.

Em produção, `Origin` ausente também é recusado. Em desenvolvimento e teste, a ausência é aceita para clientes não-browser e ferramentas locais; uma origem presente continua sendo validada. Requisições seguras (`GET`, `HEAD` e `OPTIONS`) não são bloqueadas por esse middleware. As propriedades existentes do cookie (`HttpOnly`, `SameSite=Lax` e `Secure` em produção) foram preservadas.

Login e logout mantêm seu fluxo próprio. As rotas de domínio executam autenticação antes da validação de origem.

## Autorização

- `ADMINISTRADOR`: escopo global; cria e altera unidades e profissionais; gerencia usuários; altera pontuação.
- `OPERADOR`: consulta unidades e profissionais; não realiza mutações cadastrais.
- `DIRETOR` e `SECRETARIO`: consultam e alteram sua própria unidade e profissionais cuja unidade administrativa calculada pertence a essa unidade. A unidade autorizada é obtida da sessão carregada do banco.

O backend aplica o escopo nas consultas e mutações. Guards e menus do frontend existem apenas como melhoria de experiência.

## Unidade administrativa calculada do profissional

A unidade administrativa usada no escopo de Diretor e Secretário é calculada sem criar uma segunda fonte de verdade:

1. a unidade da `lotacao_sede` ativa tem prioridade;
2. na ausência de sede ativa, usa-se a unidade do `exercicio_profissional` ativo;
3. sem sede e sem exercício ativos, o profissional não pertence ao escopo de unidade escolar e somente o Administrador pode administrá-lo.

A criação inicial de profissionais permanece global e restrita ao `ADMINISTRADOR`. Diretor e Secretário não criam profissional novo, nem criam automaticamente lotação ou exercício.

## Salvamento de telefones

As telas de Unidade e Profissional enviam a coleção final de telefones junto com o cadastro. O backend sincroniza inclusão, alteração e remoção dos telefones na mesma transação PostgreSQL da alteração principal, impedindo persistência parcial.

## Auditoria futura

A tabela `auditoria` já existe, mas o registro automático das alterações cadastrais permanece reservado à Etapa 9. Nenhuma implementação parcial de auditoria foi antecipada aqui.
