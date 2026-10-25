# Техническая спецификация реализации

Проект: «Умный кредитный кабинет предпринимателя». Версия: 1.0. Дата: 24.10.2026.

## 0 Назначение документа и задание на реализацию

Этот файл можно целиком приложить к промпту coding-агенту. Он задает целевую реализацию, а не описывает уже существующий код.

**Задание:** реализуй работоспособное веб-приложение по этой спецификации. Пользовательский интерфейс состоит только из ЛК клиента. Выполни путь от черновика до результата автоматической обработки и принятия предложения. Реализуй сервер, PostgreSQL, хранение файлов, тесты, Docker и CI. Не подменяй серверные операции изменениями состояния только в браузере. Документируй допущения и фактические проверки. Не создавай commit, push, облачные ресурсы и deployment без отдельного указания пользователя.

Порядок реализации: сначала минимальный запуск и миграции; затем контракты и кредитные правила; затем API с интеграционными тестами; затем клиентский путь; затем E2E, CI и документация. Заверши работу проверкой с чистой БД. Не оставляй заглушки обработчиков, `TODO`, фиктивные успешные тесты или пустые страницы вместо обязательных функций.

[Проектная документация](01_PROJECT_DOCUMENTATION.md) описывает продукт для проверяющих. При расхождении сначала согласуй реализацию с точными контрактами настоящей спецификации и обнови проектное описание. Не расширяй объем продукта молча.

## 1 Обязательная граница MVP

- Единственная пользовательская категория — клиент, представитель привязанной к аккаунту компании.
- Нет кабинета банка, администратора, ручного рассмотрения и интерфейса настройки решений.
- Один продукт `WORKING_CAPITAL`, RUB, 500 000–5 000 000 руб., целые сроки 6–24 месяца, фиксированная годовая ставка 2000 базисных пунктов, то есть 20%.
- Синтетические компании и учетные записи. Реальные внешние проверки заменены локальными адаптерами.
- Все действия клиента внутри приложения. Не требуются SMS, email и мессенджеры.
- Нет LLM, OCR, ML, электронного подписания, реального перечисления денег и платных API.
- Предложение может быть на полную или уменьшенную сумму. Уточнение — только внутри ЛК.
- Конечное положительное состояние — `ACCEPTED`, означающее принятие синтетических условий, а не выдачу денег.
- Информационная лента меняется по контексту компании и последней заявки.
- Один экземпляр приложения, PostgreSQL и локальное файловое хранилище в Docker volume.

## 2 Стек и воспроизводимость

