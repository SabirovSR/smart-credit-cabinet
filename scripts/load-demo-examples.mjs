// Loads the four showcase applications into a running cabinet instance so the
// stand is not an empty list:
//
//   node scripts/load-demo-examples.mjs
//   BASE_URL=https://smart-credit-cabinet.sabirov.tech node scripts/load-demo-examples.mjs
//
// Reruns are harmless: an example is recognised by its purpose text, and the
// submit carries a fixed Idempotency-Key, so nothing gets duplicated. Existing
// applications of the demo users are never modified.
import fs from "node:fs/promises";
import crypto from "node:crypto";

const origin = (
    process.argv[2] ??
    process.env.BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, ""),
  password = process.env.DEMO_PASSWORD ?? "DemoCredit2026!",
  samples = {
    BANK_STATEMENT: "bank-statement.pdf",
    FINANCIAL_REPORT: "financial-report.pdf",
  },
  examples = [
    {
      alias: "full",
      purpose: "Демо-заявка: закупка партии товаров к зимнему сезону",
      requestedAmountRub: 2_000_000,
      termMonths: 12,
      monthlyRevenueRub: 1_200_000,
      monthlyOperatingExpensesRub: 600_000,
      documents: ["BANK_STATEMENT", "FINANCIAL_REPORT"],
      // Fixed keys keep a rerun a replay instead of a second decision.
      submitKey: "bef9da19-f3bb-4bca-a31e-fabc2b2bc327",
    },
    {
      alias: "reduced",
      purpose: "Демо-заявка: расширение ассортимента на двух торговых точках",
      requestedAmountRub: 2_000_000,
      termMonths: 12,
      // Same prefill the cabinet offers this account, which is what turns the
      // decision into a reduced offer.
      monthlyRevenueRub: 500_000,
      monthlyOperatingExpensesRub: 260_000,
      documents: ["BANK_STATEMENT", "FINANCIAL_REPORT"],
      submitKey: "ed2ae508-36ee-49af-a0fa-f5da9b0a8a3d",
    },
    {
      alias: "clarify",
      purpose: "Демо-заявка: пополнение оборотных запасов перед сезоном",
      requestedAmountRub: 1_600_000,
      termMonths: 9,
      monthlyRevenueRub: 1_200_000,
      monthlyOperatingExpensesRub: 600_000,
      // One document short: the stand then shows the "add documents" step.
      documents: ["BANK_STATEMENT"],
      submitKey: "8b88ce56-12eb-44dc-ae8c-c395efb17291",
    },
    {
      alias: "reject",
      purpose: "Демо-заявка: обновление оборудования на новой точке",
      requestedAmountRub: 2_400_000,
      termMonths: 18,
      monthlyRevenueRub: 1_200_000,
      monthlyOperatingExpensesRub: 600_000,
      documents: ["BANK_STATEMENT", "FINANCIAL_REPORT"],
      submitKey: "d07dc0d7-788d-4e75-b082-401356318c38",
    },
  ];

async function call(path, cookie, init = {}) {
  const response = await fetch(origin + "/api/v1" + path, {
    ...init,
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${path}: unexpected ${response.status} response`);
  }
  if (!response.ok)
    throw new Error(
      `${path}: ${response.status} ${payload.error?.code ?? ""} ${payload.error?.message ?? text.slice(0, 120)}`,
    );
  return payload.data;
}

async function signIn(email) {
  const response = await fetch(origin + "/api/v1/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!response.ok || !cookie)
    throw new Error(
      `login ${email}: ${response.status} ${(await response.text()).slice(0, 120)}`,
    );
  return cookie;
}

async function listing(cookie) {
  const items = [];
  let cursor = null;
  do {
    const page = await call(
      "/applications" + (cursor ? `?cursor=${cursor}` : ""),
      cookie,
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

/**
 * A demo offer lives 24h. When the example is already there but its offer has
 * run out, put it back through the decision once so the next visitor still
 * finds something actionable instead of "срок предложения истёк".
 */
async function renew(cookie, seen) {
  const app = await call(`/applications/${seen.id}`, cookie);
  if (app.status !== "OFFERED" || !app.offer?.expired)
    return `${app.status} (already there, id ${app.id.slice(0, 8)})`;
  const reopened = await call(`/applications/${app.id}/reopen`, cookie, {
    method: "POST",
    body: JSON.stringify({ expectedVersion: app.version }),
  });
  const decision = await call(`/applications/${app.id}/submit`, cookie, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ expectedVersion: reopened.version }),
  });
  return `${decision.status} (offer renewed, id ${app.id.slice(0, 8)})`;
}

async function run(example) {
  const email = `${example.alias}@demo.local`,
    cookie = await signIn(email),
    seen = (await listing(cookie)).find(
      (item) => item.purpose === example.purpose,
    );
  if (seen) return renew(cookie, seen);
  let app = await call("/applications", cookie, {
    method: "POST",
    body: JSON.stringify({ productCode: "WORKING_CAPITAL" }),
  });
  app = await call(`/applications/${app.id}`, cookie, {
    method: "PATCH",
    body: JSON.stringify({
      expectedVersion: app.version,
      purpose: example.purpose,
      requestedAmountRub: example.requestedAmountRub,
      termMonths: example.termMonths,
      monthlyRevenueRub: example.monthlyRevenueRub,
      monthlyOperatingExpensesRub: example.monthlyOperatingExpensesRub,
    }),
  });
  for (const type of example.documents) {
    const bytes = await fs.readFile(
      new URL(`../public/demo-documents/${samples[type]}`, import.meta.url),
    );
    const form = new FormData();
    form.set("expectedVersion", String(app.version));
    form.set("type", type);
    form.set(
      "file",
      new Blob([bytes], { type: "application/pdf" }),
      `${type.toLowerCase()}.pdf`,
    );
    await call(`/applications/${app.id}/documents`, cookie, {
      method: "POST",
      body: form,
    });
    app = await call(`/applications/${app.id}`, cookie);
  }
  app = await call(`/applications/${app.id}/submit`, cookie, {
    method: "POST",
    headers: { "Idempotency-Key": example.submitKey },
    body: JSON.stringify({ expectedVersion: app.version }),
  });
  const decision = app.offer
    ? `offer ${app.offer.amountRub.toLocaleString("ru-RU")} RUB / ${app.offer.monthlyPaymentRub.toLocaleString("ru-RU")} RUB a month`
    : (app.latestEvaluation?.reasons ?? [])
        .map((reason) => reason.code)
        .join(", ");
  return `${app.status} (id ${app.id.slice(0, 8)}; ${decision})`;
}

console.log(`Loading demo applications into ${origin}`);
let failed = 0;
for (const example of examples) {
  try {
    console.log(`${example.alias.padEnd(8)} ${await run(example)}`);
  } catch (error) {
    failed += 1;
    console.error(`${example.alias.padEnd(8)} ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
