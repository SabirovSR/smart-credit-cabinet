import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/server/auth/password";
const prisma = new PrismaClient({adapter: new PrismaPg({connectionString: process.env.DATABASE_URL})});
try {
  if (process.env.DEMO_MODE !== "false") {
    const fixtures = [
      ["full-offer", "full", "ООО «Северная лавка»", "9900000017"],
      ["reduced-offer", "reduced", "ООО «Точка роста»", "9900000024"],
      ["clarification", "clarify", "ООО «Городской маркет»", "9900000031"],
      ["rejection", "reject", "ООО «Торговый квартал»", "9900000049"],
    ];
    for (const [fixtureKey, alias, legalName, inn] of fixtures) {
      const company = await prisma.company.upsert({where: {fixtureKey}, update: {}, create: {fixtureKey, legalName, inn}});
      await prisma.user.upsert({where: {email: `${alias}@demo.local`}, update: {}, create: {email: `${alias}@demo.local`, companyId: company.id, passwordHash: await hashPassword("DemoCredit2026!")}});
    }
    console.log("Demo fixtures ensured (existing data preserved).");
  }
} finally { await prisma.$disconnect(); }
