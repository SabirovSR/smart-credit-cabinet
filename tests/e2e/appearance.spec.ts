import { test, expect } from "@playwright/test";
import { demoScenarios } from "../../src/lib/demo-scenarios";

test("Demo accounts explain their scenarios before and after login", async ({
  page,
}) => {
  for (const scenario of demoScenarios) {
    await page.goto("/login");
    const account = page.getByRole("button", {
      name: `${scenario.title} ${scenario.company}`,
      exact: true,
    });
    await account.click();
    await expect(account).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      `${scenario.alias}@demo.local`,
    );
    await expect(page.locator(".scenario-preview")).toContainText(
      scenario.steps,
    );
    await page
      .getByRole("button", { name: "Войти в кабинет", exact: true })
      .click();
    await expect(page).toHaveURL(/dashboard/);
    const guide = page.getByRole("region", { name: "Ваш демосценарий" });
    await expect(guide).toContainText(scenario.title);
    await expect(guide).toContainText(scenario.steps);
    await guide.getByRole("button").click();
    await expect(
      guide.getByText(scenario.steps, { exact: false }),
    ).toBeHidden();
    await page.getByRole("button", { name: "Выйти", exact: true }).click();
    await expect(page).toHaveURL(/login/);
  }
});

test("Dark theme follows system, persists, and covers the cabinet and mobile form", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".login-page")).toHaveCSS(
    "background-color",
    "rgb(32, 33, 36)",
  );
  await page.screenshot({
    path: "test-results/login-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Включить светлую тему", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".login-story")).toHaveCSS(
    "background-color",
    "rgb(236, 48, 39)",
  );
  await page.screenshot({
    path: "test-results/login-light.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Включить тёмную тему", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Войти в кабинет", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".topbar")).toHaveCSS(
    "background-color",
    "rgb(32, 33, 36)",
  );
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Подать заявку", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".form-card")).toBeVisible();
  await expect(page.locator(".form-card")).toHaveCSS(
    "background-color",
    "rgb(32, 33, 36)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/form-dark-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Включить светлую тему", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("Theme switch remains usable when localStorage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Включить тёмную тему", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
