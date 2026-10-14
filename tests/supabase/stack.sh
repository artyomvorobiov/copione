#!/usr/bin/env bash
# Local Supabase-like stack for integration tests: Postgres (Supabase image),
# GoTrue (auth), PostgREST and a tiny gateway on http://127.0.0.1:54321.
# Usage: tests/supabase/stack.sh up|down|schema
set -euo pipefail
cd "$(dirname "$0")"

REGISTRY="${REGISTRY:-mirror.gcr.io}"
PG_IMAGE="$REGISTRY/supabase/postgres:17.6.1.176"
AUTH_IMAGE="$REGISTRY/supabase/gotrue:v2.186.0"
REST_IMAGE="$REGISTRY/postgrest/postgrest:v14.18"
PW=postgres
eval "$(node keys.mjs)"

psql_as() { PGPASSWORD=$PW psql "postgresql://$1@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 -q "${@:2}"; }

case "${1:-up}" in
  up)
    docker rm -f cp-db cp-auth cp-rest >/dev/null 2>&1 || true
    docker run -d --name cp-db --network host -e POSTGRES_PASSWORD=$PW \
      -e JWT_SECRET="$JWT_SECRET" -e JWT_EXP=3600 "$PG_IMAGE" >/dev/null
    for _ in $(seq 1 90); do
      if psql_as supabase_admin -c 'select 1' >/dev/null 2>&1; then break; fi
      sleep 1
    done
    # The image's init finishes in stages; wait until the auth roles exist.
    for _ in $(seq 1 60); do
      if psql_as supabase_admin -tAc "select 1 from pg_roles where rolname='supabase_auth_admin'" 2>/dev/null | grep -q 1; then break; fi
      sleep 1
    done
    sleep 3
    psql_as supabase_admin -c "alter user authenticator with password '$PW'; alter user supabase_auth_admin with password '$PW'; alter user postgres with password '$PW';"
    docker run -d --name cp-auth --network host \
      -e GOTRUE_API_HOST=127.0.0.1 -e GOTRUE_API_PORT=9999 \
      -e API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
      -e GOTRUE_DB_DRIVER=postgres \
      -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:$PW@127.0.0.1:5432/postgres" \
      -e GOTRUE_SITE_URL=http://127.0.0.1:8081 -e GOTRUE_DISABLE_SIGNUP=false \
      -e GOTRUE_JWT_ADMIN_ROLES=service_role -e GOTRUE_JWT_AUD=authenticated \
      -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_EXP=3600 \
      -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
      -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 \
      -e GOTRUE_SMTP_ADMIN_EMAIL=admin@example.com "$AUTH_IMAGE" >/dev/null
    docker run -d --name cp-rest --network host \
      -e PGRST_DB_URI="postgres://authenticator:$PW@127.0.0.1:5432/postgres" \
      -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
      -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_DB_USE_LEGACY_GUCS=false \
      -e PGRST_SERVER_PORT=3000 "$REST_IMAGE" >/dev/null
    for _ in $(seq 1 60); do
      if curl -sf http://127.0.0.1:9999/health >/dev/null 2>&1; then break; fi
      sleep 1
    done
    echo "stack is up"
    ;;
  schema)
    # Apply the app schema as the "postgres" role, like the Dashboard SQL editor does.
    psql_as postgres -f ../../supabase/schema.sql
    # Make PostgREST reload its schema cache.
    psql_as postgres -c "notify pgrst, 'reload schema';"
    echo "schema applied"
    ;;
  down)
    docker rm -f cp-db cp-auth cp-rest >/dev/null 2>&1 || true
    echo "stack is down"
    ;;
esac