| Компонент | Выбор |
|---|---|
| Runtime | Node.js 22.22.0; `.nvmrc`, Docker и CI согласованы |
| Пакетный менеджер | npm из выбранного Node-образа; точный номер записать в `packageManager` |
| Framework | Next.js 16 App Router; React 19 |
| Язык | TypeScript 5.9, `strict: true`, без ослабления типов ради сборки |
| Формы | React Hook Form 7, `@hookform/resolvers`, Zod 4 |
| UI | Tailwind CSS 4, shadcn/ui; исходники используемых компонентов в репозитории |
| ORM | Prisma ORM 7, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv` |
| Финансовые расчеты | `decimal.js`; округление определено ниже |
| Пароли и токены | Встроенный `node:crypto`; scrypt, randomBytes, SHA-256 |
| Unit и integration | Vitest, V8 coverage |
| UI-тесты | Testing Library и jsdom |
| E2E | Playwright, браузер Chromium |
| API | JSON REST, OpenAPI 3.1, локальный Swagger UI |
| Контрактный lint | `@redocly/cli`, конфигурация `minimal` |
| Контейнеризация | Dockerfile, Docker Compose v2, PostgreSQL 17 |
| CI | GitHub Actions, Ubuntu 24.04 |

Точные patch-версии npm-зависимостей выбираются и проверяются при создании проекта внутри указанных линий. Сохранить зависимости без диапазонов версий через `.npmrc` с `save-exact=true`; обязательно включить `package-lock.json` и использовать `npm ci`. Не генерировать lock-файл вручную и не использовать Prisma 8 RC.

Вариант Node 22.22.0 выбран для определенности конфигураций; перед публичным размещением проверить обновления безопасности. Если его заменяют, одновременно менять `.nvmrc`, Dockerfile и CI и повторять проверки. Образ PostgreSQL `17-bookworm` фиксирует поддерживаемую линию, но является изменяемым тегом; на сдаваемом commit записать фактические digest образов в `docs/verification.md`. Не утверждать побитовую воспроизводимость до фиксации digest.

В Prisma 7 обязательны ESM (`type: module`), конфигурация `prisma.config.ts`, явный PostgreSQL adapter и явная загрузка `.env` для CLI. Генератор `prisma-client` пишет клиент в `src/generated/prisma`; импортировать клиент оттуда. Создать один PrismaClient на процесс, не новый экземпляр в каждом запросе. Соединение и миграции — обычный PostgreSQL TCP, без Accelerate.

## 3 Архитектурные границы

`src/app` содержит страницы и тонкие Route Handlers. `src/contracts` содержит схемы входа и выхода, доступные UI и серверу. `src/server` содержит аутентификацию, прикладные сервисы, доступ к БД, документы, интеграции и кредитную политику. Серверные модули помечаются `server-only` и не импортируются в Client Components.

Кредитная арифметика и переходы состояний реализуются чистыми функциями. HTTP-слой не вычисляет решение самостоятельно. UI получает платеж из API расчета; при отправке сервер повторяет расчет по сохраненным данным.

Не вводить обязательные Redis, брокер, S3, отдельный API-сервер, монорепозиторий или DI-framework. Обработчик получает адаптеры через обычные аргументы/конструктор, что позволяет подменять их в тестах. `Repository`-обертки создавать только при реальной необходимости; одного Prisma-слоя и сервисов достаточно.

## 4 Иерархия будущего репозитория

Полная обязательная структура по подсистемам. Компоненты shadcn могут добавлять собственные вспомогательные файлы.

```text
smart-credit-cabinet/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── pull_request_template.md
├── docker/
│   └── init.sh
├── docs/
│   ├── project.md
│   ├── technical.md
│   ├── openapi.yaml
│   ├── postman.collection.json
│   ├── postman.local.environment.json
│   ├── test-cases.md
│   ├── verification.md
│   └── diagrams/
│       ├── architecture.mmd
│       ├── classes.mmd
│       ├── submission.mmd
│       ├── offer-acceptance.mmd
│       └── application-states.mmd
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       └── migration_lock.toml
├── public/
│   └── demo-documents/
│       ├── bank-statement.pdf
│       └── financial-report.pdf
├── scripts/
│   ├── wait-for-ready.mjs
│   └── verify-contracts.mjs
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── (cabinet)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── applications/
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   │   └── news/
│   │   │       └── [id]/
│   │   │           └── page.tsx
│   │   ├── api-docs/
│   │   │   └── page.tsx
│   │   └── api/
│   │       ├── health/
│   │       │   ├── live/route.ts
│   │       │   └── ready/route.ts
│   │       └── v1/
│   │           ├── openapi/route.ts
│   │           ├── auth/
│   │           │   ├── login/route.ts
│   │           │   ├── logout/route.ts
│   │           │   └── me/route.ts
│   │           ├── company/route.ts
│   │           ├── products/route.ts
│   │           ├── calculations/route.ts
│   │           ├── applications/
│   │           │   ├── route.ts
│   │           │   └── [id]/
│   │           │       ├── route.ts
│   │           │       ├── submit/route.ts
│   │           │       ├── reopen/route.ts
│   │           │       ├── documents/route.ts
│   │           │       └── offers/
│   │           │           └── [offerId]/
│   │           │               └── accept/route.ts
│   │           ├── documents/
│   │           │   └── [id]/route.ts
│   │           └── news/
│   │               ├── route.ts
│   │               └── [id]/route.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── cabinet-shell.tsx
│   │   ├── company-summary.tsx
│   │   ├── application-list.tsx
│   │   ├── application-form.tsx
│   │   ├── document-upload.tsx
│   │   ├── application-timeline.tsx
│   │   ├── offer-card.tsx
│   │   └── news-feed.tsx
│   ├── contracts/
│   │   ├── auth.ts
│   │   ├── company.ts
│   │   ├── product.ts
│   │   ├── application.ts
│   │   ├── document.ts
│   │   ├── offer.ts
│   │   ├── news.ts
│   │   └── errors.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── format.ts
│   │   └── utils.ts
│   ├── generated/
│   │   └── prisma/
│   └── server/
│       ├── config.ts
│       ├── db.ts
│       ├── logger.ts
│       ├── http/
│       │   ├── responses.ts
│       │   ├── origin.ts
│       │   └── errors.ts
│       ├── auth/
│       │   ├── passwords.ts
│       │   ├── sessions.ts
│       │   ├── service.ts
│       │   └── rate-limit.ts
│       ├── applications/
│       │   ├── service.ts
│       │   ├── state-machine.ts
│       │   ├── idempotency.ts
│       │   └── serialize.ts
│       ├── credit/
│       │   ├── policy.ts
│       │   ├── calculator.ts
│       │   ├── decision.ts
│       │   └── types.ts
│       ├── documents/
│       │   ├── service.ts
│       │   └── storage.ts
│       ├── integrations/
│       │   ├── contracts.ts
│       │   ├── registry.mock.ts
│       │   └── credit-history.mock.ts
│       └── news/
│           ├── articles.ts
│           └── service.ts
├── tests/
│   ├── fixtures/
│   │   ├── profiles.ts
│   │   ├── documents.ts
│   │   ├── clock.ts
│   │   └── server-only.ts
│   ├── unit/
│   │   ├── calculator.test.ts
│   │   ├── decision.test.ts
│   │   ├── state-machine.test.ts
│   │   └── news.test.ts
│   ├── ui/
│   │   ├── application-form.test.tsx
│   │   └── offer-card.test.tsx
│   ├── integration/
│   │   ├── setup.ts
│   │   ├── auth.test.ts
│   │   ├── applications.test.ts
│   │   ├── documents.test.ts
│   │   └── concurrency.test.ts
│   └── e2e/
│       ├── helpers.ts
│       ├── full-offer.spec.ts
│       ├── reduced-offer.spec.ts
│       ├── clarification.spec.ts
│       ├── rejection.spec.ts
│       ├── tenant-isolation.spec.ts
│       └── persistence.spec.ts
├── .dockerignore
├── .env.example
├── .gitignore
├── .npmrc
├── .nvmrc
├── .redocly.yaml
├── compose.yaml
├── compose.dev.yaml
├── Dockerfile
├── eslint.config.mjs
├── next.config.ts
├── next-env.d.ts
├── package.json
├── package-lock.json
├── playwright.config.ts
├── postcss.config.mjs
├── prisma.config.ts
├── tsconfig.json
├── vitest.config.ts
├── vitest.integration.config.ts
├── README.md
└── THIRD_PARTY_NOTICES
```

Каталог конкретной начальной SQL-миграции добавляется Prisma Migrate при реализации и обязательно коммитится вместе с `migration.sql`. Отсутствие имени такой миграции в дереве не означает, что можно обойтись `db push` при проверяемом запуске.

`docs/project.md` и `docs/technical.md` получают содержание двух согласованных документов. При переносе исправить взаимные Markdown-ссылки на эти имена. Исследование рынка можно приложить отдельно; не оставлять ссылку на файл, которого нет в репозитории. В `docs/verification.md` записываются только реально выполненные команды, результаты, версии и ограничения. База, `.env`, загруженные файлы, сессии и отчеты тестов в Git не попадают.

## 5 Предметная модель и ограничения БД

Все ID — UUID, даты — UTC с сериализацией ISO 8601. Отображение в UI — `ru-RU`, время `Europe/Moscow`. Все денежные входы — целые рубли, валюта только RUB. Не использовать float для хранения денежных сумм. `Int` достаточно при ограничении отдельных денежных полей диапазоном 0–1 000 000 000; кредит ограничен 5 000 000. Годовая ставка — целое число базисных пунктов.

### 5 1 Перечень сущностей

| Сущность | Поля и ограничения |
|---|---|
| User | `id`, `email` unique lower-case, `passwordHash`, `companyId` FK, `createdAt`; одна компания на пользователя |
| Company | `id`, `legalName`, `inn` unique, `legalForm=OOO`, `okved`, `industry=TRADE`, `fixtureKey` unique, `createdAt`; профиль только для чтения клиентом |
| Session | `id`, `userId` FK, `tokenHash` unique, `expiresAt`, `createdAt`; индекс `userId` и `expiresAt` |
| CreditApplication | `id`, `userId`, `companyId`, `productCode`, `purpose`, `requestedAmountRub`, `termMonths`, `monthlyRevenueRub`, `monthlyOperatingExpensesRub`, `status`, `version`, `createdAt`, `updatedAt`; индекс `(userId, createdAt)` |
| Document | `id`, `applicationId`, `type`, `originalName`, `storageKey` unique, `mimeType`, `sizeBytes`, `sha256`, `active`, `createdAt`; индекс `(applicationId, type, active)` |
| EvaluationRun | `id`, `applicationId`, `inputVersion`, `resultVersion`, `policyVersion`, `inputSnapshot` Json, `outcome`, `reasonCodes` Json, `createdAt`; unique `(applicationId, inputVersion)` |
| CheckResult | `id`, `evaluationRunId`, `type`, `status`, `details` Json, `createdAt`; индекс `evaluationRunId` |
| Offer | `id`, `applicationId`, `evaluationRunId` unique, `applicationVersion`, `kind`, `amountRub`, `termMonths`, `annualRateBps`, `monthlyPaymentRub`, `totalRepaymentRub`, `expiresAt`, `acceptedAt` nullable, `createdAt`; unique `(applicationId, applicationVersion)` |
| ApplicationEvent | `id`, `applicationId`, `type`, `actor`, `payload` Json, `sequence` Int, `createdAt`; unique `(applicationId, sequence)` |
| IdempotencyRecord | `id`, `userId`, `applicationId`, `operation`, `key`, `requestHash`, `httpStatus`, `responseBody` Json, `createdAt`; unique `(userId, applicationId, operation, key)` |

`CreditApplication` при создании: `status=DRAFT`, `version=1`, `productCode=WORKING_CAPITAL`, `purpose` — пустая строка; финансовые поля, сумма и срок nullable. До отправки обязательные поля должны пройти полную валидацию.

Перечисления:

| Enum | Значения |
|---|---|
| ApplicationStatus | `DRAFT`, `NEEDS_INFO`, `OFFERED`, `REJECTED`, `ACCEPTED` |
| DocumentType | `BANK_STATEMENT`, `FINANCIAL_REPORT` |
| CheckType | `COMPLETENESS`, `REGISTRY`, `CREDIT_HISTORY`, `AFFORDABILITY` |
| CheckStatus | `PASS`, `FAIL`, `REQUIRES_INPUT` |
| EvaluationOutcome | `NEEDS_INFO`, `FULL_OFFER`, `REDUCED_OFFER`, `REJECTED` |
| OfferKind | `FULL`, `REDUCED` |
| EventActor | `CLIENT`, `SYSTEM` |
| IdempotentOperation | `SUBMIT`, `ACCEPT_OFFER` |

### 5 2 Обязательные инварианты

1. `companyId` заявки берется из серверной сессии; `userId` из текущего пользователя. Эти поля не принимаются от клиента.
2. Клиент видит только свои заявки, даже если в будущем у компании несколько представителей. Это сознательно упрощенная модель доступа MVP.
3. В момент операции только один активный документ каждого типа. В SQL-миграции добавить частичный unique index по `(applicationId, type)` с условием `active = true`.
4. Каждый успешно сохраненный PATCH, upload, delete, submit, reopen или accept увеличивает `application.version` на 1. Ошибка не меняет версию.
5. `inputVersion` EvaluationRun равен версии снимка до submit; `resultVersion` равен версии после фиксации результата, то есть `inputVersion + 1`.
6. `Offer.applicationVersion = EvaluationRun.resultVersion`. Пока статус OFFERED, актуально только предложение с версией, равной версии заявки.
7. После ACCEPTED заявка неизменяема; принятое предложение определяется по `acceptedAt`, поскольку прием предложения сам увеличивает версию заявки.
8. Старые проверки, события и предложения не удаляются при редактировании. В карточке они видны как история; действующего предложения при DRAFT, NEEDS_INFO и REJECTED нет.
9. В рамках заявки может быть принято только одно предложение. Защитить это условие транзакцией; добавить partial unique index Offer по `applicationId` при `acceptedAt IS NOT NULL`.
10. Snapshot содержит входные поля, идентификаторы и SHA-256 активных документов, полученные сведения адаптеров и версию политики. Пароли, сессии и локальные пути в него не включаются.

### 5 3 UML классов и сервисов

```mermaid
classDiagram
    class Company {
        +String id
        +String legalName
        +String inn
        +String fixtureKey
    }
    class User {
        +String id
        +String email
        +String passwordHash
        +String companyId
    }
    class Session {
        +String tokenHash
        +DateTime expiresAt
    }
    class CreditApplication {
        +String id
        +String userId
        +String companyId
        +ApplicationStatus status
        +Int version
        +Int requestedAmountRub
        +Int termMonths
        +Int monthlyRevenueRub
        +Int monthlyOperatingExpensesRub
    }
    class Document {
        +DocumentType type
        +String storageKey
        +String sha256
        +Boolean active
    }
    class EvaluationRun {
        +Int inputVersion
        +Int resultVersion
        +String policyVersion
        +Json inputSnapshot
        +EvaluationOutcome outcome
    }
    class CheckResult {
        +CheckType type
        +CheckStatus status
        +Json details
    }
    class Offer {
        +String id
        +Int applicationVersion
        +OfferKind kind
        +Int amountRub
        +Int monthlyPaymentRub
        +DateTime expiresAt
        +DateTime acceptedAt
    }
    class ApplicationEvent {
        +String type
        +EventActor actor
        +Json payload
        +DateTime createdAt
    }
    class IdempotencyRecord {
        +String key
        +String operation
        +String requestHash
        +Json responseBody
    }
    class ApplicationService {
        +createDraft(userId)
        +saveDraft(userId, input)
        +submit(userId, input, key)
        +reopen(userId, input)
        +acceptOffer(userId, input, key)
    }
    class CreditDecisionService {
        +evaluate(input, policy)
        +calculatePayment(amountRub, termMonths)
        +findAffordableAmount(input)
    }
    class RegistryAdapter {
        <<interface>>
        +check(companyId)
    }
    class CreditHistoryAdapter {
        <<interface>>
        +check(companyId)
    }
    class DocumentService {
        +upload(userId, input)
        +download(userId, documentId)
        +deactivate(userId, input)
    }
    Company "1" --> "1..*" User
    User "1" --> "0..*" Session
    User "1" --> "0..*" CreditApplication
    Company "1" --> "0..*" CreditApplication
    CreditApplication "1" *-- "0..*" Document
    CreditApplication "1" *-- "0..*" EvaluationRun
    EvaluationRun "1" *-- "1..*" CheckResult
    EvaluationRun "1" --> "0..1" Offer
    CreditApplication "1" *-- "0..*" ApplicationEvent
    CreditApplication "1" *-- "0..*" IdempotencyRecord
    ApplicationService ..> CreditDecisionService
    ApplicationService ..> RegistryAdapter
    ApplicationService ..> CreditHistoryAdapter
    ApplicationService ..> DocumentService
