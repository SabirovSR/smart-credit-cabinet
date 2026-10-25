import type { Adapters } from "../credit/decision";
export function localAdapters(fixture: string): Adapters {
  return {
    registry: async () => ({
      status: "ACTIVE",
      source: "LOCAL_MOCK",
      checkedAt: new Date().toISOString(),
    }),
    bureau: async () => ({
      existingMonthlyDebtPaymentRub:
        fixture === "reduced-offer" ? 70_000 : 50_000,
      currentOverdueDays: fixture === "rejection" ? 45 : 0,
      source: "LOCAL_MOCK",
      checkedAt: new Date().toISOString(),
    }),
  };
}
