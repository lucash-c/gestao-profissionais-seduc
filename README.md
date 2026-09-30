# SEDUC Americana - Remoção, Permuta e Listão

Fundação técnica do sistema administrativo da Secretaria Municipal de Educação de Americana/SP.

## Estado atual

Este repositório contém **somente a Etapa 0**:

- monorepo Node.js com pnpm;
- API Express + TypeScript;
- frontend Vue 3 + Quasar + TypeScript;
- Prisma configurado para PostgreSQL, sem tabelas de domínio;
- Docker Compose para PostgreSQL, API e frontend;
- Vitest, Supertest e Vue Test Utils;
- lint, formatação, typecheck, builds e healthchecks.

Ainda não existem autenticação, RBAC, cadastros, eventos, postos, vagas ou movimentações.

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

As credenciais do exemplo são apenas locais e não devem ser usadas em produção.

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

Execute toda a verificação da Etapa 0:

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

Os módulos de domínio serão criados somente nas etapas seguintes e após autorização explícita.
