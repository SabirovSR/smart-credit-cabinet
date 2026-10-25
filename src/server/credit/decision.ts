import {
  calculatePayment,
  affordable,
  findAffordableAmount,
} from "./calculator";
import { policy } from "./policy";
export type CreditInput = {
  requestedAmountRub: number;
  termMonths: number;
  monthlyRevenueRub: number;
  monthlyOperatingExpensesRub: number;
};
export type Registry = {
  status: "ACTIVE" | "INACTIVE";
  source: "LOCAL_MOCK";
  checkedAt: string;
};
export type Bureau = {
  existingMonthlyDebtPaymentRub: number;
  currentOverdueDays: number;
  source: "LOCAL_MOCK";
  checkedAt: string;
};
export type Adapters = {
  registry: () => Promise<Registry>;
  bureau: () => Promise<Bureau>;
};
export const reasons: Record<string, string> = {
  MISSING_DOCUMENTS:
    "Для рассмотрения загрузите выписку по счёту и финансовый отчёт.",
  COMPANY_INACTIVE: "По данным демонстрационного реестра компания неактивна.",
  CURRENT_OVERDUE:
    "В демонстрационной кредитной истории есть просрочка от 30 дней.",
  NON_POSITIVE_CASH_FLOW: "Расходы равны поступлениям или превышают их.",
  LOWER_AMOUNT_AVAILABLE:
    "Предложили меньшую сумму, чтобы платёж соответствовал денежному потоку компании.",
  INSUFFICIENT_PAYMENT_CAPACITY:
    "Денежного потока недостаточно для минимальной суммы кредита.",
};
export async function evaluate(
  input: CreditInput,
  documents: string[],
  adapters: Adapters,
) {
  const checks: {
    type: string;
    status: string;
    details: Record<string, string | number | string[]>;
  }[] = [];
  const missing = ["BANK_STATEMENT", "FINANCIAL_REPORT"].filter(
    (x) => !documents.includes(x),
  );
  checks.push({
    type: "COMPLETENESS",
    status: missing.length ? "REQUIRES_INPUT" : "PASS",
    details: { missingDocumentTypes: missing },
  });
  const finish = (
    outcome: string,
    codes: string[],
    amount = 0,
    sources: object = {},
  ) => ({
    outcome,
    reasons: codes.map((code) => ({
      code,
      message: reasons[code],
      field: null,
    })),
    checks,
    calculation: amount ? calculatePayment(amount, input.termMonths) : null,
    sources,
  });
  if (missing.length) return finish("NEEDS_INFO", ["MISSING_DOCUMENTS"]);
  const registry = await adapters.registry();
  checks.push({
    type: "REGISTRY",
    status: registry.status === "ACTIVE" ? "PASS" : "FAIL",
    details: { ...registry },
  });
  if (registry.status !== "ACTIVE")
    return finish("REJECTED", ["COMPANY_INACTIVE"], 0, { registry });
  const bureau = await adapters.bureau();
  checks.push({
    type: "CREDIT_HISTORY",
    status: bureau.currentOverdueDays >= policy.overdueDays ? "FAIL" : "PASS",
    details: { ...bureau },
  });
  if (bureau.currentOverdueDays >= policy.overdueDays)
    return finish("REJECTED", ["CURRENT_OVERDUE"], 0, { registry, bureau });
  const cash = input.monthlyRevenueRub - input.monthlyOperatingExpensesRub;
  const payment = calculatePayment(
    input.requestedAmountRub,
    input.termMonths,
  ).monthlyPaymentRub;
  const passes = affordable(
    cash,
    bureau.existingMonthlyDebtPaymentRub,
    payment,
  );
  checks.push({
    type: "AFFORDABILITY",
    status: passes ? "PASS" : "FAIL",
    details: {
      cashFlowRub: cash,
      existingMonthlyDebtPaymentRub: bureau.existingMonthlyDebtPaymentRub,
      requestedPaymentRub: payment,
      availableNewPaymentRub: Math.max(
        0,
        Math.floor((cash * 5) / 6) - bureau.existingMonthlyDebtPaymentRub,
      ),
    },
  });
  if (cash <= 0)
    return finish("REJECTED", ["NON_POSITIVE_CASH_FLOW"], 0, {
      registry,
      bureau,
    });
  if (passes)
    return finish("FULL_OFFER", [], input.requestedAmountRub, {
      registry,
      bureau,
    });
  const amount = findAffordableAmount(
    input.requestedAmountRub,
    input.termMonths,
    cash,
    bureau.existingMonthlyDebtPaymentRub,
  );
  return amount
    ? finish("REDUCED_OFFER", ["LOWER_AMOUNT_AVAILABLE"], amount, {
        registry,
        bureau,
      })
    : finish("REJECTED", ["INSUFFICIENT_PAYMENT_CAPACITY"], 0, {
        registry,
        bureau,
      });
}