```

События сортируются по `sequence ASC`, а не по случайному UUID при одинаковых timestamp. В каждой успешной транзакции после блокирующего условного UPDATE заявки определить следующий sequence как текущий максимум +1. При submit записать APPLICATION_SUBMITTED с actor CLIENT и один результат с actor SYSTEM. Допустимые event types: DRAFT_CREATED, DATA_UPDATED, DOCUMENT_UPLOADED, DOCUMENT_DEACTIVATED, APPLICATION_SUBMITTED, INFORMATION_REQUESTED, OFFER_CREATED, APPLICATION_REJECTED, APPLICATION_REOPENED, OFFER_ACCEPTED. В replay новые события отсутствуют.

## 6 Состояния и разрешенные операции

| Операция | Допустимые исходные статусы | Результат |
|---|---|---|
| PATCH полей | DRAFT, NEEDS_INFO | Сохранение текущего статуса; версия +1 |
| Загрузка/деактивация документа | DRAFT, NEEDS_INFO | Сохранение текущего статуса; версия +1 |
| submit | DRAFT, NEEDS_INFO | NEEDS_INFO, OFFERED или REJECTED; версия +1 |
| reopen | OFFERED, REJECTED | DRAFT; версия +1; старое предложение недействительно |
| accept | OFFERED | ACCEPTED; версия +1; `acceptedAt` заполнено |

ACCEPTED не имеет исходящих переходов. После отказа можно явно открыть новую редакцию через reopen; это новое рассмотрение той же заявки с сохранением истории.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> NEEDS_INFO: отсутствуют документы
    DRAFT --> OFFERED: результат submit
    DRAFT --> REJECTED: результат submit
    NEEDS_INFO --> NEEDS_INFO: комплект неполный
    NEEDS_INFO --> OFFERED: результат submit
    NEEDS_INFO --> REJECTED: результат submit
    OFFERED --> DRAFT: reopen
    REJECTED --> DRAFT: reopen
    OFFERED --> ACCEPTED: accept
    ACCEPTED --> [*]
```

В базе не сохраняется PROCESSING. Загрузка отображается только на время запроса. Сбой адаптера или БД не должен оставлять заявку «на проверке» без способа завершить процесс.

## 7 Денежные расчеты и политика

### 7 1 Параметры

`policyVersion = demo-credit-v1`. Политика находится в `src/server/credit/policy.ts`, не редактируется через UI и не принимается из запроса.

| Правило | Значение |
|---|---|
| Минимальная сумма | 500 000 руб. |
| Максимальная сумма | 5 000 000 руб. |
| Срок | Целое число 6–24 месяца |
| Ставка | 2000 bps годовых |
| Альтернативная сумма | Кратна 10 000 руб. |
| Минимальное покрытие платежей | 1,20 |
| Порог текущей просрочки для отказа | 30 дней включительно |
| Действие предложения | 24 часа |

### 7 2 Платеж

Использовать Decimal с precision 40. Месячная ставка `r = annualRateBps / 10000 / 12`. Для суммы P и срока n: `A = P × r / (1 − (1 + r)^(-n))`. `monthlyPaymentRub` — округление A вверх до целого рубля. Для ставки 0 отдельная ветвь `ceil(P / n)`; она тестируется, хотя продукт использует 20%.

`totalRepaymentRub = monthlyPaymentRub × n`. Это сумма условных одинаковых платежей прототипа; последний платеж не корректируется на копейки. `interestRub = totalRepaymentRub − amountRub`. UI явно указывает, что это расчетная модель без комиссий и календарного начисления.

Свободный поток до кредитов: `cashFlowRub = monthlyRevenueRub − monthlyOperatingExpensesRub`. Действующие платежи `existingMonthlyDebtPaymentRub` поступают только из CreditHistoryAdapter. Для сравнения покрытия использовать точное условие `cashFlowRub × 5 >= (existingMonthlyDebtPaymentRub + monthlyPaymentRub) × 6`.

### 7 3 Порядок решения

1. Не хватает финансового поля или значение вне диапазона — HTTP 422; рассмотрение не запускается.
2. Отсутствует BANK_STATEMENT или FINANCIAL_REPORT — NEEDS_INFO; причина MISSING_DOCUMENTS; CheckResult COMPLETENESS=REQUIRES_INPUT; Offer отсутствует. Адаптеры еще не вызываются.
3. RegistryAdapter возвращает неактивную компанию — REJECTED с COMPANY_INACTIVE.
4. Текущая просрочка от 30 дней — REJECTED с CURRENT_OVERDUE.
5. `cashFlowRub <= 0` — REJECTED с NON_POSITIVE_CASH_FLOW.
6. Если проходит проверка покрытия запрошенной суммы — FULL_OFFER.
7. Иначе найти максимальную сумму, кратную 10 000, не превышающую запрошенную, при том же сроке и ставке. Использовать бинарный поиск по числу шагов с тем же калькулятором платежа. Кандидат должен быть не меньше 500 000 и проходить покрытие.
8. Найден кандидат — REDUCED_OFFER с LOWER_AMOUNT_AVAILABLE; не найден — REJECTED с INSUFFICIENT_PAYMENT_CAPACITY.

На клиенте не показывать PD, «точность скоринга», вероятность одобрения, реальный рейтинг БКИ или утверждение о соблюдении банковской кредитной политики.

### 7 4 Ответ расчета и причины

Причина имеет поля `code`, `message`, `field` nullable. Тексты на русском; `code` стабилен для тестов. Технические детали адаптеров, SQL и внутренние исключения не отображаются клиенту.

`CheckResult.details` для AFFORDABILITY содержит `cashFlowRub`, `existingMonthlyDebtPaymentRub`, `requestedPaymentRub`, `availableNewPaymentRub`. Доступный новый платеж равен `max(0, floor(cashFlowRub × 5 / 6) − existingMonthlyDebtPaymentRub)`; отрицательный поток все равно обрабатывается отдельным правилом.

## 8 Адаптеры и синтетические данные

RegistryAdapter возвращает `status: ACTIVE | INACTIVE`, `inn`, `legalName`, `okved`, `source: LOCAL_MOCK`, `checkedAt` UTC. CreditHistoryAdapter возвращает `existingMonthlyDebtPaymentRub`, `currentOverdueDays`, `source: LOCAL_MOCK`, `checkedAt`.

Выбор фикстуры выполняется сервером по `Company.fixtureKey`. Клиент не передает желаемый результат, просрочку или fixtureKey. Ошибка/timeout адаптера в тестах внедряется заменой зависимости; публичного endpoint для управления ответом нет.

| fixtureKey | Учетная запись | Поступления/расходы руб. в месяц | Текущие платежи | Просрочка | Основной результат при 2 млн на 12 мес. |
|---|---|---|---|---|---|
| full-offer | `full@demo.local` | 1 200 000 / 600 000 | 50 000 | 0 | FULL_OFFER после загрузки двух PDF |
| reduced-offer | `reduced@demo.local` | 500 000 / 260 000 | 70 000 | 0 | REDUCED_OFFER на 1 400 000 руб. |
| clarification | `clarify@demo.local` | 1 200 000 / 600 000 | 50 000 | 0 | NEEDS_INFO при одном PDF; затем FULL_OFFER |
| rejection | `reject@demo.local` | 1 200 000 / 600 000 | 50 000 | 45 | REJECTED после загрузки двух PDF |

Общий демонстрационный пароль: `DemoCredit2026!`. Компании имеют разные синтетические названия и companyId. Для фикстур задать ИНН соответственно `9900000017`, `9900000024`, `9900000031`, `9900000049`; это синтетические идентификаторы, не источник данных о реальных организациях. Все профили RegistryAdapter — ACTIVE; INACTIVE покрывается unit/integration-тестом через зависимость.

Seed создает отсутствующих пользователей/компании через upsert, без очистки таблиц и без сброса существующих паролей, заявок или документов. Он не создает готовые одобрения. Финансовые значения из таблицы — демонстрационные defaults для формы, их можно редактировать. Проверяемая заявка всегда новая и принадлежит вошедшему пользователю.

Два настоящих, открывающихся PDF с синтетическим содержимым входят в `public/demo-documents`. UI дает скачать их для демонстрации. Эти общие публичные фикстуры не являются загруженными документами клиента; загруженные копии хранятся отдельно с проверкой доступа.

## 9 REST API

### 9 1 Общие правила

Базовый префикс `/api/v1`. Route Handlers используют Node.js runtime. JSON-запросы имеют `Content-Type: application/json`; загрузка — multipart/form-data. Непредусмотренные поля отклоняются strict-схемами Zod.

Аутентификация — cookie `credit_session`. В мутациях обязателен Origin, точно равный APP_ORIGIN; запрос с другим или отсутствующим Origin получает 403. Это относится и к login. В Postman Origin задан на уровне коллекции. CORS для сторонних origin не включается.

Успех JSON: объект с `data` и `meta`. `meta` содержит `requestId` UUID и `replayed` boolean. Ошибка: объект с `error` и `meta`; `error` содержит `code`, `message`, `fieldErrors` (массив объектов `field`, `message`). У всех ответов заголовок `X-Request-Id`; у приватных данных `Cache-Control: private, no-store`. 204 и бинарный download не используют JSON-envelope.

| HTTP | Смысл |
|---|---|
| 200 | Чтение, расчет, обновление, рассмотрение, принятие |
| 201 | Черновик или документ создан |
| 204 | Выход или деактивация документа |
| 400 | Синтаксически некорректный JSON, UUID или multipart |
| 401 | Нет действующей сессии |
| 403 | Нарушение Origin |
| 404 | Объект отсутствует либо не принадлежит пользователю |
| 409 | Конфликт версии/статуса, ключа идемпотентности, истекшее предложение |
| 413 | Слишком большой файл или тело запроса |
| 415 | Неподдерживаемый формат документа |
| 422 | Поля не проходят контрактную валидацию |
| 429 | Ограничение попыток входа |
| 500 | Неожиданная ошибка; только безопасное сообщение клиенту |
| 503 | Недоступен компонент обработки или readiness |

Входные auth-контракты: email валиден и не длиннее 254 символов; password — строка 1–200 символов. Неверные существующий/несуществующий email и пароль дают одинаковое сообщение 401. Для неизвестного пользователя выполнить проверку заранее подготовленного dummy password hash, чтобы не возвращаться заметно раньше.

### 9 2 Endpoints

