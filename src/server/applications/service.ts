import "server-only";
import { db } from "../db";
import { fail } from "../errors";
import { digest } from "../auth/session";
import { evaluate, type Adapters } from "../credit/decision";
import { localAdapters } from "../integrations/adapters";
import { canTransition } from "../credit/state-machine";
import { policy } from "../credit/policy";
import {
  submitSchema,
  type ApplicationDTO,
  type ReasonDTO,
} from "@/contracts/application";
import type { Prisma, ApplicationStatus } from "@/generated/prisma/client";
export type Tx = Prisma.TransactionClient;
const include = {
  documents: true,
  evaluations: {
    include: { checks: true },
    orderBy: { createdAt: "desc" as const },
  },
  offers: true,
  events: { orderBy: { sequence: "asc" as const } },
};
export type Record = Prisma.CreditApplicationGetPayload<{
  include: typeof include;
}>;
export async function owned(id: string, userId: string, client: Tx = db()) {
  const app = await client.creditApplication.findFirst({
    where: { id, userId },
    include,
  });
  return app ?? fail(404, "NOT_FOUND", "Заявка не найдена.");
}
export function toDTO(app: Record): ApplicationDTO {
  const evaluation = app.evaluations[0];
  const offer = app.offers.find((o) =>
    app.status === "ACCEPTED"
      ? !!o.acceptedAt
      : app.status === "OFFERED" && o.applicationVersion === app.version,
  );
  return {
    id: app.id,
    companyId: app.companyId,
    productCode: app.productCode,
    purpose: app.purpose,
    status: app.status,
    version: app.version,
    requestedAmountRub: app.requestedAmountRub,
    termMonths: app.termMonths,
    monthlyRevenueRub: app.monthlyRevenueRub,
    monthlyOperatingExpensesRub: app.monthlyOperatingExpensesRub,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
    documents: app.documents
      .filter((d) => d.active)
      .map(({ storageKey: _key, ...d }) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
      })),
    latestEvaluation: evaluation
      ? {
          id: evaluation.id,
          inputVersion: evaluation.inputVersion,
          resultVersion: evaluation.resultVersion,
          policyVersion: evaluation.policyVersion,
          outcome: evaluation.outcome,
          reasons: evaluation.reasonCodes as unknown as ReasonDTO[],
          checks: evaluation.checks.map((c) => ({
            type: c.type,
            status: c.status,
            message:
              c.status === "PASS"
                ? "Проверка пройдена"
                : c.status === "REQUIRES_INPUT"
                  ? "Нужны документы"
                  : "Требует внимания",
            details: c.details,
          })),
          createdAt: evaluation.createdAt.toISOString(),
        }
      : null,
    offer: offer
      ? {
          id: offer.id,
          kind: offer.kind,
          applicationVersion: offer.applicationVersion,
          amountRub: offer.amountRub,
          termMonths: offer.termMonths,
          annualRateBps: offer.annualRateBps,
          monthlyPaymentRub: offer.monthlyPaymentRub,
          totalRepaymentRub: offer.totalRepaymentRub,
          expiresAt: offer.expiresAt.toISOString(),
          acceptedAt: offer.acceptedAt?.toISOString() ?? null,
          expired: offer.expiresAt <= new Date(),
        }
      : null,
    events: app.events.map((e) => ({
      id: e.id,
      type: e.type,
      actor: e.actor,
      sequence: e.sequence,
      createdAt: e.createdAt.toISOString(),
      message: (e.payload as { message?: string }).message ?? e.type,
    })),
  };
}
export async function event(
  tx: Tx,
  id: string,
  type: string,
  actor: string,
  message: string,
) {
  const last = await tx.applicationEvent.findFirst({
    where: { applicationId: id },
    orderBy: { sequence: "desc" },
  });
  await tx.applicationEvent.create({
    data: {
      applicationId: id,
      type,
      actor,
      payload: { message },
      sequence: (last?.sequence ?? 0) + 1,
    },
  });
}
export async function lock(
  tx: Tx,
  id: string,
  userId: string,
  version: number,
  action: "edit" | "submit" | "reopen" | "accept",
  data: Prisma.CreditApplicationUpdateManyMutationInput = {},
) {
  const app = await owned(id, userId, tx);
  if (app.version !== version)
    fail(
      409,
      "VERSION_CONFLICT",
      "Заявка уже изменена. Обновите данные и повторите действие.",
    );
  if (!canTransition(app.status, action))
    fail(
      409,
      "INVALID_STATE",
      "Это действие недоступно в текущем состоянии заявки.",
    );
  const changed = await tx.creditApplication.updateMany({
    where: { id, userId, version, status: app.status },
    data: { ...data, version: { increment: 1 } },
  });
  if (changed.count !== 1)
    fail(409, "VERSION_CONFLICT", "Заявка уже изменена. Обновите данные.");
  return app;
}
export async function createApplication(user: {
  id: string;
  companyId: string;
}) {
  return db().$transaction(async (tx) => {
    const app = await tx.creditApplication.create({
      data: { userId: user.id, companyId: user.companyId },
    });
    await event(tx, app.id, "CREATED", "CLIENT", "Создан черновик заявки");
    return toDTO(await owned(app.id, user.id, tx));
  });
}
export async function updateApplication(
  id: string,
  userId: string,
  expectedVersion: number,
  data: Prisma.CreditApplicationUpdateManyMutationInput,
  reopen = false,
) {
  return db().$transaction(async (tx) => {
    await lock(
      tx,
      id,
      userId,
      expectedVersion,
      reopen ? "reopen" : "edit",
      reopen ? { status: "DRAFT" } : data,
    );
    await event(
      tx,
      id,
      reopen ? "REOPENED" : "UPDATED",
      "CLIENT",
      reopen
        ? "Заявка возвращена в редактирование. Прошлое предложение недействительно."
        : "Черновик сохранён",
    );
    return toDTO(await owned(id, userId, tx));
  });
}
export async function idempotent(
  id: string,
  userId: string,
  operation: string,
  key: string,
  body: object,
  execute: (tx: Tx) => Promise<ApplicationDTO>,
) {
  await owned(id, userId);
  const requestHash = digest(JSON.stringify({ id, ...body }));
  const where = {
    userId_applicationId_operation_key: {
      userId,
      applicationId: id,
      operation,
      key,
    },
  };
  async function replay() {
    const existing = await db().idempotencyRecord.findUnique({ where });
    if (!existing) return null;
    if (existing.requestHash !== requestHash)
      fail(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Этот ключ уже использован для другого запроса.",
      );
    return {
      data: existing.responseBody as unknown as ApplicationDTO,
      replayed: true,
    };
  }
  const saved = await replay();
  if (saved) return saved;
  try {
    const data = await db().$transaction(
      async (tx) => {
        const result = await execute(tx);
        await tx.idempotencyRecord.create({
          data: {
            userId,
            applicationId: id,
            operation,
            key,
            requestHash,
            httpStatus: 200,
            responseBody: JSON.parse(JSON.stringify(result)),
          },
        });
        return result;
      },
      { timeout: 10_000 },
    );
    return { data, replayed: false };
  } catch (error) {
    const repeated = await replay();
    if (repeated) return repeated;
    throw error;
  }
}
export async function submit(
  id: string,
  userId: string,
  expectedVersion: number,
  key: string,
  adapters?: Adapters,
) {
  return idempotent(
    id,
    userId,
    "SUBMIT",
    key,
    { expectedVersion },
    async (tx) => {
      const app = await lock(tx, id, userId, expectedVersion, "submit");
      const input = submitSchema.parse(app);
      const company = await tx.company.findUniqueOrThrow({
        where: { id: app.companyId },
      });
      let result: Awaited<ReturnType<typeof evaluate>>;
      try {
        result = await evaluate(
          input,
          app.documents.filter((d) => d.active).map((d) => d.type),
          adapters ?? localAdapters(company.fixtureKey),
        );
      } catch {
        return fail(
          503,
          "ADAPTER_UNAVAILABLE",
          "Проверка временно недоступна. Повторите отправку позже.",
        );
      }
      const status: ApplicationStatus = result.calculation
        ? "OFFERED"
        : result.outcome === "NEEDS_INFO"
          ? "NEEDS_INFO"
          : "REJECTED";
      await tx.creditApplication.update({ where: { id }, data: { status } });
      const run = await tx.evaluationRun.create({
        data: {
          applicationId: id,
          inputVersion: expectedVersion,
          resultVersion: expectedVersion + 1,
          policyVersion: policy.version,
          inputSnapshot: JSON.parse(
            JSON.stringify({
              input,
              documents: app.documents
                .filter((d) => d.active)
                .map((d) => ({ id: d.id, sha256: d.sha256 })),
              sources: result.sources,
              policyVersion: policy.version,
            }),
          ),
          outcome: result.outcome,
          reasonCodes: result.reasons,
          checks: { create: result.checks },
        },
      });
      if (result.calculation) {
        const {
          amountRub,
          termMonths,
          annualRateBps,
          monthlyPaymentRub,
          totalRepaymentRub,
        } = result.calculation;
        await tx.offer.create({
          data: {
            applicationId: id,
            evaluationRunId: run.id,
            applicationVersion: expectedVersion + 1,
            kind: result.outcome === "FULL_OFFER" ? "FULL" : "REDUCED",
            amountRub,
            termMonths,
            annualRateBps,
            monthlyPaymentRub,
            totalRepaymentRub,
            expiresAt: new Date(Date.now() + policy.offerHours * 3_600_000),
          },
        });
      }
      await event(
        tx,
        id,
        "SUBMITTED",
        "CLIENT",
        "Заявка отправлена на автоматическую проверку",
      );
      await event(
        tx,
        id,
        result.outcome,
        "SYSTEM",
        result.calculation
          ? "Сформировано предложение демонстрационных условий"
          : result.reasons[0].message,
      );
      return toDTO(await owned(id, userId, tx));
    },
  );
}
export async function accept(
  id: string,
  userId: string,
  offerId: string,
  expectedVersion: number,
  key: string,
) {
  return idempotent(
    id,
    userId,
    "ACCEPT_OFFER",
    key,
    { expectedVersion, offerId },
    async (tx) => {
      const app = await lock(tx, id, userId, expectedVersion, "accept", {
        status: "ACCEPTED",
      });
      const offer = app.offers.find(
        (o) => o.id === offerId && o.applicationVersion === expectedVersion,
      );
      if (!offer)
        fail(409, "INVALID_OFFER", "Предложение больше не актуально.");
      const now = new Date();
      if (offer.expiresAt <= now)
        fail(
          409,
          "OFFER_EXPIRED",
          "Срок предложения истёк. Верните заявку в редактирование.",
        );
      await tx.offer.update({
        where: { id: offerId },
        data: { acceptedAt: now },
      });
      await event(
        tx,
        id,
        "ACCEPTED",
        "CLIENT",
        "Демонстрационные условия приняты. Это не выдача кредита.",
      );
      return toDTO(await owned(id, userId, tx));
    },
  );
}
