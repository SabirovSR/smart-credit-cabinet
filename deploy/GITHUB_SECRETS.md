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

Workflow доставляет `compose.yaml`, `deploy.sh`, `deploy/Caddyfile` и `deploy/proxy.yaml`. `deploy.sh` проверяет конфигурацию Caddy, сериализует выкладки через flock, делает pg_dump, выполняет миграции и ожидает readiness приложения. Затем запускает/обновляет отдельный Compose-проект `smart-credit-proxy` и перезагружает конфигурацию Caddy. Имена volumes прокси сохраняются, чтобы не терять сертификаты.

Адрес HTTPS-проверки и домен Caddy берутся из серверного `APP_ORIGIN` (HTTPS, без завершающего `/`); upstream использует `APP_PORT`, по умолчанию 3000. Для `BIND_ADDRESS` сохраните `127.0.0.1`. Caddy получает сертификат асинхронно, поэтому проверка повторяет безопасный GET в том числе при TLS-ошибке curl 35 (`--retry-all-errors`, общий бюджет повторов 180 секунд, отдельный запрос до 10 секунд). Проверка сертификата включена; HTTP или `--insecure` для обхода ошибки не используются.

При ошибке миграций или readiness возвращается предыдущий app image, если он зафиксирован. После readiness файл `current-image-tag` хранит последний здоровый образ приложения. Ошибка прокси/TLS оставляет его запущенным, но весь deploy job завершается ошибкой и выводит логи app/init/db/Caddy. Для разрушительных миграций требуется отдельная стратегия; автоматическое восстановление БД не выполняется.

Если TLS остаётся недоступен, на VPS проверить:

```sh
cd /opt/smart-credit-cabinet
docker compose --env-file .env -f deploy/proxy.yaml logs --tail=150 caddy
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"
curl -Iv --connect-timeout 5 --max-time 10 https://smart-credit-cabinet.sabirov.tech/api/health/ready
```

Записи DNS A и AAAA должны вести на этот VPS, а входящие TCP 80 и 443 быть доступны из интернета в firewall Selectel и на хосте. В логах Caddy искать конкретную ошибку ACME: challenge, DNS, лимит выпуска или недоступность CA. Не удалять `caddy_data` и не повторять выпуск сертификатов вслепую. Исправление скрипта не заменяет исправление DNS/firewall, если проблема находится там.

`npm run test:deploy` проверяет пять ветвей скрипта с изолированными заглушками Docker/curl: успешный запуск, ошибку init, ошибку приложения, ошибку прокси и TLS. Эти проверки включены в quality; они не подтверждают выпуск настоящего сертификата.

Рекомендуемые обязательные проверки main: quality, docker-e2e. Возможность ruleset зависит от тарифа GitHub; её фактическое включение отражается в verification.
