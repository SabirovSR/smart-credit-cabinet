import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "./config";
const globalDb = globalThis as unknown as { creditDb?: PrismaClient };
export const db = () =>
  (globalDb.creditDb ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: config().DATABASE_URL }),
  }));
