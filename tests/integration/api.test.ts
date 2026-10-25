import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { route } from "@/server/router";
import { db } from "@/server/db";
import { submit } from "@/server/applications/service";
import { localAdapters } from "@/server/integrations/adapters";
import type { ApplicationDTO } from "@/contracts/application";
import { hashPassword } from "@/server/auth/password";
import { applicationDTO, companyDTO } from "@/contracts/dto";
import { execFileSync } from "node:child_process";
const origin = "http://localhost:3000";
let full = "",
  other = "",
  userId = "";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = full,
  extra: Record<string, string> = {},
) {
  const headers: Record<string, string> = { origin, cookie, ...extra };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  return route(
    new Request(origin + "/api/v1/" + path, {
      method,
      headers,
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    }),
    path.split("/"),
  );
}
async function data<T>(response: Promise<Response>): Promise<T> {
  const r = await response;
  const json = await r.json();
  expect(r.status, JSON.stringify(json)).toBeLessThan(300);
  return json.data as T;
}
async function create(cookie = full) {
  return data<ApplicationDTO>(
    request("applications", "POST", { productCode: "WORKING_CAPITAL" }, cookie),
  );
}
async function fill(app: ApplicationDTO, cookie = full) {
  return data<ApplicationDTO>(
    request(
      `applications/${app.id}`,
      "PATCH",
      {
        expectedVersion: app.version,
        purpose: "Закупка сезонной партии товаров",
        requestedAmountRub: 2_000_000,
        termMonths: 12,
        monthlyRevenueRub: 1_200_000,
        monthlyOperatingExpensesRub: 600_000,
      },
      cookie,
    ),
  );
}
async function document(
  app: ApplicationDTO,
  type = "BANK_STATEMENT",
  bytes: string | Uint8Array = "%PDF-1.4\nsynthetic integration fixture",
  cookie = full,
  name = "sample.pdf",
  mime = "application/pdf",
) {
  const form = new FormData();
  form.set("type", type);
  form.set("expectedVersion", String(app.version));
  form.set(
    "file",
    new File(
      [typeof bytes === "string" ? bytes : new Uint8Array(bytes)],
      name,
      { type: mime },
    ),
  );
  return request(`applications/${app.id}/documents`, "POST", form, cookie);
}
async function ready(cookie = full) {
  let a = await fill(await create(cookie), cookie);
  await data(document(a, "BANK_STATEMENT", undefined, cookie));
  a = await data(request(`applications/${a.id}`, "GET", undefined, cookie));
  await data(document(a, "FINANCIAL_REPORT", undefined, cookie));
  return data<ApplicationDTO>(
    request(`applications/${a.id}`, "GET", undefined, cookie),
  );
}
beforeAll(async () => {
  // Setup independently guards the target before any destructive operation.
  await db().$executeRawUnsafe(
    'TRUNCATE TABLE "IdempotencyRecord", "ApplicationEvent", "CheckResult", "Offer", "EvaluationRun", "Document", "CreditApplication", "Session", "User", "Company" CASCADE',
  );
  for (const [alias, fixtureKey, inn] of [
    ["full", "full-offer", "9900000017"],
    ["reduced", "reduced-offer", "9900000024"],
  ]) {
    const c = await db().company.create({
      data: { legalName: `Synthetic ${alias}`, fixtureKey, inn },
    });
    await db().user.create({
      data: {
        email: `${alias}@demo.local`,
        passwordHash: await hashPassword("DemoCredit2026!"),
        companyId: c.id,
      },
    });
  }
  const first = await request(
    "auth/login",
    "POST",
    { email: "full@demo.local", password: "DemoCredit2026!" },
    "",
  );
  expect(first.status).toBe(200);
  full = first.headers.get("set-cookie")!.split(";")[0];
  userId = (await first.json()).data.id;
  const second = await request(
    "auth/login",
    "POST",
    { email: "reduced@demo.local", password: "DemoCredit2026!" },
    "",
  );
  other = second.headers.get("set-cookie")!.split(";")[0];
});
afterAll(async () => {
  await db().$disconnect();
});
it("I-19 seed is additive and preserves applications, files and sessions", async () => {
  const a = await ready();
  const before = await db().session.count();
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    { env: process.env, stdio: "pipe" },
  );
  const fresh = await data<ApplicationDTO>(request(`applications/${a.id}`));
  expect(fresh).toEqual(a);
  expect(await db().session.count()).toBe(before);
  expect((await request(`documents/${a.documents[0].id}`)).status).toBe(200);
});
it("Response DTOs match strict runtime contracts", async () => {
  const a = await ready();
  expect(applicationDTO.parse(a)).toEqual(a);
  const offered = await data<ApplicationDTO>(
    request(
      `applications/${a.id}/submit`,
      "POST",
      { expectedVersion: a.version },
      full,
      { "Idempotency-Key": randomUUID() },
    ),
  );
  expect(applicationDTO.parse(offered)).toEqual(offered);
  companyDTO.parse(await data(request("company")));
});
it("I-01 hashes sessions, sets cookie flags and revokes logout", async () => {
  const r = await request(
    "auth/login",
    "POST",
    { email: "full@demo.local", password: "DemoCredit2026!" },
    "",
  );
  const set = r.headers.get("set-cookie")!;
  expect(set).toContain("HttpOnly");
  expect(set).toContain("SameSite=Lax");
  expect(set).not.toContain("Secure");
  const c = set.split(";")[0],
    token = c.split("=")[1];
  const session = await db().session.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  expect(session!.tokenHash).not.toBe(token);
  expect(session!.tokenHash).toHaveLength(64);
  expect((await request("auth/logout", "POST", {}, c)).status).toBe(204);
  expect((await request("auth/me", "GET", undefined, c)).status).toBe(401);
});
it("I-02 denies foreign GET/PATCH", async () => {
  const a = await create();
  expect(
    (await request(`applications/${a.id}`, "GET", undefined, other)).status,
  ).toBe(404);
  expect(
    (
      await request(
        `applications/${a.id}`,
        "PATCH",
        { expectedVersion: 1, purpose: "Another purpose" },
        other,
      )
    ).status,
  ).toBe(404);
  expect(
    (await db().creditApplication.findUniqueOrThrow({ where: { id: a.id } }))
      .version,
  ).toBe(1);
});
it("I-03 denies foreign PDF download/delete", async () => {
  const a = await ready();
  const doc = a.documents[0];
  expect(
    (await request(`documents/${doc.id}`, "GET", undefined, other)).status,
  ).toBe(404);
  expect(
    (
      await request(
        `documents/${doc.id}`,
        "DELETE",
        { expectedVersion: a.version },
        other,
      )
    ).status,
  ).toBe(404);
  expect(
    (await db().document.findUniqueOrThrow({ where: { id: doc.id } })).active,
  ).toBe(true);
});
it.each(["", "https://evil.example"])(
  "I-04 rejects Origin %s before mutation",
  async (originValue) => {
    const count = await db().creditApplication.count();
    expect(
      (
        await request(
          "applications",
          "POST",
          { productCode: "WORKING_CAPITAL" },
          full,
          { origin: originValue },
        )
      ).status,
    ).toBe(403);
    expect(await db().creditApplication.count()).toBe(count);
  },
);
it("I-05 invalid submit rolls back version and all events", async () => {
  const a = await create();
  const r = await request(
    `applications/${a.id}/submit`,
    "POST",
    { expectedVersion: a.version },
    full,
    { "Idempotency-Key": randomUUID() },
  );
  expect(r.status).toBe(422);
  expect(
    await db().evaluationRun.count({ where: { applicationId: a.id } }),
  ).toBe(0);
  expect(
    await db().applicationEvent.count({ where: { applicationId: a.id } }),
  ).toBe(1);
  expect(
    (await db().creditApplication.findUniqueOrThrow({ where: { id: a.id } }))
      .version,
  ).toBe(1);
});
it("I-06 missing docs produces NEEDS_INFO exactly once", async () => {
  const a = await fill(await create());
  const result = await data<ApplicationDTO>(
    request(
      `applications/${a.id}/submit`,
      "POST",
      { expectedVersion: a.version },
      full,
      { "Idempotency-Key": randomUUID() },
    ),
  );
  expect(result.status).toBe("NEEDS_INFO");
  expect(result.version).toBe(a.version + 1);
  expect(
    await db().evaluationRun.count({ where: { applicationId: a.id } }),
  ).toBe(1);
});
it("I-07/08/09 replay, reused key and stale version", async () => {
  const a = await ready(),
    key = randomUUID(),
    path = `applications/${a.id}/submit`,
    body = { expectedVersion: a.version };
  const first = await data<ApplicationDTO>(
    request(path, "POST", body, full, { "Idempotency-Key": key }),
  );
  const second = await request(path, "POST", body, full, {
    "Idempotency-Key": key,
  });
  expect((await second.json()).meta.replayed).toBe(true);
  expect(
    await db().evaluationRun.count({ where: { applicationId: a.id } }),
  ).toBe(1);
  const conflict = await request(
    path,
    "POST",
    { expectedVersion: first.version },
    full,
    { "Idempotency-Key": key },
  );
  expect((await conflict.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  const stale = await request(path, "POST", body, full, {
    "Idempotency-Key": randomUUID(),
  });
  expect((await stale.json()).error.code).toBe("VERSION_CONFLICT");
});
it.each([false, true])(
  "I-10/11 concurrent submit same key=%s",
  async (same) => {
    const a = await ready(),
      key = randomUUID();
    const send = (k: string) =>
      request(
        `applications/${a.id}/submit`,
        "POST",
        { expectedVersion: a.version },
        full,
        { "Idempotency-Key": k },
      );
    const results = await Promise.all([
      send(key),
      send(same ? key : randomUUID()),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(
      same ? [200, 200] : [200, 409],
    );
    expect(
      await db().evaluationRun.count({ where: { applicationId: a.id } }),
    ).toBe(1);
    expect(await db().offer.count({ where: { applicationId: a.id } })).toBe(1);
  },
);
it("I-12 adapter failure rolls everything back", async () => {
  const a = await ready();
  const before = await db().applicationEvent.count({
    where: { applicationId: a.id },
  });
  await expect(
    submit(a.id, userId, a.version, randomUUID(), {
      ...localAdapters("full-offer"),
      bureau: async () => {
        throw new Error("offline");
      },
    }),
  ).rejects.toMatchObject({ status: 503 });
  expect(
    (await db().creditApplication.findUniqueOrThrow({ where: { id: a.id } }))
      .version,
  ).toBe(a.version);
  expect(await db().offer.count({ where: { applicationId: a.id } })).toBe(0);
  expect(
    await db().applicationEvent.count({ where: { applicationId: a.id } }),
  ).toBe(before);
});
it("I-13 replacing document preserves old hash/history", async () => {
  let a = await ready();
  const old = a.documents.find((d) => d.type === "BANK_STATEMENT")!;
  await data(document(a, "BANK_STATEMENT", "%PDF-1.4\nreplacement"));
  a = await data(request(`applications/${a.id}`));
  expect(a.documents).toHaveLength(2);
  expect(a.documents.find((d) => d.type === "BANK_STATEMENT")!.sha256).not.toBe(
    old.sha256,
  );
  expect(await db().document.count({ where: { applicationId: a.id } })).toBe(3);
  expect(
    (await db().document.findUniqueOrThrow({ where: { id: old.id } })).active,
  ).toBe(false);
});
it("I-14 rejects large and non-PDF files", async () => {
  const a = await create();
  expect(
    (await document(a, "BANK_STATEMENT", new Uint8Array(5 * 1024 * 1024 + 1)))
      .status,
  ).toBe(413);
  expect((await document(a, "BANK_STATEMENT", "not pdf")).status).toBe(415);
  expect(await db().document.count({ where: { applicationId: a.id } })).toBe(0);
});
it("I-15 reopen invalidates offer, preserving history", async () => {
  const a = await ready();
  const offered = await data<ApplicationDTO>(
    request(
      `applications/${a.id}/submit`,
      "POST",
      { expectedVersion: a.version },
      full,
      { "Idempotency-Key": randomUUID() },
    ),
  );
  const reopened = await data<ApplicationDTO>(
    request(`applications/${a.id}/reopen`, "POST", {
      expectedVersion: offered.version,
    }),
  );
  expect(reopened.status).toBe("DRAFT");
  expect(reopened.offer).toBeNull();
  expect(await db().offer.count({ where: { applicationId: a.id } })).toBe(1);
  const result = await request(
    `applications/${a.id}/offers/${offered.offer!.id}/accept`,
    "POST",
    { expectedVersion: reopened.version },
    full,
    { "Idempotency-Key": randomUUID() },
  );
  expect((await result.json()).error.code).toBe("INVALID_STATE");
});
it("I-16 expired offer cannot be accepted", async () => {
  const a = await ready();
  const o = await data<ApplicationDTO>(
    request(
      `applications/${a.id}/submit`,
      "POST",
      { expectedVersion: a.version },
      full,
      { "Idempotency-Key": randomUUID() },
    ),
  );
  await db().offer.update({
    where: { id: o.offer!.id },
    data: { expiresAt: new Date() },
  });
  const result = await request(
    `applications/${a.id}/offers/${o.offer!.id}/accept`,
    "POST",
    { expectedVersion: o.version },
    full,
    { "Idempotency-Key": randomUUID() },
  );
  expect((await result.json()).error.code).toBe("OFFER_EXPIRED");
  expect(
    (await db().offer.findUniqueOrThrow({ where: { id: o.offer!.id } }))
      .acceptedAt,
  ).toBeNull();
});
it("I-17/18 concurrent accept and final immutability", async () => {
  const a = await ready();
  const o = await data<ApplicationDTO>(
    request(
      `applications/${a.id}/submit`,
      "POST",
      { expectedVersion: a.version },
      full,
      { "Idempotency-Key": randomUUID() },
    ),
  );
  const send = () =>
    request(
      `applications/${a.id}/offers/${o.offer!.id}/accept`,
      "POST",
      { expectedVersion: o.version },
      full,
      { "Idempotency-Key": randomUUID() },
    );
  const result = await Promise.all([send(), send()]);
  expect(result.map((r) => r.status).sort()).toEqual([200, 409]);
  const accepted = await data<ApplicationDTO>(request(`applications/${a.id}`));
  expect(accepted.status).toBe("ACCEPTED");
  expect(accepted.events.filter((e) => e.type === "ACCEPTED")).toHaveLength(1);
  expect(
    (
      await request(`applications/${a.id}`, "PATCH", {
        expectedVersion: accepted.version,
        purpose: "cannot change",
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(`applications/${a.id}/reopen`, "POST", {
        expectedVersion: accepted.version,
      })
    ).status,
  ).toBe(409);
  expect((await document(accepted)).status).toBe(409);
});
it("I-20 DTO does not serialize private fields", async () => {
  const a = await ready();
  const text = JSON.stringify(a);
  for (const field of ["storageKey", "passwordHash", "fixtureKey", "tokenHash"])
    expect(text).not.toContain(field);
  const c = await request("company");
  expect(await c.text()).not.toContain("fixtureKey");
});
