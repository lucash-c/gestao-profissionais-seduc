# Backup e restauração PostgreSQL

## Política mínima

- use PostgreSQL 17 e formato custom (`pg_dump -Fc`);
- mantenha ao menos uma cópia fora do host da aplicação;
- proteja backups como dado pessoal restrito;
- criptografe armazenamento e transporte;
- defina retenção, responsável, RPO e RTO com a SEDUC;
- teste restauração periodicamente; arquivo criado não prova recuperação.

## Backup

Bash:

```bash
export DATABASE_URL='postgresql://usuario:senha@host:5432/seduc?schema=public'
export BACKUP_DIRECTORY='/var/backups/seduc'
bash scripts/backup-postgres.sh
```

PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://usuario:senha@host:5432/seduc?schema=public'
$env:BACKUP_DIRECTORY = 'D:\Backups\SEDUC'
.\scripts\backup-postgres.ps1
```

O nome padrão contém timestamp UTC. `BACKUP_FILE` permite escolher um caminho exato, mas o script
falha se ele já existir. Arquivo parcial é removido em caso de erro. A URL nunca é impressa.

Valide o arquivo com uma restauração; `pg_restore --list arquivo.backup` é apenas inspeção auxiliar.

## Restauração controlada

Crie um banco vazio separado, confirme que o destino está correto e só então habilite a operação:

```bash
export DATABASE_URL='postgresql://usuario:senha@host:5432/seduc_restore?schema=public'
export BACKUP_FILE='/var/backups/seduc/seduc-AAAAMMDDTHHMMSSZ.backup'
export ALLOW_DATABASE_RESTORE=true
bash scripts/restore-postgres.sh
```

```powershell
$env:DATABASE_URL = 'postgresql://usuario:senha@host:5432/seduc_restore?schema=public'
$env:BACKUP_FILE = 'D:\Backups\SEDUC\seduc-AAAAMMDDTHHMMSSZ.backup'
$env:ALLOW_DATABASE_RESTORE = 'true'
.\scripts\restore-postgres.ps1
```

O restore usa `--clean --if-exists --single-transaction --exit-on-error`: ou confirma o conjunto ou
falha sem deixar parte da restauração confirmada. A flag explícita reduz restauração acidental, mas
não substitui a conferência humana do destino.

## Prova automatizada

`scripts/test-backup-restore.sh` usa o cliente do próprio container PostgreSQL 17 e exige:

- container descartável informado em `POSTGRES_TOOLS_CONTAINER`;
- `DATABASE_TEST_ALLOW_RESET=true`;
- bancos de origem e destino diferentes;
- nome de destino contendo `test` ou `restore`.

O teste cria um registro-prova, executa dump custom, restaura em outro banco, valida o registro e a
tabela `_prisma_migrations`, e remove os artefatos. O CI executa esse processo após migrations e
integrações.

Exemplo com o container local de desenvolvimento:

```bash
POSTGRES_TOOLS_CONTAINER="$(docker compose ps -q db)" \
DATABASE_TEST_ALLOW_RESET=true \
POSTGRES_USER=seduc \
SOURCE_DATABASE=seduc_test \
RESTORE_DATABASE=seduc_restore_test \
bash scripts/test-backup-restore.sh
```

## Validação pós-restauração

1. confira que todas as migrations possuem `finished_at`;
2. execute `pnpm db:validate` contra o código da mesma revisão;
3. valide contagens de usuários, profissionais, postos, históricos, eventos, movimentações e auditoria;
4. inicie a API isolada e confira `/health/ready`;
5. valide login e consultas somente leitura antes de liberar escrita;
6. registre data, arquivo, checksum, responsável e resultado do ensaio.
