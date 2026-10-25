import "server-only";
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_ORIGIN: z.url(),
  UPLOAD_DIR: z.string().min(1),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});
let cached: z.infer<typeof schema> | undefined;
export const config = () => (cached ??= schema.parse(process.env));
