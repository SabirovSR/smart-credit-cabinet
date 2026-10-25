# Настройка CI/CD

Репозиторий: SabirovSR/smart-credit-cabinet. Environment: production.

Repository Secrets:

- `SSH_HOST`: адрес VPS.
- `SSH_USER`: deploy.
- `SSH_KEY`: отдельный приватный ed25519 ключ CI; соответствующий public key в authorized_keys deploy.
- `SSH_KNOWN_HOSTS`: заранее проверенная запись host key. Workflow не использует StrictHostKeyChecking=no.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: необязательные уведомления. При отсутствии отправка пропускается.

Repository Variable `DEPLOY_ENABLED=true` включается после подготовки сервера. Для GHCR используется короткоживущий GITHUB_TOKEN текущего job с packages:read; постоянный PAT не нужен. Build job имеет packages:write, проверки — contents:read.

На сервере `/opt/smart-credit-cabinet/.env` содержит случайный POSTGRES_PASSWORD, APP_ORIGIN=https://smart-credit-cabinet.sabirov.tech, COOKIE_SECURE=true, DEMO_MODE=true, IMAGE_BASE=ghcr.io/sabirovsr/smart-credit-cabinet. Файл должен иметь права 600 и не попадать в Git. Приложение слушает только loopback:3000. PostgreSQL наружу не публикуется.

`deploy/proxy.yaml` поднимает отдельный Caddy с host networking на Linux. Он использует Caddyfile и автоматически получает TLS. Перед запуском освободить 80/443 только у идентифицированного старого сервиса; его volumes сохраняются.

`deploy.sh` сериализует выкладки через flock, делает pg_dump, выполняет миграции, ожидает readiness и проверяет внешний HTTPS. При ошибке возвращает предыдущий app image, если он зафиксирован. Для разрушительных миграций требуется отдельная стратегия; автоматическое восстановление БД не выполняется.

Рекомендуемые обязательные проверки main: quality, docker-e2e. Возможность ruleset зависит от тарифа GitHub; её фактическое включение отражается в verification.