| Метод и путь | Вход | Выход и особенности |
|---|---|---|
| POST `/auth/login` | `email`, `password` | 200: UserDTO и Set-Cookie; неверные данные 401 |
| POST `/auth/logout` | `{}` | 204, удаление текущей сессии и cookie |
| GET `/auth/me` | Cookie | UserDTO |
| GET `/company` | Cookie | CompanyDTO и `demoDefaults` при DEMO_MODE |
| GET `/products` | Cookie | Массив из одного ProductDTO |
| POST `/calculations` | `amountRub`, `termMonths` | CalculationDTO; ничего не сохраняет |
| GET `/applications` | `limit` 1–50, default 20; `cursor` UUID optional | `items` ApplicationListItemDTO и `nextCursor` nullable |
| POST `/applications` | `productCode: WORKING_CAPITAL` | 201: ApplicationDTO в DRAFT, version 1 |
| GET `/applications/{id}` | Cookie, UUID | ApplicationDTO с документами, последним рассмотрением, актуальным/принятым предложением и событиями |
| PATCH `/applications/{id}` | `expectedVersion` и разрешенные поля черновика | 200: ApplicationDTO с новой версией |
| POST `/applications/{id}/submit` | `expectedVersion`; Idempotency-Key | 200: ApplicationDTO с результатом обработки |
| POST `/applications/{id}/reopen` | `expectedVersion` | 200: ApplicationDTO в DRAFT; условия прошлого предложения недействительны |
| POST `/applications/{id}/documents` | multipart: `expectedVersion`, `type`, `file` | 201: `document` DocumentDTO и `applicationVersion` |
| GET `/documents/{id}` | Cookie | PDF, Content-Disposition attachment; только владелец |
| DELETE `/documents/{id}` | JSON `expectedVersion` | 204; деактивация; новая версия читается GET заявки |
| POST `/applications/{id}/offers/{offerId}/accept` | `expectedVersion`; Idempotency-Key | 200: ApplicationDTO в ACCEPTED |
| GET `/news` | Cookie | Массив NewsListItemDTO, максимум 4 материала |
| GET `/news/{id}` | Cookie | NewsArticleDTO с полным содержанием |
| GET `/openapi` | Без сессии | OpenAPI YAML с правильным Content-Type; без runtime-секретов |
| GET `/api/health/live` | Без сессии; вне префикса v1 | 200 `{"status":"ok"}` без БД |
| GET `/api/health/ready` | Без сессии; вне префикса v1 | 200 `{"status":"ready"}` при SELECT 1 и доступном каталоге файлов; иначе 503 |

Пути с `{id}` — обозначение path-параметров OpenAPI; реальные запросы содержат UUID. `GET /applications` сортирует по `createdAt DESC, id DESC`. Чужой cursor не раскрывает данные; cursor используется только внутри выборки пользователя.

OperationId в порядке таблицы маршрутов: `login`, `logout`, `getMe`, `getCompany`, `listProducts`, `calculateLoan`, `listApplications`, `createApplication`, `getApplication`, `updateApplication`, `submitApplication`, `reopenApplication`, `uploadDocument`, `downloadDocument`, `deactivateDocument`, `acceptOffer`, `listNews`, `getNewsArticle`, `getOpenApi`, `getLiveness`, `getReadiness`. В OpenAPI servers использовать origin, а paths содержат полный `/api/v1` либо `/api/health`; не добавлять префикс дважды.

### 9 3 Входные поля заявки

PATCH обязан содержать `expectedVersion`, положительное целое число; остальные поля optional. Nullable-поля можно очищать null в черновике. Каждое успешное сохранение с хотя бы одним редактируемым полем увеличивает версию на 1. PATCH без редактируемых полей — 422.

| Поле | Черновик | Полная отправка |
|---|---|---|
| purpose | Строка 0–1000 символов | После trim от 10 до 1000 символов |
| requestedAmountRub | null либо целое 500 000–5 000 000 | Обязательное целое в диапазоне |
| termMonths | null либо целое 6–24 | Обязательное целое в диапазоне |
| monthlyRevenueRub | null либо целое 0–1 000 000 000 | Обязательное; ноль допустим для получения объяснимого отказа |
| monthlyOperatingExpensesRub | null либо целое 0–1 000 000 000 | Обязательное; не включает платежи по кредитам |

Результат проверки продукта — валидация полей; результат кредитного правила — решение. Запрос на 10 млн не должен попадать в кредитную логику как полноценная валидная заявка и там получать случайный отказ.

### 9 4 DTO

Общий принцип: DateTime сериализуется строкой ISO, enum строкой, денежное значение числом целых рублей. Null присутствует явно там, где значение отсутствует.

| DTO | Полный обязательный состав полей |
|---|---|
| UserDTO | `id`, `email`, `companyId` |
| CompanyDTO | `id`, `legalName`, `inn`, `legalForm`, `okved`, `industry`, `demoDefaults` nullable; defaults: `monthlyRevenueRub`, `monthlyOperatingExpensesRub` |
| ProductDTO | `code`, `name`, `currency`, `minAmountRub`, `maxAmountRub`, `minTermMonths`, `maxTermMonths`, `annualRateBps`, `requiredDocumentTypes` |
| CalculationDTO | `amountRub`, `termMonths`, `annualRateBps`, `monthlyPaymentRub`, `totalRepaymentRub`, `interestRub`, `policyVersion` |
| DocumentDTO | `id`, `applicationId`, `type`, `originalName`, `mimeType`, `sizeBytes`, `sha256`, `active`, `createdAt`; без storageKey |
| ReasonDTO | `code`, `message`, `field` nullable |
| CheckDTO | `type`, `status`, `message`, `details`; только безопасные данные |
| EvaluationDTO | `id`, `inputVersion`, `resultVersion`, `policyVersion`, `outcome`, `reasons`, `checks`, `createdAt` |
| OfferDTO | `id`, `kind`, `applicationVersion`, `amountRub`, `termMonths`, `annualRateBps`, `monthlyPaymentRub`, `totalRepaymentRub`, `expiresAt`, `acceptedAt` nullable, `expired` boolean |
| EventDTO | `id`, `type`, `actor`, `message`, `sequence`, `createdAt`; без внутренних путей и секретов |
| ApplicationListItemDTO | `id`, `productCode`, `purpose`, `requestedAmountRub` nullable, `status`, `version`, `createdAt`, `updatedAt` |
| ApplicationDTO | Все поля ApplicationListItemDTO; дополнительно `companyId`, `termMonths` nullable, `monthlyRevenueRub` nullable, `monthlyOperatingExpensesRub` nullable, `documents` массив активных DocumentDTO, `latestEvaluation` nullable EvaluationDTO, `offer` nullable OfferDTO, `events` массив EventDTO |
| NewsListItemDTO | `id`, `title`, `summary`, `relevanceReason`, `isDemoMaterial: true` |
| NewsArticleDTO | Поля NewsListItemDTO и `body` — массив текстовых абзацев |

При OFFERED `offer` — предложение с версией текущей заявки. При ACCEPTED — принятое предложение по `acceptedAt`. В остальных состояниях `offer=null`. Исторические предложения остаются в БД; UI отображает прошлые решения событиями. `latestEvaluation` может описывать более раннюю версию: UI не называет его актуальным решением после редактирования.

### 9 5 Примеры полного запроса и ответа расчета

Запрос `POST /api/v1/calculations`:

```json
{
  "amountRub": 2000000,
  "termMonths": 12
}
```

Ответ с расчетом по правилам округления:

```json
{
  "data": {
    "amountRub": 2000000,
    "termMonths": 12,
    "annualRateBps": 2000,
    "monthlyPaymentRub": 185270,
    "totalRepaymentRub": 2223240,
    "interestRub": 223240,
    "policyVersion": "demo-credit-v1"
  },
  "meta": {
    "requestId": "38f9aa23-628a-46d8-9b27-7e3efbe06701",
    "replayed": false
  }
}
```

Полный пример конфликта версии:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "Заявка уже изменена. Обновите страницу и повторите действие.",
    "fieldErrors": []
  },
  "meta": {
    "requestId": "820c10fb-5d86-4c7c-b46a-e0551740cf60",
    "replayed": false
  }
}
```

### 9 6 OpenAPI, Swagger и коллекция

Создать `docs/openapi.yaml` версии 3.1 с каждой перечисленной операцией, operationId, схемами Zod-контрактов в эквивалентном виде, path/query/body-параметрами, cookie security scheme `credit_session`, Origin, Idempotency-Key, статусами и примерами. Health и login помечаются без cookie-аутентификации, Origin для login остается обязательным.

`/api-docs` отображает локально установленный Swagger UI, получающий YAML из `/api/v1/openapi`; без CDN. GET публичной спецификации безопасен, а Try it out выполняется в том же origin. Для POST Swagger UI автоматически добавляет Origin браузером; явно не пытаться задавать этот запрещенный для frontend заголовок JavaScript-кодом.

Postman-коллекция содержит все операции, локальный baseUrl `http://localhost:3000`, Origin `{{baseUrl}}`, демонстрационный login, запись applicationId/offerId/version из ответов в environment, генерацию нового UUID для Idempotency-Key при новой операции и сохранение ключа для отдельного запроса Replay. Синтаксис `{{baseUrl}}` — рабочая переменная Postman, а не незаполненное значение: в `postman.local.environment.json` она определена. Не включать настоящие сессии и секреты в экспорт. Cookie jar Postman получает cookie при login.

`verify-contracts.mjs` проверяет присутствие operationId всех маршрутов из этого документа, уникальность ID и полноту Postman-операций. Проверка OpenAPI выполняется Redocly; фактическое соответствие тел ответа проверяют integration-тесты через схемы из `src/contracts`.

## 10 Идемпотентность, транзакции и взаимодействия

### 10 1 Оптимистическая блокировка

Все мутации существующей заявки требуют `expectedVersion`. Для документов он передается строковым multipart-полем при upload и числом JSON при DELETE. Проверять версию в атомарном условном UPDATE по id, userId, version и допустимому статусу. Предварительное чтение версии без проверки в UPDATE недостаточно.

