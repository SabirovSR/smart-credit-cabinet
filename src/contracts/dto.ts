import { z } from "zod";
const id = z.uuid(),
  time = z.iso.datetime(),
  money = z.number().int(),
  text = z.string();
export const userDTO = z
  .object({ id, email: z.email(), companyId: id })
  .strict();
export const companyDTO = z
  .object({
    id,
    legalName: text,
    inn: text,
    legalForm: text,
    okved: text,
    industry: text,
    demoDefaults: z
      .object({ monthlyRevenueRub: money, monthlyOperatingExpensesRub: money })
      .strict()
      .nullable(),
  })
  .strict();
export const documentDTO = z
  .object({
    id,
    applicationId: id,
    type: z.enum(["BANK_STATEMENT", "FINANCIAL_REPORT"]),
    originalName: text,
    mimeType: z.literal("application/pdf"),
    sizeBytes: money,
    sha256: text,
    active: z.boolean(),
    createdAt: time,
  })
  .strict();
export const offerDTO = z
  .object({
    id,
    kind: z.enum(["FULL", "REDUCED"]),
    applicationVersion: money,
    amountRub: money,
    termMonths: money,
    annualRateBps: money,
    monthlyPaymentRub: money,
    totalRepaymentRub: money,
    expiresAt: time,
    acceptedAt: time.nullable(),
    expired: z.boolean(),
  })
  .strict();
export const applicationDTO = z
  .object({
    id,
    companyId: id,
    productCode: z.literal("WORKING_CAPITAL"),
    purpose: text,
    status: z.enum(["DRAFT", "NEEDS_INFO", "OFFERED", "REJECTED", "ACCEPTED"]),
    version: money,
    requestedAmountRub: money.nullable(),
    termMonths: money.nullable(),
    monthlyRevenueRub: money.nullable(),
    monthlyOperatingExpensesRub: money.nullable(),
    createdAt: time,
    updatedAt: time,
    documents: z.array(documentDTO),
    offer: offerDTO.nullable(),
    latestEvaluation: z
      .object({
        id,
        inputVersion: money,
        resultVersion: money,
        policyVersion: text,
        outcome: z.enum([
          "NEEDS_INFO",
          "FULL_OFFER",
          "REDUCED_OFFER",
          "REJECTED",
        ]),
        reasons: z.array(
          z
            .object({ code: text, message: text, field: text.nullable() })
            .strict(),
        ),
        checks: z.array(
          z
            .object({
              type: text,
              status: text,
              message: text,
              details: z.unknown(),
            })
            .strict(),
        ),
        createdAt: time,
      })
      .strict()
      .nullable(),
    events: z.array(
      z
        .object({
          id,
          type: text,
          actor: z.enum(["CLIENT", "SYSTEM"]),
          message: text,
          sequence: money,
          createdAt: time,
        })
        .strict(),
    ),
  })
  .strict();
