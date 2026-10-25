import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "../db";
import { config } from "../config";
import { fail } from "../errors";
import { hashPassword, verifyPassword } from "./password";
export const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const attempts = new Map<string, { count: number; until: number }>();
const dummy = hashPassword(randomBytes(32).toString("hex"));
export function tokenFrom(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("credit_session="))
    ?.slice(15);
}
export async function currentUser(request: Request) {
  const token = tokenFrom(request);
  if (!token) return fail(401, "UNAUTHENTICATED", "Войдите в личный кабинет.");
  const session = await db().session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { include: { company: true } } },
  });
  if (!session || session.expiresAt <= new Date())
    return fail(401, "UNAUTHENTICATED", "Сессия истекла. Войдите снова.");
  return session.user;
}
export function cookie(token: string, clear = false) {
  return `credit_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 28800}${config().COOKIE_SECURE ? "; Secure" : ""}`;
}
export async function login(email: string, password: string) {
  email = email.toLowerCase();
  const now = Date.now();
  for (const [key, value] of attempts)
    if (value.until <= now) attempts.delete(key);
  const attempt = attempts.get(email);
  if (attempt && attempt.count >= 10)
    return fail(
      429,
      "RATE_LIMITED",
      "Слишком много попыток. Повторите через 15 минут.",
    );
  const user = await db().user.findUnique({ where: { email } });
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? (await dummy),
  );
  if (!user || !valid) {
    attempts.set(email, {
      count: (attempt?.count ?? 0) + 1,
      until: attempt?.until ?? now + 900_000,
    });
    return fail(401, "INVALID_CREDENTIALS", "Неверный email или пароль.");
  }
  attempts.delete(email);
  const token = randomBytes(32).toString("hex");
  await db().session.create({
    data: {
      userId: user.id,
      tokenHash: digest(token),
      expiresAt: new Date(now + 28_800_000),
    },
  });
  return {
    user: { id: user.id, email: user.email, companyId: user.companyId },
    token,
  };
}
