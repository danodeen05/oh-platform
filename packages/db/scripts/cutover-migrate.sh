#!/usr/bin/env bash
# Task G3 cutover: applies the release-2 migrations by hand with psql.
#
# Prod has no _prisma_migrations table, so Prisma cannot tell what is applied.
# Instead every migration here has a PROBE: the number of the columns it adds
# that already exist. All present = applied (skipped), none = pending,
# anything else = partial (abort, a human looks). Each pending migration runs
# in ONE transaction with ON_ERROR_STOP, and is probed again afterwards.
#
#   --dry-run   BEGIN; <migration>; ROLLBACK for each pending one: proves it
#               applies cleanly and leaves nothing behind.
#
# It refuses to start when:
#   - DATABASE_URL is not 127.0.0.1/localhost and ALLOW_NON_LOCAL is not 1;
#   - the release-1 baseline (20260928000000_site_overhaul) is missing;
#   - a migration folder newer than the baseline has no probe below (add one).
#
# Usage (from the repo root or anywhere):
#   DATABASE_URL=... packages/db/scripts/cutover-migrate.sh --dry-run
#   DATABASE_URL=... packages/db/scripts/cutover-migrate.sh
# All three migrations are additive (nullable columns only).
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../prisma/migrations" && pwd)"
BASELINE="20260928000000_site_overhaul"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[cutover-migrate] DATABASE_URL is not set" >&2
  exit 2
fi
# psql rejects Prisma's ?schema=... parameter; strip the query string.
PSQL_URL="${DATABASE_URL%%\?*}"
HOSTPART="${PSQL_URL#*://}"
HOSTPART="${HOSTPART##*@}"
HOST="${HOSTPART%%[:/]*}"
DB="${HOSTPART##*/}"
if [[ "$HOST" != "127.0.0.1" && "$HOST" != "localhost" && "${ALLOW_NON_LOCAL:-}" != "1" ]]; then
  echo "[cutover-migrate] DATABASE_URL points at $HOST/$DB, which is not local. Set ALLOW_NON_LOCAL=1 to run against it on purpose." >&2
  exit 2
fi
if [[ "$HOST" == "127.0.0.1" || "$HOST" == "localhost" ]]; then WHERE=LOCAL; else WHERE=REMOTE; fi
if [[ $DRY_RUN -eq 1 ]]; then MODE="(dry run, every migration rolled back)"; else MODE="(WRITING)"; fi
echo "[cutover-migrate] target $WHERE $HOST/$DB $MODE"

q() { psql "$PSQL_URL" -X -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }

# Columns each migration adds, as "Table.column" (space separated).
probe_columns() {
  case "$1" in
    20260929000000_comb_seats) echo "Seat.bestRank" ;;
    20260930000000_support_resolution) echo "SupportCase.resolutionNote SupportCase.resolutionDetail" ;;
    20261001000000_chappy_cart) echo "ChappyConversation.cart" ;;
    *) return 1 ;;
  esac
}

# Prints how many of the given Table.column pairs exist in the current schema.
present_count() {
  local n=0 tc
  for tc in "$@"; do
    local exists
    exists=$(q "SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = '${tc%%.*}' AND column_name = '${tc#*.}'")
    n=$((n + exists))
  done
  echo "$n"
}

# Baseline: release 1's migration must already be in (CreditLot is one of its tables).
if [[ "$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'CreditLot'")" != "1" ]]; then
  echo "[cutover-migrate] baseline $BASELINE is not applied (no CreditLot table). Stop: apply release 1 first." >&2
  exit 3
fi

PENDING=()
for dir in "$MIGRATIONS_DIR"/*/; do
  name="$(basename "$dir")"
  [[ "$name" > "$BASELINE" ]] || continue
  if ! cols="$(probe_columns "$name")"; then
    echo "[cutover-migrate] $name has no probe in this script. Stop: add one before running." >&2
    exit 3
  fi
  # shellcheck disable=SC2086
  have=$(present_count $cols)
  want=$(wc -w <<<"$cols")
  if [[ "$have" -eq "$want" ]]; then
    echo "[cutover-migrate] $name: already applied, skip"
  elif [[ "$have" -eq 0 ]]; then
    echo "[cutover-migrate] $name: pending"
    PENDING+=("$name")
  else
    echo "[cutover-migrate] $name: PARTIAL ($have of $want columns). Stop: inspect by hand." >&2
    exit 4
  fi
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "[cutover-migrate] nothing to apply"
  exit 0
fi

for name in "${PENDING[@]}"; do
  file="$MIGRATIONS_DIR/$name/migration.sql"
  cols="$(probe_columns "$name")"
  want=$(wc -w <<<"$cols")
  if [[ $DRY_RUN -eq 1 ]]; then
    psql "$PSQL_URL" -X -q -v ON_ERROR_STOP=1 -c "BEGIN" -f "$file" -c "ROLLBACK" >/dev/null
    # shellcheck disable=SC2086
    [[ "$(present_count $cols)" -eq 0 ]] || { echo "[cutover-migrate] $name: dry run left columns behind" >&2; exit 5; }
    echo "[cutover-migrate] $name: applies cleanly (rolled back)"
  else
    psql "$PSQL_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$file" >/dev/null
    # shellcheck disable=SC2086
    [[ "$(present_count $cols)" -eq "$want" ]] || { echo "[cutover-migrate] $name: applied but the probe disagrees" >&2; exit 5; }
    echo "[cutover-migrate] $name: APPLIED"
  fi
done
