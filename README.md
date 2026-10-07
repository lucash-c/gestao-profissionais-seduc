# SEDUC Americana - Remoção, Permuta e Listão

Sistema administrativo da Secretaria Municipal de Educação de Americana/SP.

## Estado atual

O projeto contém as etapas aprovadas até o momento:

- **Etapa 0 — Fundação técnica:** monorepo pnpm, Express, Vue 3, Quasar, Prisma, Docker Compose e verificações de qualidade;
- **Etapa 1 — Banco base:** estrutura relacional, históricos, constraints e migrations PostgreSQL;
- **Etapa 2 — Autenticação e RBAC:** login administrativo, sessões HttpOnly, autorização por perfil e escopo de unidade;
- **Etapa 3 — Cadastros:** unidades, profissionais, usuários, telefones e pontuação oficial;
- **Etapa 4 — Quadro e postos:** necessidades configuráveis, materialização de postos e manutenção histórica transacional.
- **Etapa 5 — Lotação, exercício e afastamentos:** lotação de sede, exercício temporário, afastamentos, disponibilidade calculada COM SEDE e SEM SEDE, substituições em cadeia, históricos e regras transacionais e de concorrência.
- **Etapa 6 — Eventos e preparação da fila:** eventos em RASCUNHO, cargo da sessão, elegibilidade, seleção, prévia oficial, snapshots, tratamento de empates, congelamento da fila e transição para ATIVO.
- **Etapa 7 — Central Operacional de Remoção/Listão:** atendimento da fila congelada, consulta e simulação de vagas, escolha transacional, movimentações, encerramento controlado, histórico e telão público sanitizado.
- **Etapa 8 — Permuta:** seleção bilateral na fila congelada, simulação antes/depois, troca atômica de sedes oficiais, histórico único com dois itens e proteção transacional contra concorrência e estado obsoleto.
- **Etapa 9 — Auditoria e Correção Administrativa:** histórico técnico transacional das alterações normais, consulta paginada exclusiva do Administrador e módulo excepcional isolado de correção cadastral com confirmação antes/depois.

Ainda não estão implementados ausência e desistência em eventos, salto de participante e os demais fluxos previstos para etapas futuras.

## Requisitos

- Node.js 24 ou superior;
- pnpm 11 ou superior;
- Docker com o plugin Docker Compose, para o ambiente integrado.

## Configuração

Copie `.env.example` para `.env` e substitua as senhas de demonstração antes de usar o ambiente.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

As credenciais e segredos do exemplo são apenas placeholders locais e não devem ser usados em produção. Configure `SESSION_SECRET` com um valor aleatório de pelo menos 32 caracteres e ajuste `SESSION_TTL_HOURS` conforme a política do ambiente.

## Primeiro acesso em instalação nova

Quando a API inicia com a tabela `usuario` completamente vazia, ela cria automaticamente a conta administrativa inicial:

- **Usuário:** `seduc`
- **Senha:** `12345678`

> Esta é a conta administrativa inicial do sistema. Após criar um administrador definitivo, desative ou remova o usuário SEDUC.

A senha é armazenada exclusivamente como hash bcrypt. Se já existir qualquer usuário, ativo ou inativo, nenhuma conta automática será criada. Duas instâncias iniciando simultaneamente são serializadas no PostgreSQL para que exista somente um administrador inicial.

## Autenticação administrativa

O login aceita exclusivamente `usuario.login` ou `usuario.email`. A sessão fica em cookie HttpOnly; profissionais não são usuários da aplicação e não autenticam por CPF ou matrícula.

O bootstrap manual parametrizado continua disponível para operações administrativas controladas. Informe explicitamente `DATABASE_URL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_LOGIN`, `BOOTSTRAP_ADMIN_PASSWORD` e, opcionalmente, `BOOTSTRAP_ADMIN_EMAIL`. Depois execute:

```bash
pnpm --filter @seduc/api auth:bootstrap-admin
```

Não existem outras credenciais padrão além da conta inicial SEDUC descrita acima. O bootstrap manual não possui credenciais predefinidas.

### Proxy reverso e HTTPS

`TRUST_PROXY_HOPS` informa quantos proxies conhecidos existem entre o navegador e a API. O padrão `0` não confia em `X-Forwarded-For`, adequado à execução direta. Use `1` somente quando houver exatamente um proxy confiável antes da API, como na topologia do Compose; não use um valor maior que o número real de proxies. Com valor maior que zero, a API não deve ficar acessível publicamente por um caminho que contorne o proxy.

Em `NODE_ENV=production`, o cookie é sempre `Secure`. Portanto, a conexão do navegador até a entrada pública do sistema deve usar HTTPS. É aceitável haver HTTP entre o proxy reverso e o container da API quando o TLS termina no Traefik, Coolify ou proxy equivalente.

## Execução local

Instale as dependências e gere o Prisma Client:

```bash
pnpm install
pnpm db:generate
```

Com um PostgreSQL acessível pela `DATABASE_URL` do `.env`, inicie API e frontend:

```bash
pnpm dev
```

Serviços padrão:

- frontend: <http://localhost:9000>
- API: <http://localhost:3000>
- liveness: <http://localhost:3000/health/live>
- readiness com PostgreSQL: <http://localhost:3000/health/ready>

## Docker Compose

> **Pendência de validação:** O `docker compose config` e a subida completa dos containers ainda não foram validados porque o cliente Docker não está disponível no ambiente Windows atual.

Suba o ambiente integrado:

```bash
docker compose up --build
```

Confira a configuração resolvida antes de subir:

```bash
docker compose config
```

O PostgreSQL possui healthcheck com `pg_isready`. A API só é considerada pronta quando consegue executar `SELECT 1`; o frontend aguarda a prontidão da API.

Para encerrar sem remover o volume do banco:

```bash
docker compose down
```

Remova o volume apenas quando a perda dos dados locais for intencional:

```bash
docker compose down --volumes
```

## Qualidade

Execute toda a verificação do projeto:

```bash
pnpm verify
```

Ou execute separadamente:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
```

O teste de integração contra PostgreSQL real utiliza `DATABASE_TEST_URL`:

Com o ambiente Docker ativo, ele pode ser executado dentro da API:

```bash
docker compose exec api pnpm --filter @seduc/api test:integration
```

PowerShell:

```powershell
$env:DATABASE_TEST_URL = 'postgresql://seduc:senha@localhost:5432/seduc_test?schema=public'
pnpm test:integration
```

Bash:

```bash
DATABASE_TEST_URL='postgresql://seduc:senha@localhost:5432/seduc_test?schema=public' pnpm test:integration
```

Sem `DATABASE_TEST_URL`, esse teste é marcado como ignorado; os testes unitários dos estados saudável e indisponível continuam obrigatórios.

O GitHub Actions executa as migrations e os testes de integração em PostgreSQL 17 descartável.

## Healthchecks

- `GET /health/live`: confirma que o processo da API está ativo; não consulta o banco.
- `GET /health/ready`: executa uma consulta mínima no PostgreSQL. Retorna `200` quando pronto e `503` quando o banco não está acessível.

Nenhum erro do banco ou credencial é devolvido na resposta HTTP.

## Estrutura

```text
apps/api                 API Express e testes HTTP
apps/web                 Vue 3, Quasar e testes de componentes
packages/contracts       Contratos TypeScript compartilhados
packages/database        Prisma, adapter PostgreSQL e conexão
docker                   Dockerfiles e configuração Nginx
compose.yaml             Ambiente integrado local
```

As regras posteriores de movimentação e disponibilidade serão criadas somente após autorização explícita.
