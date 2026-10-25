# Фактические проверки

Дата: 25.10.2026 (Europe/Moscow). Запись обновляется по фактическим результатам.

## Анимация темы и упрощение README — 25.10.2026

- `npm run build`: успешно после остановки локального standalone-предпросмотра, блокировавшего его папку при первой попытке сборки.
- `playwright test tests/e2e/appearance.spec.ts`: 3/3 успешно на обновлённой standalone-сборке.
- Отдельно проверены промежуточный цвет в процессе перехода, завершение и очистка анимации после быстрых переключений, мгновенная смена при `prefers-reduced-motion: reduce` и отсутствие анимации иконки в этом режиме.
- Все локальные ссылки в README и новой инструкции `docs/development.md` проверены: целевые файлы существуют. Настройки, API, команды тестов и ограничения перенесены из README в инструкцию для разработки.

## Проверка правок деплоя, демосценариев и темы — 25.10.2026

База: commit `2ba7fa1` + текущие незакоммиченные изменения. Среда: Windows, Node 24.14.1, npm 11.21.0. Ниже — результаты этой проверки; остальные разделы сохраняют предыдущую запись.

- `npm run check`: успешно; TypeScript, 25 unit/UI-тестов, кредитное ядро 100% statements/branches/functions/lines, проверены 21 API-операция и Postman. Redocly: 0 ошибок, прежнее предупреждение о localhost server.
- `npm run build`: успешно, Next.js 16.4.3; итоговая standalone-сборка запущена через `node .next/standalone/server.js` с public/static/docs, как в Dockerfile.
- `npm run test:integration`: 19/19 успешно на отдельной локальной PostgreSQL 18, порт 55432, БД `credit_test`. Production PostgreSQL 17 не использовалась и не изменялась.
- `npm run test:e2e`: 9/9 успешно за 9,0 с на итоговой standalone-сборке; Chromium headless shell 156.0.8078.4 (Playwright revision 1248), отдельная БД `credit_ui_test`. Проверены четыре кредитных сценария, изоляция владельцев, инструкции всех четырёх аккаунтов, мобильная валидация, системная/ручная тема, сохранение после reload и работа при заблокированном localStorage. Необработанных ошибок браузера в тесте темы нет.
- `npm run test:deploy`: 5/5 успешно с заглушками Docker/curl. Успех, ошибки init/app с rollback, ошибки proxy/TLS без отката здорового приложения; сохранение кода ошибки, диагностика Caddy, ограниченные повторы HTTPS с проверкой сертификата.
- `docker compose config --quiet`, `docker compose -f deploy/proxy.yaml config --quiet`, `bash -n deploy/deploy.sh`: успешно. Эти команды проверяют синтаксис, не запуск контейнеров.
- Визуально проверены скриншоты светлой/тёмной страницы входа, тёмного обзора и мобильной формы. Скриншоты: игнорируемый `test-results/`, отчёт: `playwright-report/`.

Не проверено в этой сессии: Docker build/Compose smoke, persistence через restart контейнера, GitHub Actions для этих изменений, реальный Caddy/ACME и Selectel. Локальный Docker Engine недоступен. Из этой среды внешний HTTPS-запрос завершился таймаутом; точная причина TLS-сбоя на VPS не установлена. Для неё нужны логи Caddy и проверка DNS/firewall; команды добавлены в `deploy/GITHUB_SECRETS.md`. Изменения в GitHub и production не отправлялись.

## Выполнено успешно

- Windows: Node 24.14.1, npm 11.21.1; PostgreSQL 17 в Docker.
- `npm run typecheck`: strict TypeScript, без ошибок.
- `npm run test:unit`: 21 тест; calculator/decision/state-machine — 100% statements, branches, functions и lines.
- `npm run test:integration`: 17 тестов на отдельной credit_test, включая параллельные операции и rollback.
- `npm run test:e2e` с PLAYWRIGHT_CHANNEL=chrome: 6 тестов, 12.6 секунд после исправления формы.
- `npm run build`: production-сборка выполнена.
- `node scripts/verify-contracts.mjs`: все 21 операции и Postman найдены.
- Redocly с minimal: ошибок нет, предупреждение о намеренном localhost server для локального запуска.
- Два PDF с синтетическим содержимым сгенерированы ReportLab, извлечён текст и визуально проверены через PDFium.
- Проверен SSH под deploy, инвентаризирован старый qrredirect. Изменение доступа root не выполнялось.

## Найдено и исправлено

- E2E обнаружил автоматическую отправку при замене кнопки «Продолжить» на submit в одном React-узле. Кнопки получили разные key.
- Поля формы могли быть перезаписаны поздним ответом загрузки компании. До загрузки показывается состояние ожидания.

## Ещё не подтверждено

- Чистый Compose запуск и тесты на целевом Node 22.23.4.
- Сохранение данных после перезапуска контейнера и проверка readiness при остановке БД.
- GitHub CI на сдаваемом commit; production HTTPS; автоматический деплой.
- Telegram доставка требует данных бота/чата.

Node Docker image: node:22.23.4-bookworm-slim, digest sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d (фактически загружен).
