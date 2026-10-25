// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ApplicationForm } from "@/components/application-form";
import { ApplicationDetail } from "@/components/application-detail";
import { api, ClientError } from "@/lib/api-client";
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/api-client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...original, api: vi.fn() };
});
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
const company = {
  legalName: "Demo",
  inn: "9900000017",
  demoDefaults: {
    monthlyRevenueRub: 1200000,
    monthlyOperatingExpensesRub: 600000,
  },
};
const app = {
  id: "test",
  purpose: "Сезонная закупка",
  status: "OFFERED",
  version: 5,
  requestedAmountRub: 2000000,
  termMonths: 12,
  monthlyRevenueRub: 500000,
  monthlyOperatingExpensesRub: 260000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  documents: [],
  events: [],
  latestEvaluation: null,
  offer: {
    id: "offer",
    kind: "REDUCED",
    applicationVersion: 5,
    amountRub: 1400000,
    termMonths: 12,
    annualRateBps: 2000,
    monthlyPaymentRub: 129689,
    totalRepaymentRub: 1556268,
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    acceptedAt: null,
    expired: false,
  },
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("UI-01 validation prevents advancing empty purpose", async () => {
  vi.mocked(api).mockImplementation(async (path) =>
    path === "/company" ? company : { monthlyPaymentRub: 185270 },
  );
  render(<ApplicationForm />);
  await screen.findByLabelText("Цель финансирования");
  fireEvent.click(screen.getByRole("button", { name: "Продолжить" }));
  expect(
    await screen.findByText("Опишите цель: от 10 до 1000 символов"),
  ).toBeVisible();
  expect(vi.mocked(api).mock.calls.some((c) => c[0] === "/applications")).toBe(
    false,
  );
});
it("UI-02 pending acceptance disables controls", async () => {
  vi.mocked(api).mockImplementation(async (_path, options) =>
    options?.method === "POST" ? new Promise(() => {}) : app,
  );
  render(<ApplicationDetail id="test" />);
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Принять условия" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled(),
  );
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
it("UI-03 shows requested and reduced amounts with reason", async () => {
  vi.mocked(api).mockResolvedValue(app);
  render(<ApplicationDetail id="test" />);
  expect(await screen.findByText(/Вы запросили/)).toHaveTextContent(
    /2\s000\s000.*1\s400\s000/,
  );
  expect(screen.getByText(/Вы запросили/)).toHaveTextContent(
    "денежному потоку",
  );
});
it("UI-04 conflict refreshes data and clears acceptance", async () => {
  let reads = 0;
  vi.mocked(api).mockImplementation(async (_path, options) => {
    if (options?.method === "POST")
      throw new ClientError("VERSION_CONFLICT", "Заявка уже изменена.");
    reads++;
    return { ...app, version: reads > 1 ? 6 : 5 };
  });
  render(<ApplicationDetail id="test" />);
  await screen.findByRole("checkbox");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Принять условия" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Заявка уже изменена.",
  );
  await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
  expect(reads).toBe(2);
});
