# Фактические проверки

Дата: 25.10.2026 (Europe/Moscow). Запись обновляется по фактическим результатам.

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