В одной БД-транзакции фиксируются версия, состояние заявки, рассмотрение, проверки, предложение при наличии, события и IdempotencyRecord. Не допускается состояние OFFERED без сохраненного предложения. Если итоговая фиксация не удалась, результат не считается сформированным.

Локальные адаптеры и расчет могут выполняться до короткой write-транзакции на снимке. При фиксации исходная версия должна совпасть. В случае конфликта вычисленное решение отбрасывается и возвращается 409.

### 10 2 Ключ операции

Для submit и accept обязателен `Idempotency-Key` в формате UUID. Область ключа: `(userId, applicationId, operation, key)`. `requestHash` — SHA-256 канонического JSON тела и path-параметров операции. Поля сериализуются в фиксированном порядке; includes expectedVersion и offerId при accept.

Порядок: аутентификация и владение → поиск сохраненного ключа → сравнение hash → проверка версии и статуса для новой операции. Повтор одинакового ключа и тела возвращает сохраненный результат без новых событий, версии и решения, даже если исходная версия уже изменилась. Тот же ключ с другим телом дает 409 IDEMPOTENCY_KEY_REUSED. Новый ключ со старой версией дает 409 VERSION_CONFLICT.

В `responseBody` хранится бизнес-часть ответа; requestId формируется на каждый HTTP-запрос, replay помечается `meta.replayed=true`. Replay отражает исходный результат, а не обязательно последнее состояние заявки; UI после неопределенного сетевого исхода делает GET карточки.

При параллельных запросах с одинаковым ключом только один фиксирует запись; второй после unique/conflict повторно читает запись и возвращает replay. Ограничить внутреннее ожидание/повтор чтения 2 секундами; если победитель еще не завершен — 409 OPERATION_IN_PROGRESS с советом повторить тот же запрос. Не возвращать необработанный Prisma exception.

### 10 3 UML отправки

```mermaid
sequenceDiagram
    actor Client
    participant UI as Cabinet
    participant API as SubmitRoute
    participant S as ApplicationService
    participant M as LocalAdapters
    participant C as CreditDecisionService
    participant DB as PostgreSQL
    Client->>UI: Submit
    UI->>API: expectedVersion и Idempotency-Key
    API->>S: Валидация сессии, Origin, владельца
    S->>DB: Прочитать IdempotencyRecord
    alt Сохраненный ключ и совпадающее тело
        DB-->>S: Сохраненный результат
        S-->>API: Replay
    else Новая операция
        S->>DB: Получить снимок заявки и документов
        alt Нет обязательного PDF
            S->>S: NEEDS_INFO
        else Комплект полный
            S->>M: Registry и CreditHistory
            M-->>S: Детерминированные сведения
            S->>C: Evaluate snapshot
            C-->>S: Outcome, checks, offer parameters
        end
        S->>DB: BEGIN
        S->>DB: UPDATE по id, userId, version и status
        alt Версия совпала
            S->>DB: INSERT EvaluationRun, CheckResult, Offer, Events, IdempotencyRecord
            S->>DB: COMMIT
            S-->>API: ApplicationDTO
        else Конфликт
            S->>DB: ROLLBACK
            S-->>API: 409 VERSION_CONFLICT
        end
    end
    API-->>UI: Результат
    UI-->>Client: Условия или следующее действие
```

### 10 4 UML принятия предложения

```mermaid
sequenceDiagram
    actor Client
    participant UI as Cabinet
    participant API as AcceptRoute
    participant S as ApplicationService
    participant DB as PostgreSQL
    Client->>UI: Принять условия
    UI->>API: offerId, expectedVersion, Idempotency-Key
    API->>S: Проверить сессию, Origin, владельца
    S->>DB: Найти ключ идемпотентности
    alt Replay
        DB-->>S: Сохраненный результат
        S-->>API: Исходный результат без мутации
    else Новая операция
        S->>DB: BEGIN и атомарная проверка OFFERED, версии и срока
        alt Предложение актуально
            S->>DB: UPDATE Offer.acceptedAt
            S->>DB: UPDATE application ACCEPTED и version + 1
            S->>DB: INSERT event и idempotency result
            S->>DB: COMMIT
            S-->>API: ACCEPTED
        else Истекло или версия изменилась
            S->>DB: ROLLBACK
            S-->>API: 409 с конкретным кодом
        end
    end
    API-->>UI: JSON
    UI-->>Client: Итог принятия
```

При accept сначала подтвердить, что offerId принадлежит указанной заявке и вошедшему клиенту. При проверке срока использовать текущее серверное время в момент атомарной фиксации, а не время открытия карточки. Сравнение `expiresAt <= now` означает истечение. Проверка версии и статуса выполняется условным UPDATE; отдельная проверка срока предложения включается в транзакцию и условие его UPDATE. Время внедряется зависимостью в сервис, чтобы тестировать границу без sleep.

## 11 Аутентификация, документы и ошибки

### 11 1 Сессии

- Только seeded login; публичной регистрации и восстановления пароля нет.
- Пароль: scrypt, случайная соль 16 байт, ключ 64 байта; сохранять формат с параметрами, солью и hash. Сравнение через timingSafeEqual с проверкой длины.
- Сессия: `randomBytes(32)` как hex; в cookie сырой токен, в БД только SHA-256. JWT и постоянный SESSION_SECRET не нужны.
- Срок сессии 8 часов; HttpOnly, SameSite=Lax, Path=/, Secure задается COOKIE_SECURE. Для локального HTTP false, для внешнего HTTPS true.
- После logout удалить текущую сессию и cookie. Истекшая сессия дает 401. При новом login создавать новый токен.
- Не более 10 неудачных попыток входа за 15 минут на нормализованный email; локальный in-memory limiter достаточен для одного процесса. Это не распределенная production-защита.
- Company.fixtureKey, passwordHash, Session.tokenHash и storageKey никогда не попадают в DTO.
- HTML защищенного layout перенаправляет на login, API сам проверяет сессию и владельца. Проверка UI не заменяет проверку API.

### 11 2 Документы

Один upload содержит один файл до 5 MiB. Разрешен только PDF: проверить расширение, объявленный MIME и начальные байты `%PDF-`. Это проверка формата, не антивирус и не анализ достоверности содержания. Общий размер multipart ограничить 6 MiB. При известном превышении Content-Length отклонить до чтения. Независимо от наличия и достоверности этого заголовка читать request.body с подсчетом байтов и прерывать поток на превышении лимита; только затем разбирать ограниченное тело как multipart. После разбора проверить фактический размер файла. Прямой неограниченный вызов request.formData() до этой проверки запрещен.

Файлы хранить в UPLOAD_DIR под случайным storageKey, не под пользовательским именем и вне `public`. UUID документа не позволяет скачивание без ownership-проверки. Заголовки download: `Content-Type: application/pdf`, `Content-Disposition: attachment` с безопасно кодированным именем, `X-Content-Type-Options: nosniff`.

Upload: записать новый файл с уникальным именем → транзакционно проверить версию и статус, деактивировать предыдущий активный файл того же типа, сохранить metadata и увеличить версию. При rollback удалить только новый файл. Старые файлы остаются для исторических снимков. Если файл записан, а процесс упал до metadata, возможен orphan; документировать это ограничение. Перед созданием metadata файл должен существовать полностью: использовать временное имя и atomic rename в том же volume.

DELETE — логическая деактивация. Физическое удаление исторического файла не выполнять автоматически. Ввести лимит суммарно 25 MiB сохраненных файлов одной заявки, включая неактивные; при превышении 413 APPLICATION_STORAGE_LIMIT. Это предотвращает неограниченную загрузку при повторных заменах в демо.

`storage.ts` при первом серверном использовании создает UPLOAD_DIR рекурсивно, если каталог отсутствует, и проверяет доступ. Это обеспечивает и локальный dev. В Docker права заранее готовит init; app не требует root. Перед выдачей файла убедиться, что нормализованный путь остается внутри UPLOAD_DIR, независимо от данных metadata.

### 11 3 Ошибки и логирование

Логи JSON: timestamp, level, requestId, operation, durationMs, code и при необходимости applicationId. Не логировать cookies, токены, пароль, DATABASE_URL, содержимое документов и тела финансовых форм. Не отключать проверку TLS у клиентов БД.

Readiness проверяет SELECT 1 и права чтения/записи каталога UPLOAD_DIR, но не выводит конфигурацию. Не требуется обход всего каталога или запись тестового PDF при каждом healthcheck.

## 12 UI и информационные материалы

Весь интерфейс на русском. Использовать системные шрифты; не зависеть от загрузки Google Fonts или CDN при сборке/демонстрации. Доступность: label у каждого поля, клавиатурный фокус, текст ошибки, а не только цвет.

Форма содержит шаги «Потребность», «Параметры», «Финансы», «Документы и отправка». Кнопка «Сохранить» явно сохраняет черновик; автоматическое сохранение не обязательно. При несохраненных изменениях предупредить перед уходом. Кнопка «Отправить» сначала сохраняет изменения PATCH, получает новую версию и только затем вызывает submit. Если PATCH не удался, submit не вызывается.

Не выдумывать задержку для анимации проверки. Пока идет запрос, кнопки отключены. На повтор сетевого запроса использовать тот же Idempotency-Key, а при новом осознанном действии — новый. При 409 обновить карточку и дать понятный текст, не перезаписывать чужую новую версию.

Предложение показывает сумму, срок, ставку, платеж, расчетную сумму платежей, срок действия и причины изменения суммы. Рядом текст о демонстрационных условиях. До ACCEPTED пользователь подтверждает согласие с конкретным предложением checkbox, после чего нажимает «Принять условия». Это UI-подтверждение не изображается юридической электронной подписью.

