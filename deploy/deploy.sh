#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR=${DEPLOY_APP_DIR:-/opt/smart-credit-cabinet}
cd "$APP_DIR"
: "${IMAGE_TAG:?IMAGE_TAG required}"
: "${IMAGE_BASE:?IMAGE_BASE required}"
[[ "$IMAGE_TAG" =~ ^sha-[a-f0-9]{40}$ ]] || { echo "Invalid image tag"; exit 1; }
exec 9>deploy.lock
flock -w 300 9
export IMAGE_TAG IMAGE_BASE
previous=$(cat current-image-tag 2>/dev/null || true)
app_ready=false
# Read Compose interpolation, including the server's .env, without sourcing shell code.
origin=$(docker compose config --environment | sed -n 's/^APP_ORIGIN=//p')
[[ "$origin" =~ ^https://[a-zA-Z0-9.-]+$ ]] || { echo "APP_ORIGIN must be an HTTPS origin without a trailing slash"; exit 1; }
export APP_DOMAIN=${origin#https://}
proxy() {
  docker compose --env-file "$APP_DIR/.env" -f "$APP_DIR/deploy/proxy.yaml" "$@"
}
test -f deploy/Caddyfile && test -f deploy/proxy.yaml
proxy run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
mkdir -p backups
chmod 700 backups
if docker compose ps --status running --services | grep -qx db; then
  docker compose exec -T db pg_dump -U credit -d credit -Fc > "backups/credit-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi
docker compose pull app init
rollback() {
  local status=$?
  trap - ERR
  echo "Deployment failed (exit $status); inspect migrations before restoring a database backup."
  docker compose logs --tail=80 app init db || true
  proxy logs --tail=120 caddy || true
  if [[ "$app_ready" == false && "$previous" =~ ^sha-[a-f0-9]{40}$ ]]; then
    IMAGE_TAG="$previous" docker compose up -d --no-deps --wait --wait-timeout 120 app || true
  elif [[ "$app_ready" == true ]]; then
    echo "Application is healthy; retained $IMAGE_TAG. Check Caddy certificate issuance, DNS A/AAAA and inbound ports 80/443."
  fi
  exit "$status"
}
trap rollback ERR
docker compose up -d db
docker compose run --rm init
docker compose up -d --no-deps --wait --wait-timeout 120 app
app_ready=true
# Track the last healthy app independently of public proxy/certificate availability.
printf '%s\n' "$IMAGE_TAG" > current-image-tag
proxy up -d caddy
proxy exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
# Caddy obtains certificates asynchronously. Plain --retry does not retry curl 35.
# GET is safe to repeat; certificate validation remains enabled.
curl --fail --silent --show-error --output /dev/null \
  --connect-timeout 5 --max-time 10 \
  --retry 18 --retry-delay 5 --retry-max-time 180 --retry-all-errors \
  "$origin/api/health/ready"
echo "Deployed $IMAGE_TAG"
