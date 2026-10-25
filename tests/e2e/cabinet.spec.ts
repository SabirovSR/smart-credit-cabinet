import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
async function login(page: Page, alias: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${alias}@demo.local`);
  await page.getByRole("button", { name: "Войти в кабинет" }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function create(page: Page) {
  await page.getByRole("link", { name: "Подать заявку" }).click();
  await page
    .getByLabel("Цель финансирования")
    .fill("Закупка товаров к зимнему сезону");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.getByLabel("Сумма кредита, ₽")).toHaveValue("2000000");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
}
async function upload(page: Page, label: string, file: string) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/documents") && r.request().method() === "POST",
  );
  await page
    .getByLabel(label, { exact: true })
    .setInputFiles(path.resolve("public/demo-documents", file));
  expect((await response).status()).toBe(201);
  await expect(
    page.getByRole("button", { name: "Отправить заявку" }),
  ).toBeEnabled();
}
async function send(page: Page) {
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page).toHaveURL(/\/applications\/[a-f0-9-]+$/);
}
test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
test("E2E-01 full offer accepted, reload and PDF persistence", async ({
  page,
}) => {
  await login(page, "full");
  await create(page);
  await upload(page, "Выписка по счёту", "bank-statement.pdf");
  await upload(page, "Финансовый отчёт", "financial-report.pdf");
  await send(page);
  await expect(
    page.getByRole("heading", { name: "Для вашего дела есть предложение" }),
  ).toBeVisible();
  const accept = page.getByRole("button", { name: "Принять условия" });
  await expect(accept).toBeDisabled();
  await page.getByRole("checkbox").check();
  await accept.click();
  await expect(
    page.getByRole("heading", { name: "Следующий шаг сделан" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Следующий шаг сделан" }),
  ).toBeVisible();
  const href = await page
    .getByRole("link")
    .filter({ hasText: "Выписка по счёту" })
    .getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
test("E2E-02 reduced offer 1.4m", async ({ page }) => {
  await login(page, "reduced");
  await create(page);
  await upload(page, "Выписка по счёту", "bank-statement.pdf");
  await upload(page, "Финансовый отчёт", "financial-report.pdf");
  await send(page);
  await expect(
    page.getByRole("heading", { name: /1\s400\s000/ }),
  ).toBeVisible();
  await expect(
    page.getByText("ПРЕДЛОЖЕНИЕ МЕНЬШЕЙ СУММЫ", { exact: true }),
  ).toBeVisible();
});
test("E2E-03 missing PDF then second submission", async ({ page }) => {
  await login(page, "clarify");
  await create(page);
  await upload(page, "Выписка по счёту", "bank-statement.pdf");
  await send(page);
  await expect(
    page.getByRole("heading", { name: "Не хватает документов" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Добавить документы" }).click();
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await upload(page, "Финансовый отчёт", "financial-report.pdf");
  await send(page);
  await expect(
    page.getByRole("heading", { name: "Для вашего дела есть предложение" }),
  ).toBeVisible();
  await expect(
    page.getByText("Заявка отправлена на автоматическую проверку", {
      exact: true,
    }),
  ).toHaveCount(2);
});
test("E2E-04 rejection explains current overdue", async ({ page }) => {
  await login(page, "reject");
  await create(page);
  await upload(page, "Выписка по счёту", "bank-statement.pdf");
  await upload(page, "Финансовый отчёт", "financial-report.pdf");
  await send(page);
  await expect(
    page.getByRole("heading", { name: "Пока не можем предложить кредит" }),
  ).toBeVisible();
  await expect(
    page.getByText(/есть просрочка от 30 дней/).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Принять условия" }),
  ).toHaveCount(0);
});
test("E2E-05 foreign direct URL and PDF are denied", async ({
  page,
  browser,
}) => {
  await login(page, "full");
  await create(page);
  await upload(page, "Выписка по счёту", "bank-statement.pdf");
  await send(page);
  const url = page.url();
  const href = await page
    .getByRole("link")
    .filter({ hasText: "Выписка по счёту" })
    .getAttribute("href");
  const context = await browser.newContext();
  const second = await context.newPage();
  await login(second, "reduced");
  await second.goto(url);
  await expect(
    second.getByRole("alert").filter({ hasText: "Заявка не найдена" }),
  ).toContainText("Заявка не найдена");
  const response = await second.request.get(href!);
  expect(response.status()).toBe(404);
  await context.close();
});
test("Mobile layout and field validation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "full");
  await expect(
    page.getByRole("button", { name: "Меню", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Подать заявку" }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(
    page.getByText("Опишите цель: от 10 до 1000 символов"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Для чего нужно финансирование?" }),
  ).toBeVisible();
});
