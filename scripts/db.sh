#!/usr/bin/env bash
# Migrador mínimo basado en psql (sin dependencias de npm/pip).
# Uso: scripts/db.sh [migrate|seed|reset|test]
# Variables: DATABASE_URL (por defecto postgres://nexo:nexo@localhost:5432/nexo)
set -euo pipefail
cd "$(dirname "$0")/.."
DB_URL="${DATABASE_URL:-postgres://nexo:nexo@localhost:5432/nexo}"
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

migrate() {
  "${PSQL[@]}" -c "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"
  for f in db/migrations/*.sql; do
    n=$(basename "$f")
    done_=$("${PSQL[@]}" -tAc "select 1 from schema_migrations where name='$n'")
    if [ -z "$done_" ]; then
      echo "→ aplicando $n"
      "${PSQL[@]}" --single-transaction -f "$f"
      "${PSQL[@]}" -c "insert into schema_migrations(name) values ('$n')"
    fi
  done
}
seed() { for f in db/seed/*.sql; do echo "→ seed $(basename "$f")"; "${PSQL[@]}" --single-transaction -f "$f"; done; }
reset() {
  "${PSQL[@]}" -c "drop schema public cascade; create schema public;"
  migrate
}
test_() {
  # Cada test corre sobre una base limpia y debe terminar sin error.
  reset
  seed
  for f in db/tests/*.sql; do echo "→ test $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
  echo "✔ todos los tests pasaron"
}
case "${1:-migrate}" in
  migrate) migrate ;;
  seed) seed ;;
  reset) reset ;;
  test) test_ ;;
  *) echo "uso: $0 [migrate|seed|reset|test]"; exit 1 ;;
esac
