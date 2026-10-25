import { describe, it, expect, vi } from "vitest";
import {
  calculatePayment,
  affordable,
  findAffordableAmount,
} from "@/server/credit/calculator";
import { evaluate, type Adapters } from "@/server/credit/decision";
import { localAdapters } from "@/server/integrations/adapters";
import { canTransition } from "@/server/credit/state-machine";
import { news } from "@/server/news/service";
const input = {
  requestedAmountRub: 2_000_000,
  termMonths: 12,
  monthlyRevenueRub: 1_200_000,
  monthlyOperatingExpensesRub: 600_000,
};
const docs = ["BANK_STATEMENT", "FINANCIAL_REPORT"];
describe("credit arithmetic", () => {
  it("U-01 rounds the annuity upward", () => {
    expect(calculatePayment(2_000_000, 12)).toMatchObject({
      monthlyPaymentRub: 185270,
      totalRepaymentRub: 2223240,
      interestRub: 223240,
    });
  });
  it("U-02 supports zero interest", () => {
    expect(calculatePayment(1000, 3, 0).monthlyPaymentRub).toBe(334);
  });
  it.each([
    [0, 12, 2000],
    [1, 0, 2000],
    [1, 2, -1],
    [1.5, 2, 2000],
    [1, 1.5, 2000],
  ])("rejects invalid input %s %s %s", (a, n, r) =>
    expect(() => calculatePayment(a, n, r)).toThrow(RangeError),
  );
  it("U-03 includes exact coverage boundary", () => {
    expect(affordable(120, 50, 50)).toBe(true);
    expect(affordable(119, 50, 50)).toBe(false);
  });
  it("U-05 finds the maximal affordable step", () => {
    const amount = findAffordableAmount(2_000_000, 12, 240_000, 70_000);
    expect(amount).toBe(1_400_000);
    expect(
      affordable(
        240_000,
        70_000,
        calculatePayment(amount, 12).monthlyPaymentRub,
      ),
    ).toBe(true);
    expect(
      affordable(
        240_000,
        70_000,
        calculatePayment(amount + 10_000, 12).monthlyPaymentRub,
      ),
    ).toBe(false);
  });
});
describe("decision", () => {
  it("U-04 full offer", async () => {
    expect(
      (await evaluate(input, docs, localAdapters("full-offer"))).outcome,
    ).toBe("FULL_OFFER");
  });
  it("U-05 reduced offer", async () => {
    expect(
      (
        await evaluate(
          {
            ...input,
            monthlyRevenueRub: 500_000,
            monthlyOperatingExpensesRub: 260_000,
          },
          docs,
          localAdapters("reduced-offer"),
        )
      ).calculation?.amountRub,
    ).toBe(1_400_000);
  });
  it("U-06 completeness precedes external adapters", async () => {
    const registry = vi.fn(),
      bureau = vi.fn();
    const result = await evaluate(input, ["BANK_STATEMENT"], {
      registry,
      bureau,
    });
    expect(result.outcome).toBe("NEEDS_INFO");
    expect(result.checks[0].details.missingDocumentTypes).toEqual([
      "FINANCIAL_REPORT",
    ]);
    expect(registry).not.toHaveBeenCalled();
    expect(bureau).not.toHaveBeenCalled();
  });
  it.each([29, 30])("U-07 overdue boundary %s", async (days) => {
    const base = localAdapters("full-offer");
    const adapters: Adapters = {
      ...base,
      bureau: async () => ({
        ...(await base.bureau()),
        currentOverdueDays: days,
      }),
    };
    expect((await evaluate(input, docs, adapters)).outcome).toBe(
      days === 30 ? "REJECTED" : "FULL_OFFER",
    );
  });
  it.each([0, -10])("U-08 non-positive cash flow %s", async (cash) => {
    const result = await evaluate(
      { ...input, monthlyRevenueRub: 600_000 + cash },
      docs,
      localAdapters("full-offer"),
    );
    expect(result.reasons[0].code).toBe("NON_POSITIVE_CASH_FLOW");
    expect(result.calculation).toBeNull();
  });
  it("U-09 no minimum affordable", async () => {
    const result = await evaluate(
      { ...input, monthlyRevenueRub: 600_001 },
      docs,
      localAdapters("full-offer"),
    );
    expect(result.reasons[0].code).toBe("INSUFFICIENT_PAYMENT_CAPACITY");
    expect(result.calculation).toBeNull();
  });
  it("U-10 inactive company", async () => {
    const base = localAdapters("full-offer");
    const result = await evaluate(input, docs, {
      ...base,
      registry: async () => ({
        ...(await base.registry()),
        status: "INACTIVE",
      }),
    });
    expect(result.reasons[0].code).toBe("COMPANY_INACTIVE");
  });
  it("reject fixture has current overdue", async () =>
    expect(
      (await evaluate(input, docs, localAdapters("rejection"))).reasons[0].code,
    ).toBe("CURRENT_OVERDUE"));
});
it("U-11 validates all state transitions", () => {
  for (const action of ["edit", "submit", "reopen", "accept"] as const)
    expect(canTransition("ACCEPTED", action)).toBe(false);
  expect(canTransition("DRAFT", "edit")).toBe(true);
  expect(canTransition("NEEDS_INFO", "submit")).toBe(true);
  expect(canTransition("REJECTED", "reopen")).toBe(true);
  expect(canTransition("OFFERED", "accept")).toBe(true);
  expect(canTransition("DRAFT", "reopen")).toBe(false);
});
it("U-12 feed changes deterministically without duplicates", () => {
  expect(news("NEEDS_INFO")[0].id).toBe("prepare-documents");
  expect(news("OFFERED")[0].id).toBe("accept-offer");
  expect(news("REJECTED")[0].id).toBe("after-rejection");
  expect(news("ACCEPTED")).toEqual(news());
  expect(new Set(news().map((a) => a.id)).size).toBe(4);
});