NewsService использует 6 локальных статей с постоянными ID: `working-capital`, `prepare-documents`, `payment-capacity`, `accept-offer`, `after-rejection`, `trade-seasonality`. Результат детерминирован: NEEDS_INFO поднимает prepare-documents; OFFERED — accept-offer; REJECTED — after-rejection; ACCEPTED — working-capital; без заявки — working-capital; trade-seasonality релевантен отрасли TRADE. Остальные места заполняются стабильным порядком до 4 материалов без дубликатов. «Последняя заявка» определяется по updatedAt DESC, id DESC.

Защищенные страницы выполняются динамически. Не делать DB-запросы при `next build`. Приватные GET API не кэшировать как общие данные пользователей. Не использовать браузерный localStorage как основное хранилище заявок или сессий.

## 13 Конфигурация окружения и число секретов

### 13 1 Точный ответ для GitHub

**В базовом репозитории создать 0 пользовательских Actions Repository Secrets и 0 обязательных Repository Variables.** CI выполняет проверки и Docker-сборку без публикации и deployment. `GITHUB_TOKEN` предоставляется GitHub автоматически и вручную не создается. Разрешение workflow — `contents: read`.

Внешних API-ключей, SMTP_PASSWORD, OPENAI_API_KEY, S3_ACCESS_KEY, JWT_SECRET, AUTH_SECRET и SESSION_SECRET нет. Cookie-токены сессии — случайные значения на каждый вход, а не постоянная конфигурация репозитория.

Для размещения на внешнем сервере существует **1 независимый конфигурационный секрет приложения — пароль PostgreSQL**. DATABASE_URL содержит этот пароль и потому тоже секретен, но это не второй независимо генерируемый секрет. Хранить пароль на сервере или в secret manager, не в Git. Если позже появится автоматический deployment, его секреты описываются отдельным решением после выбора площадки; сейчас workflow deploy не существует.

Демонстрационный пароль пользователей публичный и не относится к Repository Secrets. Локальный пароль БД в примерах тоже открытый: он используется только в изолированном синтетическом демо с непубликуемым портом PostgreSQL.

### 13 2 Переменные

| Переменная | Обязательность | Значение локального демо / назначение |
|---|---|---|
| DATABASE_URL | Обязательна процессам, использующим Prisma | В Compose конструируется на host `db`; для локального dev host `localhost` |
| POSTGRES_PASSWORD | Есть безопасный по контексту демо-default | `credit-demo-local-password`; для внешнего сервера заменить случайной hex-строкой |
| APP_ORIGIN | Обязательна для мутаций | `http://localhost:3000`; для HTTPS указать точный внешний origin |
| DEMO_MODE | Default true | Разрешает seed синтетических аккаунтов и показ demoDefaults |
| COOKIE_SECURE | Default false | true при доступе через внешний HTTPS |
| UPLOAD_DIR | Обязателен существующий writable каталог | `/data/uploads` в Docker; `./work/uploads` в dev |
| PORT | Default 3000 | Внутренний порт Node-процесса |
| HOSTNAME | В контейнере `0.0.0.0` | Адрес прослушивания приложения |
| BIND_ADDRESS | Compose, default `127.0.0.1` | Привязка порта на хосте |
| APP_PORT | Compose, default 3000 | Порт на хосте; при изменении обновить APP_ORIGIN и BASE_URL |
| BASE_URL | Только E2E | `http://localhost:3000` |
| TEST_DATABASE_URL | Только integration | Отдельная БД с именем, заканчивающимся `_test` |
| LOG_LEVEL | Default info | debug, info, warn или error; без тел чувствительных запросов |
| NEXT_TELEMETRY_DISABLED | Default 1 | Отключение telemetry |

`config.ts` валидирует env один раз на старте серверного использования. Строковые booleans парсятся строго как `true`/`false`, не через `Boolean("false")`. Приватные значения не получают префикс NEXT_PUBLIC.

Полное содержимое `.env.example` для локальной разработки:

```dotenv
DATABASE_URL=postgresql://credit:credit-demo-local-password@localhost:5432/credit?schema=public
POSTGRES_PASSWORD=credit-demo-local-password
APP_ORIGIN=http://localhost:3000
DEMO_MODE=true
COOKIE_SECURE=false
UPLOAD_DIR=./work/uploads
PORT=3000
HOSTNAME=0.0.0.0
BIND_ADDRESS=127.0.0.1
APP_PORT=3000
BASE_URL=http://localhost:3000
LOG_LEVEL=info
NEXT_TELEMETRY_DISABLED=1
```

В основном Compose host базы — `db`, а DATABASE_URL из этого локального `.env` не копируется напрямую: Compose задает контейнерное значение явно. Это исключает распространенную ошибку подключения к localhost внутри контейнера. Для внешнего сервера пароль генерировать hex-строкой, чтобы его можно было безопасно включить в URL без дополнительного percent-encoding.

## 14 Docker

Ниже — полные целевые конфигурации файлов. Они станут исполнимыми после создания приложения, package-lock, миграций, seed и обязательных npm scripts. Наличие этих блоков в документации не означает, что сборка уже проверена.

### 14 1 Dockerfile

```dockerfile
FROM node:22.22.0-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build APP_ORIGIN=http://localhost:3000 DEMO_MODE=true COOKIE_SECURE=false UPLOAD_DIR=/tmp/credit-build npm run build

FROM build AS init
WORKDIR /app
ENTRYPOINT ["/bin/sh", "/app/docker/init.sh"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
RUN mkdir -p /data/uploads /app/.next/cache && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

Build-значение DATABASE_URL фиктивное и публичное. Сборка не должна реально подключаться к БД. Серверные импорты могут создавать PrismaClient лениво, но не выполнять запросы при импорте. Кабинет рендерится динамически. Проверить, что Next standalone включает зависимости сгенерированного Prisma-клиента и adapter-pg; Docker smoke обязан сделать настоящий запрос после запуска.

### 14 2 compose.yaml

```yaml
name: smart-credit-cabinet

x-application-environment: &application-environment
  DATABASE_URL: "postgresql://credit:${POSTGRES_PASSWORD:-credit-demo-local-password}@db:5432/credit?schema=public"
  APP_ORIGIN: "${APP_ORIGIN:-http://localhost:3000}"
  DEMO_MODE: "${DEMO_MODE:-true}"
  COOKIE_SECURE: "${COOKIE_SECURE:-false}"
  UPLOAD_DIR: /data/uploads
  LOG_LEVEL: "${LOG_LEVEL:-info}"
  NEXT_TELEMETRY_DISABLED: "1"

services:
  db:
    image: postgres:17-bookworm
    environment:
      POSTGRES_USER: credit
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-credit-demo-local-password}"
      POSTGRES_DB: credit
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U credit -d credit"]
      interval: 2s
      timeout: 3s
      retries: 30
    restart: unless-stopped

  init:
    build:
      context: .
      target: init
    environment:
      <<: *application-environment
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - uploads_data:/data/uploads
    restart: "no"

  app:
    build:
      context: .
      target: runner
    environment:
      <<: *application-environment
      NODE_ENV: production
      HOSTNAME: 0.0.0.0
      PORT: "3000"
    ports:
      - "${BIND_ADDRESS:-127.0.0.1}:${APP_PORT:-3000}:3000"
    depends_on:
      db:
        condition: service_healthy
      init:
        condition: service_completed_successfully
    volumes:
      - uploads_data:/data/uploads
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
      interval: 5s
      timeout: 4s
      start_period: 20s
      retries: 20
    restart: unless-stopped

volumes:
  postgres_data:
  uploads_data:
```

Работа с локальным volume ограничивает горизонтальное масштабирование; не заявлять, что достаточно увеличить replicas. PostgreSQL 17 выбран также для согласованного пути `/var/lib/postgresql/data`; не менять image на PostgreSQL 18 без проверки изменений образа и volumes.

### 14 3 docker/init.sh

```sh
#!/bin/sh
set -eu

mkdir -p /data/uploads
chown 1000:1000 /data/uploads

./node_modules/.bin/prisma migrate deploy

if [ "${DEMO_MODE:-false}" = "true" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts
fi
```

Init запускается с полномочиями для подготовки volume, app — пользователем node UID 1000. `migrate deploy` использует уже закоммиченные миграции и не генерирует их. `seed.ts` использует общие password-функции, выполняется через tsx и не сбрасывает пользовательские данные.

### 14 4 next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
```

### 14 5 .dockerignore

```text
.git
.github
node_modules
.next
coverage
playwright-report
test-results
work
.env
.env.*
!.env.example
*.log
.DS_Store
```

### 14 6 .gitignore

```text
node_modules/
.next/
coverage/
playwright-report/
test-results/
work/
.env
.env.*
!.env.example
*.log
.DS_Store
src/generated/prisma/
```

Сгенерированный Prisma-клиент создается командами в CI и Docker. SQL-миграции и package-lock в ignore не включать.

### 14 7 Локальная разработка

Для необязательного запуска Next вне Docker использовать `compose.dev.yaml`:

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"
```

Команды из корня готового проекта:

```sh
cp .env.example .env
npm ci
npm run db:generate
docker compose -f compose.yaml -f compose.dev.yaml up -d db
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` означает `prisma migrate deploy`, потому что миграции поставляются в Git. Для авторинга новой миграции используется отдельная команда разработчика `prisma migrate dev --name initial`, только на заведомо локальной БД. Не запускать migrate dev при старте app/CI/Docker.

Основной запуск для проверяющего требует только Docker:

```sh
docker compose up --build
```

Остановка без удаления данных:

```sh
docker compose down
```

Удаление volumes — отдельная явно разрушительная операция и в стандартный README-сценарий запуска не входит.

## 15 npm scripts и инструменты проверки

Создать следующие scripts с указанным смыслом. Таблица задает полные значения команд для секции scripts, а не общий package.json с неполным перечнем зависимостей.

| Script | Команда |
|---|---|
| dev | `next dev --hostname 0.0.0.0` |
| build | `next build` |
| start | `next start --hostname 0.0.0.0` |
| lint | `eslint . --max-warnings=0` |
| typecheck | `next typegen && tsc --noEmit` |
| db:generate | `prisma generate` |
| db:migrate | `prisma migrate deploy` |
| db:seed | `tsx prisma/seed.ts` |
| test:unit | `vitest run tests/unit --coverage` |
| test:ui | `vitest run tests/ui` |
| test:integration | `vitest run --config vitest.integration.config.ts` |
| test:e2e | `playwright test` |
| lint:openapi | `redocly lint docs/openapi.yaml` |
| verify:contracts | `node scripts/verify-contracts.mjs` |

Не использовать `next lint`: ESLint запускается отдельным CLI. Не вводить postinstall, который требует действующей БД или запускает миграции. При первом создании проекта `.npmrc` содержит одну строку `save-exact=true`, а `.nvmrc` — `22.22.0`.

### 15 1 prisma.config.ts

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

В schema.prisma datasource использует provider postgresql; URL задается конфигом. Generator `prisma-client` имеет output `../src/generated/prisma`. В runtime создать `PrismaPg` из DATABASE_URL с ограниченными connectionTimeoutMillis и размером пула, затем PrismaClient с этим adapter. Значение рекомендуемого лимита для MVP: max 5, connectionTimeoutMillis 5000, idleTimeoutMillis 10000; проверить поддержку параметров установленной версии adapter-pg.

### 15 2 playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  globalTimeout: 10 * 60 * 1000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

Конфигурация не поднимает второй webServer: тестируется уже запущенный Compose. Не мокировать прикладные API в обязательных E2E. `helpers.ts` выполняет настоящий login и создает новую заявку для теста; тесты не ищут «первую заявку» среди данных предыдущих запусков.

### 15 3 scripts/wait-for-ready.mjs

```javascript
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const deadline = Date.now() + 300_000;
let ready = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(`${baseUrl}/api/health/ready`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    ready = false;
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

if (!ready) {
  console.error("Application readiness timeout");
  process.exit(1);
}

console.log("Application is ready");
```

### 15 4 vitest.config.ts

```typescript
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/fixtures/server-only.ts", import.meta.url),
      ),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/ui/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "src/server/credit/calculator.ts",
        "src/server/credit/decision.ts",
        "src/server/applications/state-machine.ts",
      ],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
