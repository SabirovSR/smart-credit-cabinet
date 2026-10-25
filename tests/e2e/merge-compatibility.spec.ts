import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Войти в кабинет", exact: true })
    .click();
  await expect(page).toHaveURL(/dashboard/);
}

test("Theme and route animations preserve fields and the saved draft step", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: "light" });
  await login(page);
  await page.getByRole("link", { name: "Подать заявку", exact: true }).click();
  const purpose = "Закупка ассортимента к новому сезону";
  await page.getByLabel("Цель финансирования").fill(purpose);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const amount = page.getByLabel("Сумма кредита, ₽");
  await amount.fill("1700000");
  await page
    .getByRole("button", { name: "Включить тёмную тему", exact: true })
    .click();
  await expect(amount).toHaveValue("1700000");
  await expect(page.locator(".stepper button.current")).toContainText(
    "Параметры",
  );
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  const revenue = page.getByLabel("Среднемесячные поступления, ₽");
  await revenue.fill("1350000");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/applications\/[a-f0-9-]+\/edit$/);
  await expect(revenue).toHaveValue("1350000");
  await expect(page.locator(".stepper button.current")).toContainText(
    "Финансы",
  );
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(amount).toHaveValue("1700000");
  await page.reload();
  await expect(page.getByLabel("Цель финансирования")).toHaveValue(purpose);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(amount).toHaveValue("1700000");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(revenue).toHaveValue("1350000");
  expect(errors).toEqual([]);
});

test("Dark loading, navigation pill and mobile drawer work with theme motion", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page);
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/applications", async (route) => {
    await ready;
    await route.continue();
  });
  try {
    await page.goto("/dashboard");
    await expect(page.locator(".skeleton").first()).toBeVisible();
    await expect(page.locator(".skeleton-row .skeleton").first()).toHaveCSS(
      "background-color",
      "rgb(48, 49, 55)",
    );
    await page.screenshot({
      path: "test-results/merged-dark-loading.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".skeleton")
        .first()
        .evaluate(
          (element) => getComputedStyle(element, "::after").animationName,
        ),
    ).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
  } finally {
    release();
  }
  await expect(page.locator(".skeleton")).toHaveCount(0);
  await expect(page.locator(".nav-pill")).toHaveCSS(
    "background-color",
    "rgb(64, 35, 32)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>(".theme-toggle")!.click();
    document.querySelector<HTMLButtonElement>(".mobile-menu")!.click();
  });
  await expect(page.locator(".sidebar.open")).toBeVisible();
  await expect(page.locator(".mobile-menu")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(
    await page
      .locator(".sidebar")
      .evaluate((element) => getComputedStyle(element).transitionProperty),
  ).toContain("transform");
  await page.locator(".sidebar nav a[href='/applications']").click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(
    page.getByRole("button", { name: "Закрыть меню", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".sidebar nav a.active")).toHaveAttribute(
    "href",
    "/applications",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
