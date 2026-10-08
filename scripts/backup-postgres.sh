#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo 'DATABASE_URL é obrigatória.' >&2
  exit 2
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo 'pg_dump não foi encontrado no PATH.' >&2
  exit 3
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

backup_directory="${BACKUP_DIRECTORY:-./backups}"
mkdir -p -- "$backup_directory"
umask 077

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_file="${BACKUP_FILE:-$backup_directory/seduc-$timestamp.backup}"

if [ -e "$backup_file" ]; then
  echo "O backup de destino já existe; nada foi sobrescrito: $backup_file" >&2
  exit 4
fi

cleanup_partial() {
  if [ -f "$backup_file" ]; then
    rm -f -- "$backup_file"
  fi
}
trap cleanup_partial EXIT

pg_dump \
  --dbname="$pg_database_url" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$backup_file"

if [ ! -s "$backup_file" ]; then
  echo 'O arquivo de backup ficou vazio.' >&2
  exit 5
fi

trap - EXIT
printf '%s\n' "$backup_file"
