# Gestão de Profissionais — SEDUC Americana

Sistema administrativo para cadastros, quadro de necessidades, lotação, exercício,
afastamentos, Remoção, Listão, Permuta e auditoria da Secretaria
Municipal de Educação de Americana/SP.

## Arquitetura

- monorepo pnpm com Node.js 24;
- API Express 5 com validação Zod e sessão administrativa em cookie HttpOnly;
- frontend Vue 3 + Quasar, com identidade visual inspirada no Windows 11/Fluent;
- PostgreSQL 17, Prisma e migrations SQL versionadas;
- Nginx para servir o frontend e encaminhar `/api` à API;
- Docker Compose separado para desenvolvimento e produção.

As decisões consolidadas de domínio estão em
[`docs/decisoes-de-dominio-v4.md`](docs/decisoes-de-dominio-v4.md). O resultado do aceite
funcional está em [`docs/checklist-aceite-v4.md`](docs/checklist-aceite-v4.md).

## Requisitos

- Node.js 24;
- pnpm 11.19.0;
- PostgreSQL 17;
- Docker com Docker Compose para o ambiente integrado;
- clientes PostgreSQL 17 (`pg_dump`/`pg_restore`) para backup fora do container.

## Configuração

Copie `.env.example` para `.env` e substitua todos os placeholders:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

Variáveis principais:

| Variável            | Finalidade                                                     |
| ------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`      | conexão PostgreSQL da aplicação; nunca registrar ou publicar   |
| `DATABASE_TEST_URL` | banco exclusivamente descartável para integração               |
| `SESSION_SECRET`    | segredo aleatório entre 32 e 256 caracteres                    |
| `SESSION_TTL_HOURS` | validade da sessão, entre 1 e 168 horas                        |
| `CORS_ORIGIN`       | origens exatas permitidas, separadas por vírgula               |
| `TRUST_PROXY_HOPS`  | quantidade exata de proxies confiáveis; padrão `0`             |
| `LOG_LEVEL`         | `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou `silent` |
| `VITE_API_BASE_URL` | base pública da API usada pelo frontend                        |

Os arquivos `.env`, backups, chaves e credenciais são ignorados pelo Git. Não use os valores de
exemplo em produção.

## Primeiro administrador

Em `NODE_ENV=production` não existe conta nem senha automática. Após aplicar as migrations,
execute explicitamente o bootstrap administrativo com credenciais próprias:

```bash
DATABASE_URL='postgresql://...' \
BOOTSTRAP_ADMIN_NAME='Administrador responsável' \
BOOTSTRAP_ADMIN_LOGIN='login.individual' \
BOOTSTRAP_ADMIN_PASSWORD='senha-forte-com-12-ou-mais' \
pnpm --filter @seduc/api auth:bootstrap-admin
```

`BOOTSTRAP_ADMIN_EMAIL` é opcional. A senha não é impressa e é persistida somente como hash
bcrypt. O script é idempotente para a mesma identidade e rejeita conflito de login/e-mail.

Somente em `development` e `test`, quando não existe usuário algum, a conveniência histórica cria
a conta local `seduc` com senha `12345678`. Essa senha não satisfaz a política normal e o código
bloqueia esse bootstrap antes de qualquer acesso ao banco em produção.

## Desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

- frontend: <http://localhost:9000>
- API: <http://localhost:3000>
- liveness: <http://localhost:3000/health/live>
- readiness: <http://localhost:3000/health/ready>

Ambiente integrado de desenvolvimento:

```bash
docker compose config
docker compose up --build
```

`compose.yaml` publica banco, API e Vite somente em `127.0.0.1`. O PostgreSQL possui healthcheck
e a API só fica pronta após `SELECT 1`.

## Produção com Docker

`compose.production.yaml` usa os targets `production`, executa migrations antes da API, não roda
servidor de desenvolvimento e não publica o PostgreSQL. Por segurança, o frontend também escuta
somente em `127.0.0.1` por padrão, atrás do proxy HTTPS da instalação.

```bash
docker compose -f compose.production.yaml config --quiet
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up -d
```

`POSTGRES_PASSWORD`, `SESSION_SECRET` e `CORS_ORIGIN` são obrigatórias. Consulte
[`docs/implantacao.md`](docs/implantacao.md) antes de disponibilizar o serviço.

## Migrations e banco

```bash
pnpm db:generate
pnpm db:validate
pnpm --filter @seduc/database db:migrate:deploy
```

Nunca use `prisma db push` no ambiente oficial. As migrations preservam históricos e constraints
PostgreSQL, inclusive índices únicos parciais e triggers de concorrência.

## Testes e qualidade

```bash
pnpm verify
pnpm db:validate
pnpm test:integration
```

`pnpm verify` executa formatação, lint, typecheck, testes e build. A integração exige
`DATABASE_TEST_URL`; a recriação destrutiva só é aceita para banco local nomeado como teste ou com
`DATABASE_TEST_ALLOW_RESET=true` explicitamente definido. O GitHub Actions usa PostgreSQL 17
descartável e também valida backup/restauração e os dois builds de produção.

## Backup e restauração

Os scripts geram formato custom (`pg_dump -Fc`), não sobrescrevem arquivo existente e não contêm
credenciais:

```bash
DATABASE_URL='postgresql://...' BACKUP_DIRECTORY='./backups' bash scripts/backup-postgres.sh
```

```powershell
$env:DATABASE_URL = 'postgresql://...'
.\scripts\backup-postgres.ps1
```

A restauração é destrutiva no banco de destino e exige `ALLOW_DATABASE_RESTORE=true`. Veja o
procedimento completo e o teste obrigatório em
[`docs/backup-restauracao.md`](docs/backup-restauracao.md).

## Segurança e operação

- autenticação exclusivamente administrativa; não há cadastro público nem login de profissional;
- cookie HttpOnly, SameSite=Lax e Secure em produção; tokens de sessão persistidos somente em hash;
- RBAC e escopo de unidade conferidos no backend;
- mutações autenticadas protegidas por origem e CORS explícito;
- login limitado a cinco falhas por janela de quinze minutos;
- logs omitem headers, payloads, query strings, credenciais e mensagens internas de erro;
- telão e escolhas públicas expõem apenas nomes, posições e dados operacionais sanitizados;
- `/health/live` verifica processo e `/health/ready` verifica PostgreSQL sem revelar infraestrutura.

Para operação de eventos, recuperação, logs e incidentes, consulte
[`docs/operacao.md`](docs/operacao.md) e [`docs/seguranca.md`](docs/seguranca.md).

## Perfis

- `ADMINISTRADOR`: cadastros globais, pontuação, usuários, quadro, auditoria e correção excepcional;
- `OPERADOR`: cria, prepara, inicia, opera e encerra eventos; não altera cadastros protegidos;
- `DIRETOR`: cadastros permitidos e profissionais das suas múltiplas unidades vinculadas;
- `SECRETARIO`: cadastros permitidos e profissionais da sua unidade vinculada.

Ausência, desistência, salto de participante e “manter na mesma sede” permanecem sem regra de
negócio definitiva e não foram inventados nesta entrega.

## Estrutura

```text
apps/api                    API Express e testes HTTP/PostgreSQL
apps/web                    Vue 3, Quasar e testes de componentes
packages/contracts          contratos TypeScript compartilhados
packages/database           Prisma, migrations e testes de constraints
docker                      Dockerfiles, Nginx e inicialização local
scripts                     backup, restauração e prova de restauração
docs                        operação, implantação, segurança e aceite
compose.yaml                ambiente de desenvolvimento
compose.production.yaml     ambiente de produção
```
