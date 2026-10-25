export const policy = {
  version: "demo-credit-v1",
  minAmount: 500_000,
  maxAmount: 5_000_000,
  minTerm: 6,
  maxTerm: 24,
  annualRateBps: 2000,
  amountStep: 10_000,
  offerHours: 24,
  overdueDays: 30,
} as const;
export const product = {
  code: "WORKING_CAPITAL",
  name: "Оборотный кредит",
  currency: "RUB",
  minAmountRub: policy.minAmount,
  maxAmountRub: policy.maxAmount,
  minTermMonths: policy.minTerm,
  maxTermMonths: policy.maxTerm,
  annualRateBps: policy.annualRateBps,
  requiredDocumentTypes: ["BANK_STATEMENT", "FINANCIAL_REPORT"],
};
