import { mkdir } from "node:fs/promises";
const address = process.env.TEST_DATABASE_URL;
if (
  !address ||
  !new URL(address).pathname.endsWith("_test") ||
  process.env.DATABASE_URL !== address
)
  throw new Error(
    "Integration requires DATABASE_URL = TEST_DATABASE_URL and a database ending in _test",
  );
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.COOKIE_SECURE = "false";
process.env.DEMO_MODE = "true";
process.env.UPLOAD_DIR = "./work/integration-uploads";
await mkdir(process.env.UPLOAD_DIR, { recursive: true });