```

Каждый UI test начинается с директивы `// @vitest-environment jsdom` и импортирует `@testing-library/jest-dom/vitest`. Установить `@vitest/coverage-v8` той же точной версии, что Vitest, а также `@testing-library/react`, `@testing-library/jest-dom` и jsdom. Маркер `server-only` установлен как runtime dependency; тестовый alias не попадает в next.config.

### 15 5 vitest.integration.config.ts

```typescript
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for integration tests");
}

const databaseName = new URL(testDatabaseUrl).pathname.slice(1);

if (!databaseName.endsWith("_test")) {
  throw new Error("Integration database name must end with _test");
}

if (process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("DATABASE_URL must equal TEST_DATABASE_URL for integration tests");
}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/fixtures/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
});
```

Полное содержимое `tests/fixtures/server-only.ts`:

```typescript
export {};
```

Этот файл — только тестовый эквивалент маркера среды. Он не заменяет адаптеры БД, сервис решений, права доступа или прикладной API.

### 15 6 .redocly.yaml

```yaml
extends:
  - minimal
```

## 16 GitHub Actions

### 16 1 Полный workflow .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: quality
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:17-bookworm
        env:
          POSTGRES_USER: credit
          POSTGRES_PASSWORD: ci-demo-password
          POSTGRES_DB: credit_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U credit -d credit_test"
          --health-interval 2s
          --health-timeout 3s
          --health-retries 30
    env:
      DATABASE_URL: postgresql://credit:ci-demo-password@127.0.0.1:5432/credit_test?schema=public
      TEST_DATABASE_URL: postgresql://credit:ci-demo-password@127.0.0.1:5432/credit_test?schema=public
      APP_ORIGIN: http://localhost:3000
      DEMO_MODE: "true"
      COOKIE_SECURE: "false"
      UPLOAD_DIR: ./work/test-uploads
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: "22.22.0"
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Generate Prisma client
        run: npm run db:generate
      - name: Typecheck
        run: npm run typecheck
      - name: Lint
        run: npm run lint
      - name: Validate API specification
        run: npm run lint:openapi
      - name: Check contract inventory
        run: npm run verify:contracts
      - name: Unit tests with coverage
        run: npm run test:unit
      - name: UI tests
        run: npm run test:ui
      - name: Apply test database migrations
        run: npm run db:migrate
      - name: Seed test accounts
        run: npm run db:seed
      - name: Integration tests
        run: npm run test:integration
      - name: Upload coverage
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: unit-coverage
          path: coverage/
          if-no-files-found: ignore
          retention-days: 7

  docker-e2e:
    name: docker-e2e
    needs: quality
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    env:
      BASE_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v6
        with:
          node-version: "22.22.0"
          cache: npm
      - name: Install dependencies for Playwright
        run: npm ci
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
      - name: Validate Compose
        run: docker compose -p credit-ci config --quiet
      - name: Build and start clean application
        run: docker compose -p credit-ci up --build -d
      - name: Wait for readiness
        run: node scripts/wait-for-ready.mjs
      - name: Run end-to-end scenarios
        run: npm run test:e2e
      - name: Verify application restart preserves data
        run: |
          docker compose -p credit-ci restart app
          node scripts/wait-for-ready.mjs
          BASE_URL=http://localhost:3000 npx playwright test tests/e2e/persistence.spec.ts
      - name: Collect container logs
        if: always()
        run: docker compose -p credit-ci logs --no-color > compose.log 2>&1
      - name: Upload diagnostics
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: docker-e2e-diagnostics
          path: |
            playwright-report/
            test-results/
            compose.log
          if-no-files-found: ignore
          retention-days: 7
      - name: Cleanup isolated CI resources
        if: always()
        run: docker compose -p credit-ci down --volumes --remove-orphans
