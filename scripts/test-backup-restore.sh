#!/usr/bin/env bash
set -Eeuo pipefail

# Evita que o Git Bash no Windows converta caminhos internos do container.
export MSYS_NO_PATHCONV=1

container_id="${POSTGRES_TOOLS_CONTAINER:-}"
postgres_user="${POSTGRES_USER:-seduc}"
postgres_password="${POSTGRES_PASSWORD:-}"
source_database="${SOURCE_DATABASE:-seduc_test}"
restore_database="${RESTORE_DATABASE:-seduc_restore_test}"
backup_file="/tmp/seduc-backup-restore-test.backup"
backup_script="/tmp/seduc-backup-postgres.sh"
restore_script="/tmp/seduc-restore-postgres.sh"
script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

if [[ -z "$container_id" ]]; then
  echo 'POSTGRES_TOOLS_CONTAINER é obrigatório para usar o cliente PostgreSQL 17 isolado.' >&2
  exit 2
fi
if [[ "${DATABASE_TEST_ALLOW_RESET:-}" != 'true' ]]; then
  echo 'DATABASE_TEST_ALLOW_RESET=true é obrigatório para o banco descartável.' >&2
  exit 3
fi
if [[ -z "$postgres_password" ]]; then
  echo 'POSTGRES_PASSWORD é obrigatória apenas para o ensaio descartável.' >&2
  exit 4
fi
if [[ "$source_database" == "$restore_database" || ! "$restore_database" =~ (test|restore) ]]; then
  echo 'RESTORE_DATABASE deve ser um banco descartável diferente e nomeado como test/restore.' >&2
  exit 5
fi

source_url="postgresql://${postgres_user}:${postgres_password}@127.0.0.1:5432/${source_database}?schema=public"
restore_url="postgresql://${postgres_user}:${postgres_password}@127.0.0.1:5432/${restore_database}?schema=public"

pg_exec() {
  docker exec "$container_id" "$@"
}

cleanup() {
  pg_exec dropdb --if-exists --force --username "$postgres_user" "$restore_database" >/dev/null 2>&1 || true
  pg_exec rm -f "$backup_file" "$backup_script" "$restore_script" >/dev/null 2>&1 || true
  pg_exec psql --username "$postgres_user" --dbname "$source_database" --command 'DROP TABLE IF EXISTS backup_restore_probe' >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker exec -i "$container_id" sh -c "cat > '$backup_script'" < "$script_directory/backup-postgres.sh"
docker exec -i "$container_id" sh -c "cat > '$restore_script'" < "$script_directory/restore-postgres.sh"
pg_exec psql --username "$postgres_user" --dbname "$source_database" --set ON_ERROR_STOP=1 --command \
  "CREATE TABLE backup_restore_probe (id integer PRIMARY KEY, valor text NOT NULL); INSERT INTO backup_restore_probe VALUES (1, 'etapa-11');"
pg_exec env DATABASE_URL="$source_url" BACKUP_FILE="$backup_file" sh "$backup_script"
pg_exec dropdb --if-exists --force --username "$postgres_user" "$restore_database"
pg_exec createdb --username "$postgres_user" "$restore_database"
pg_exec env DATABASE_URL="$restore_url" BACKUP_FILE="$backup_file" ALLOW_DATABASE_RESTORE=true sh "$restore_script"

probe="$(pg_exec psql --username "$postgres_user" --dbname "$restore_database" --tuples-only --no-align --command "SELECT valor FROM backup_restore_probe WHERE id = 1")"
migration_count="$(pg_exec psql --username "$postgres_user" --dbname "$restore_database" --tuples-only --no-align --command 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')"

if [[ "$probe" != 'etapa-11' || ! "$migration_count" =~ ^[1-9][0-9]*$ ]]; then
  echo 'A restauração não preservou o registro de prova ou o histórico de migrations.' >&2
  exit 6
fi

echo "Backup custom restaurado com sucesso; migrations validadas: $migration_count."
