CREATE UNIQUE INDEX "Document_one_active_type" ON "Document" ("applicationId", "type") WHERE "active" = true;
CREATE UNIQUE INDEX "Offer_one_accepted" ON "Offer" ("applicationId") WHERE "acceptedAt" IS NOT NULL;
ALTER TABLE "CreditApplication" ADD CONSTRAINT "application_version_positive" CHECK ("version" > 0);
ALTER TABLE "CreditApplication" ADD CONSTRAINT "application_amount_range" CHECK ("requestedAmountRub" IS NULL OR "requestedAmountRub" BETWEEN 500000 AND 5000000);
ALTER TABLE "CreditApplication" ADD CONSTRAINT "application_term_range" CHECK ("termMonths" IS NULL OR "termMonths" BETWEEN 6 AND 24);
ALTER TABLE "CreditApplication" ADD CONSTRAINT "application_revenue_range" CHECK ("monthlyRevenueRub" IS NULL OR "monthlyRevenueRub" BETWEEN 0 AND 1000000000);
ALTER TABLE "CreditApplication" ADD CONSTRAINT "application_expenses_range" CHECK ("monthlyOperatingExpensesRub" IS NULL OR "monthlyOperatingExpensesRub" BETWEEN 0 AND 1000000000);