```

`tests/e2e/persistence.spec.ts` входит в обязательное дерево. Этот тест входит в основной E2E-набор: первый запуск создает новую заявку и загружает PDF, фиксируя только ID и контрольные значения в `work/persistence-probe.json` на runner. После restart app второй запуск читает сохраненный probe, входит заново и проверяет ту же заявку и скачивание того же файла. Повторный этап не должен создать другую заявку вместо проверки сохранности. Файл probe не коммитится и не содержит session token. Если probe отсутствует на первом запуске, тест создает его; если есть — проверяет объект. На чистом CI checkout work отсутствует. При локальной повторной проверке явно удалить старый probe, если используется другая БД.

CI удаляет только собственные volumes проекта `credit-ci` на одноразовом runner. В пользовательскую команду остановки это удаление не переносится.

Workflow использует проверенные основные версии официальных actions. Для усиления воспроизводимости при сдаче можно закрепить actions на проверенные полные commit SHA; не выдумывать SHA. Нет `pull_request_target`, пользовательского PAT, публикации packages или write-доступа к содержимому.

### 16 2 Настройки репозитория

- Основная ветка main, merge через pull request.
- В ruleset/защите main, если настройка доступна для выбранного тарифа и репозитория, сделать обязательными `quality` и `docker-e2e`; одна независимая проверка PR, запрет force push.
- Actions: разрешены используемые официальные actions; workflow token с read permissions.
- Создать 0 пользовательских Repository Secrets; CI работает и для PR без выдачи секретов fork-коду, с обычной политикой одобрения GitHub для внешних contributors.
- В PR template: что изменено, как проверить, влияние на API/БД, выполненные проверки.
- Не публиковать claims о зеленом CI до фактического запуска workflow.
- На дедлайн зафиксировать commit hash/тег в README; доступ жюри для приватного репозитория — `alfa-hack-2026` по PDF кейса.

## 17 Структура тест-кейсов и обязательные проверки

### 17 1 Шаблон записи в docs/test-cases.md

Каждый тест-кейс содержит:

| Поле | Содержание |
|---|---|
| ID | Стабильный идентификатор, например E2E-01 |
| Requirement | Один или несколько FR-ID из проектного документа |
| Уровень | unit, UI, integration, E2E или smoke |
| Название | Проверяемое поведение |
| Предусловия | БД, статус, пользователь, часы и документы |
| Данные | Конкретная фикстура, сумма, срок и входные значения |
| Шаги | Последовательность действий/запросов |
| Ожидаемый UI | Текст, состояние и доступные действия |
| Ожидаемый API | HTTP, code и ключевые поля DTO |
| Ожидаемая БД | Версия, статус, число событий/решений и связи |
| Очистка | Изоляция данных либо явно тестовая очистка |
| Автоматизация | Путь файла и имя теста |

Фактический результат, commit и дата выполнения записываются в verification/отчет, а не заранее подменяются значением PASS.

### 17 2 Unit

| ID | Поведение | Ожидаемый результат |
|---|---|---|
| U-01 | 2 000 000 руб., 12 мес., 2000 bps | 185 270 руб. в месяц; 2 223 240 руб. суммарно |
| U-02 | Нулевая ставка в чистом калькуляторе | ceil(P / n), без деления на ноль |
| U-03 | Порог покрытия ровно 1,20 | Сумма допустима; сравнение включительное |
| U-04 | Профиль full-offer с полными документами | FULL_OFFER |
| U-05 | Профиль reduced-offer | 1 400 000 руб.; следующий шаг 1 410 000 не проходит покрытие |
| U-06 | Нет одного документа | NEEDS_INFO и конкретный тип; адаптеры не вызываются |
| U-07 | Просрочка 29 и 30 дней | 29 не вызывает именно CURRENT_OVERDUE; 30 вызывает |
| U-08 | Поток 0 или отрицательный | NON_POSITIVE_CASH_FLOW |
| U-09 | Даже минимум суммы недоступен | INSUFFICIENT_PAYMENT_CAPACITY; Offer отсутствует |
| U-10 | Компания INACTIVE | COMPANY_INACTIVE |
| U-11 | Недопустимый переход из ACCEPTED | Отклонение без изменения состояния |
| U-12 | Контекст ленты NEEDS_INFO → OFFERED | Разные приоритетные статьи, стабильный порядок без дубликатов |

### 17 3 Integration с настоящей PostgreSQL

| ID | Поведение | Проверяемые условия |
|---|---|---|
| I-01 | Login и logout | Cookie-флаги, SHA-256 в Session, 401 после logout |
| I-02 | GET/PATCH чужой заявки | 404, никаких изменений |
| I-03 | Скачать/удалить чужой PDF | 404, файл и версия владельца сохранены |
| I-04 | POST без/с чужим Origin | 403 до мутации |
| I-05 | Невалидные поля submit | 422; нет EvaluationRun и новых событий |
| I-06 | Submit без документа | NEEDS_INFO; ровно один новый run и версия +1 |
| I-07 | Повтор submit с тем же ключом | Сохраненный результат, replay=true; нет дубликатов |
| I-08 | Тот же ключ, другое тело | 409 IDEMPOTENCY_KEY_REUSED |
| I-09 | Новый ключ со старой версией | 409 VERSION_CONFLICT |
| I-10 | Параллельные submit с разными ключами | Только один результат фиксируется; второй 409 |
| I-11 | Параллельные submit с одним ключом | Один результат; replay либо контролируемый OPERATION_IN_PROGRESS и успешный replay при повторе |
| I-12 | Ошибка адаптера | 503; нет частично зафиксированного предложения и изменения версии |
| I-13 | Замена PDF того же типа | Один active, новый SHA, старый документ сохранен для истории |
| I-14 | PDF больше 5 MiB / неверный формат | 413 / 415; нет metadata и осиротевшего нового файла |
| I-15 | Изменение после reopen | DRAFT; прошлый Offer не принимается |
| I-16 | Истечение expiresAt на границе | 409 OFFER_EXPIRED; acceptedAt не установлен |
| I-17 | Два accept одновременно | Одно принятие и одно событие; второй replay или 409 |
| I-18 | ACCEPTED: PATCH/upload/reopen | 409 INVALID_STATE |
| I-19 | Повтор seed | Старые заявки, PDF и сессии не стерты |
| I-20 | DTO против контрактов | Ни storageKey, ни passwordHash, ни fixtureKey не сериализованы |

Integration-тесты вызывают прикладные сервисы и Route Handlers с Web/Next Request, настоящей PostgreSQL и временным каталогом. Аутентификацию строить от переданного request, не от глобального браузера. Маркер `server-only` при импортировании в Vitest замещается тестовым модулем `tests/fixtures/server-only.ts`, экспортирующим пустой модуль; это исключение касается только маркера границы, а не бизнес-логики. В production alias не применяется.

Перед любой очисткой integration setup обязан разобрать TEST_DATABASE_URL, убедиться, что имя базы оканчивается `_test`, что DATABASE_URL совпадает с этим тестовым адресом, и только затем очищать записи/восстанавливать фикстуры. При несоответствии немедленно завершить тесты. Не запускать truncate на обычной БД `credit`.

Тесты integration выполняются последовательно: `fileParallelism=false`, `maxWorkers=1`. UPLOAD_DIR для них отдельный; setup создает каталог. Отсутствие БД должно приводить к явному падению, а не к skip или переходу на mock.

### 17 4 UI

| ID | Сценарий | Результат |
|---|---|---|
| UI-01 | Некорректная сумма и пустая цель | Связанные с полями сообщения, отправка не начинается |
| UI-02 | Запрос в процессе | Кнопки заблокированы, состояние доступно screen reader |
| UI-03 | Предложение меньшей суммы | Видны запрошенная и предложенная суммы, платеж и причина |
| UI-04 | Конфликт версии | Понятное уведомление и обновление карточки без тихой перезаписи |

В Vitest UI-файлы используют jsdom. Подмена API допустима для изолированного UI-теста, но не для обязательных E2E.

### 17 5 E2E и Docker smoke

| ID | Путь | Финальный результат |
|---|---|---|
| E2E-01 | full → новая заявка → два PDF → submit → accept | ACCEPTED, данные сохранены после reload |
| E2E-02 | reduced → новая заявка → два PDF → submit | REDUCED_OFFER на 1 400 000, согласованный платеж |
| E2E-03 | clarify → один PDF → submit → второй PDF → submit | NEEDS_INFO затем OFFERED; две разные EvaluationRun |
| E2E-04 | reject → два PDF → submit | CURRENT_OVERDUE, нет кнопки принятия |
| E2E-05 | Вход вторым пользователем и прямой чужой URL | Нет чужих полей и PDF |
| E2E-06 | Persistence probe до/после restart app | Та же заявка и тот же скачиваемый PDF |
| S-01 | Чистые Compose volumes | Init завершился 0, readiness 200, доступен login |
| S-02 | Перезапуск app | Данные и документы сохранены |
| S-03 | Остановка БД | Ready=503; live=200, если Node жив; UI не показывает выдуманное решение |

Playwright использует независимые browser contexts, а helpers сохраняют id созданного объекта. Не добавлять test.skip для обязательных сценариев, чтобы получить зеленый CI. Проверка browser console не должна падать на ожидаемые 4xx тестов отказа доступа; неожиданные 500 и необработанные исключения считаются ошибкой.

### 17 6 Покрытие

Coverage считается для calculator, decision и state-machine: минимум 90% statements/lines/functions и 80% branches. Эти пороги задаются Vitest/V8 в конфигурации и реально применяются к test:unit. Не включать сгенерированный Prisma, shadcn и конфигурационные файлы ради искусственного снижения покрытия. Ключевые границы проверяются отдельными assertions, а не только процентом coverage.

## 18 Документация и эксплуатационные материалы

README должен содержать назначение, границу демо, требования к Docker, одну команду запуска, URL, четыре аккаунта и пароль, пошаговые сценарии, список env, схему архитектуры, команды тестов, описание симуляторов, остановку без удаления volumes, известные ограничения и сдаваемую версию.

`THIRD_PARTY_NOTICES` перечисляет фактически установленные библиотеки, их версии и лицензии, происхождение UI-компонентов, сведения о синтетических материалах и локальных симуляторах. Лицензии проверяются по установленным пакетам; не копировать предположение «все MIT». Не включать чужие логотипы и фирменные активы без основания. Решение описывается как прототип по кейсу, а не официальный кабинет банка.

`docs/verification.md` должен различать: выполнено успешно; выполнено с ошибкой; не выполнено. Записать команды, commit, Node/npm, Docker/Compose, digest образов, количество тестов, результаты сценариев и ограничения. Если Docker или CI недоступен, прямо сообщить это и не считать приемку завершенной.

Модель данных и SQL-индексы обязаны совпадать с миграциями. Mermaid-схемы из двух документов перенести в `docs/diagrams` и поддерживать вместе с реализацией. OpenAPI не должен содержать маршруты банковского кабинета или неподдерживаемые способы аутентификации.

## 19 Критерии готовности

1. На чистом checkout команда `docker compose up --build` поднимает db, успешно завершает init и запускает app; README не требует ручного создания таблиц.
2. Все четыре профиля проходят заявленные сценарии через настоящий UI/API/БД.
3. API соответствует 21 операции из раздела 9, OpenAPI проходит lint, коллекция запросов содержит эти операции.
4. Повтор submit и accept не создает повторных решений/событий; конфликт версии контролируется.
5. Смена данных приводит к новой редакции и новому расчету. Старое предложение нельзя принять.
6. Ошибка адаптера не оставляет частично одобренную заявку.
7. Сессия и владение проверяются на сервере для каждой приватной операции; документы не находятся в public.
8. Перезапуск app сохраняет проверяемую заявку и PDF.
9. В интерфейсе нет ручной установки статуса, выбора желаемого решения, кабинета сотрудника, LLM и внешнего платного сервиса.
10. NewsFeed меняет приоритетные материалы по контексту, содержит полный текст статей и маркировку демо.
11. Нужны 0 пользовательских GitHub Secrets; `quality` и `docker-e2e` реально проходят на сдаваемом commit.
12. README, API, UML, тест-кейсы, миграции, lock-файл и THIRD_PARTY_NOTICES соответствуют фактическому коду.

## 20 Приоритеты реализации в пределах двух дней

Порядок обязателен, распределения работы между людьми здесь нет.

- P0: Docker/db/init, контракт данных, сессия, черновик, документы, полный результат submit, принятие предложения, история.
- P0: ветви NEEDS_INFO, REDUCED_OFFER и REJECTED, права доступа, version и идемпотентность.
- P0: API/OpenAPI, четыре синтетических профиля, CI, основные тесты и инструкция запуска.
- P1: визуальная полировка, улучшенные пояснения, удобство статей и дополнительные UI-тесты.
- Вне объема: реальные подключения, ML/LLM, фоновые очереди, микросервисы, расширенный каталог продуктов, ручное рассмотрение и облачный автодеплой.

Не переносить на потом обязательную проверку работы процесса, чтобы успеть добавить декоративные функции. Если времени недостаточно, упрощать оформление и количество вспомогательных компонентов, сохраняя обязательные сценарии.

## 21 Первичные технические источники

Проверены 24.10.2026. При реализации уточнять patch-версии и совместимость по официальной документации.

- [Node.js 22.22.0](https://nodejs.org/en/blog/release/v22.22.0) — существующая исходная версия runtime.
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) — базовые требования и App Router.
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — HTTP-маршруты.
- [Next.js output standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) — standalone server, public и static.
- [Prisma ORM 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7) — ESM, config и adapters.
- [Prisma PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql) — PostgreSQL driver adapter.
- [Zod](https://zod.dev/basics) — runtime-валидация контрактов.
- [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) — service_healthy и завершение init.
- [GitHub GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token) — автоматически выдаваемый токен.
- [actions/checkout](https://github.com/actions/checkout), [actions/setup-node](https://github.com/actions/setup-node), [actions/upload-artifact](https://github.com/actions/upload-artifact) — официальные actions.
- [Playwright CI](https://playwright.dev/docs/ci-intro) — Chromium и отчеты.
