import "server-only";
import { randomUUID } from "node:crypto";
import { ZodError, z } from "zod";
import { ApiError, fail } from "./errors";
import { config } from "./config";
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    fail(413, "BODY_TOO_LARGE", "Превышен допустимый размер запроса.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        fail(413, "BODY_TOO_LARGE", "Превышен допустимый размер запроса.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail(400, "INVALID_JSON", "Ожидается JSON.");
  const bytes = await boundedBody(request, 16 * 1024);
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return fail(400, "INVALID_JSON", "Некорректный JSON.");
  }
}
export const uuid = (value: string) => {
  const parsed = z.uuid().safeParse(value);
  return parsed.success
    ? parsed.data
    : fail(400, "INVALID_ID", "Некорректный идентификатор.");
};
export const idempotencyKey = (request: Request) =>
  uuid(request.headers.get("idempotency-key") ?? "");
export type Result = {
  data?: unknown;
  status?: number;
  replayed?: boolean;
  headers?: HeadersInit;
  response?: Response;
};
export async function handle(
  request: Request,
  callback: () => Promise<Result>,
) {
  const requestId = randomUUID(),
    started = Date.now();
  const headers = new Headers({
    "X-Request-Id": requestId,
    "Cache-Control": "private, no-store",
  });
  try {
    if (
      !["GET", "HEAD"].includes(request.method) &&
      request.headers.get("origin") !== config().APP_ORIGIN
    )
      fail(403, "INVALID_ORIGIN", "Источник запроса не разрешён.");
    const result = await callback();
    if (result.response) {
      headers.forEach((v, k) => result.response!.headers.set(k, v));
      return result.response;
    }
    new Headers(result.headers).forEach((v, k) => headers.set(k, v));
    return result.status === 204
      ? new Response(null, { status: 204, headers })
      : Response.json(
          {
            data: result.data,
            meta: { requestId, replayed: result.replayed ?? false },
          },
          { status: result.status ?? 200, headers },
        );
  } catch (error) {
    const status =
      error instanceof ApiError
        ? error.status
        : error instanceof ZodError
          ? 422
          : 500;
    const code =
      error instanceof ApiError
        ? error.code
        : error instanceof ZodError
          ? "VALIDATION_ERROR"
          : "INTERNAL_ERROR";
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: status >= 500 ? "error" : "warn",
        requestId,
        operation: request.method + " " + new URL(request.url).pathname,
        durationMs: Date.now() - started,
        code,
      }),
    );
    return Response.json(
      {
        error: {
          code,
          message:
            error instanceof ApiError
              ? error.message
              : error instanceof ZodError
                ? "Проверьте заполнение полей."
                : "Не удалось выполнить действие. Попробуйте позже.",
          fieldErrors:
            error instanceof ZodError
              ? error.issues.map((i) => ({
                  field: i.path.join("."),
                  message: i.message,
                }))
              : [],
        },
        meta: { requestId, replayed: false },
      },
      { status, headers },
    );
  }
}
