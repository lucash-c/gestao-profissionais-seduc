#!/bin/sh
set -eu

if [ "${ALLOW_DATABASE_RESTORE:-}" != 'true' ]; then
  echo 'Restauração bloqueada. Defina ALLOW_DATABASE_RESTORE=true explicitamente.' >&2
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo 'DATABASE_URL é obrigatória.' >&2
  exit 3
fi

if [ -z "${BACKUP_FILE:-}" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo 'BACKUP_FILE deve apontar para um arquivo existente.' >&2
  exit 4
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo 'pg_restore não foi encontrado no PATH.' >&2
  exit 5
fi

postgres_client_url() {
  case "$1" in
    *'?'*)
      base_url=${1%%\?*}
      remaining_query=${1#*\?}
      kept_query=''
      while [ -n "$remaining_query" ]; do
        case "$remaining_query" in
          *'&'*) parameter=${remaining_query%%&*}; remaining_query=${remaining_query#*&} ;;
          *) parameter=$remaining_query; remaining_query='' ;;
        esac
        key=${parameter%%=*}
        case "$key" in
          schema|connection_limit|pool_timeout) ;;
          *)
            if [ -n "$kept_query" ]; then
              kept_query="$kept_query&$parameter"
            else
              kept_query=$parameter
            fi
            ;;
        esac
      done
      if [ -n "$kept_query" ]; then
        printf '%s?%s' "$base_url" "$kept_query"
      else
        printf '%s' "$base_url"
      fi
      ;;
    *) printf '%s' "$1" ;;
  esac
}

pg_database_url=$(postgres_client_url "$DATABASE_URL")

pg_restore \
  --dbname="$pg_database_url" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  --single-transaction \
  "$BACKUP_FILE"

echo 'Restauração concluída e transação confirmada.'
