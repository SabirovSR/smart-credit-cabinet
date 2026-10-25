import { z } from "zod";
export const amount = z.number().int().min(500_000).max(5_000_000);
export const term = z.number().int().min(6).max(24);
const money = z.number().int().min(0).max(1_000_000_000);
export const versionSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const draftSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    purpose: z.string().max(1000).optional(),
    requestedAmountRub: amount.nullable().optional(),
    termMonths: term.nullable().optional(),
    monthlyRevenueRub: money.nullable().optional(),
    monthlyOperatingExpensesRub: money.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 1, "Укажите хотя бы одно поле");
export const submitSchema = z.object({
  purpose: z.string().trim().min(10).max(1000),
  requestedAmountRub: amount,
  termMonths: term,
  monthlyRevenueRub: money,
  monthlyOperatingExpensesRub: money,
});
export const calculationSchema = z
  .object({ amountRub: amount, termMonths: term })
  .strict();
export const loginSchema = z
  .object({ email: z.email().max(254), password: z.string().min(1).max(200) })
  .strict();
export const createSchema = z
  .object({ productCode: z.literal("WORKING_CAPITAL") })
  .strict();
export const documentTypeSchema = z.enum([
  "BANK_STATEMENT",
  "FINANCIAL_REPORT",
]);
export type ReasonDTO = { code: string; message: string; field: string | null };
export type DocumentDTO = {
  id: string;
  applicationId: string;
  type: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  active: boolean;
  createdAt: string;
};
export type OfferDTO = {
  id: string;
  kind: string;
  applicationVersion: number;
  amountRub: number;
  termMonths: number;
  annualRateBps: number;
  monthlyPaymentRub: number;
  totalRepaymentRub: number;
  expiresAt: string;
  acceptedAt: string | null;
  expired: boolean;
};
export type ApplicationDTO = {
  id: string;
  companyId: string;
  productCode: string;
  purpose: string;
  status: string;
  version: number;
  requestedAmountRub: number | null;
  termMonths: number | null;
  monthlyRevenueRub: number | null;
  monthlyOperatingExpensesRub: number | null;
  createdAt: string;
  updatedAt: string;
  documents: DocumentDTO[];
  offer: OfferDTO | null;
  latestEvaluation: {
    id: string;
    inputVersion: number;
    resultVersion: number;
    policyVersion: string;
    outcome: string;
    reasons: ReasonDTO[];
    checks: {
      type: string;
      status: string;
      message: string;
      details: unknown;
    }[];
    createdAt: string;
  } | null;
  events: {
    id: string;
    type: string;
    actor: string;
    message: string;
    sequence: number;
    createdAt: string;
  }[];
};
