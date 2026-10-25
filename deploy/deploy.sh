#!/usr/bin/env bash
set -euo pipefail
APP_DIR=/opt/smart-credit-cabinet
cd "$APP_DIR"
: "${IMAGE_TAG:?IMAGE_TAG required}"
: "${IMAGE_BASE:?IMAGE_BASE required}"
[[ "$IMAGE_TAG" =~ ^sha-[a-f0-9]{40}$ ]] || { echo "Invalid image tag"; exit 1; }
exec 9>deploy.lock
flock -w 300 9
export IMAGE_TAG IMAGE_BASE
previous=$(cat current-image-tag 2>/dev/null || true)
mkdir -p backups
chmod 700 backups
if docker compose ps --status running --services | grep -qx db; then
  docker compose exec -T db pg_dump -U credit -d credit -Fc > "backups/credit-$(date -u +%Y%m%dT%H%M%SZ).dump"
fi
docker compose pull app init
rollback() {
  echo "Deployment failed; inspect migrations before restoring a database backup."
  docker compose logs --tail=80 app init
  if [[ "$previous" =~ ^sha-[a-f0-9]{40}$ ]]; then
    IMAGE_TAG="$previous" docker compose up -d --no-deps --wait --wait-timeout 120 app
  fi
}
trap rollback ERR
docker compose up -d db
docker compose run --rm init
docker compose up -d --no-deps --wait --wait-timeout 120 app
curl --fail --silent --show-error --retry 5 --retry-delay 3 https://smart-credit-cabinet.sabirov.tech/api/health/ready
printf '%s\n' "$IMAGE_TAG" > current-image-tag
echo "Deployed $IMAGE_TAG"
