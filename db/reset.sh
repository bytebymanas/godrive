#!/usr/bin/env bash
set -euo pipefail
DB_NAME="${DB_NAME:-rental_db}"
PSQL="${PSQL:-psql}"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;"
"$PSQL" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME;"
for file in 01_schema.sql 02_logic.sql 03_reports.sql 04_security.sql 05_seed.sql; do "$PSQL" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/$file"; done
