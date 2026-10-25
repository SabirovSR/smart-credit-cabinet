import "server-only";
import { z } from "zod";
import { db } from "./db";
import { config } from "./config";
import { fail } from "./errors";
import { handle, jsonBody, boundedBody, uuid, idempotencyKey } from "./http";
import { currentUser, login, cookie, digest, tokenFrom } from "./auth/session";
import {
  calculationSchema,
  loginSchema,
  createSchema,
  draftSchema,
  versionSchema,
} from "@/contracts/application";
import { product } from "./credit/policy";
import { calculatePayment } from "./credit/calculator";
import {
  accept,
  createApplication,
  owned,
  submit,
  toDTO,
  updateApplication,
} from "./applications/service";
import { upload, ownedDocument, deactivate } from "./documents/service";
import { getFile } from "./documents/storage";
import { articles, news } from "./news/service";
import { readFile } from "node:fs/promises";
export function route(request: Request, parts: string[]) {
  return handle(request, async () => {
    const method = request.method,
      path = parts.join("/");
    if (path === "openapi" && method === "GET")
      return {
        response: new Response(await readFile("docs/openapi.yaml", "utf8"), {
          headers: { "Content-Type": "application/yaml" },
        }),
      };
    if (path === "auth/login" && method === "POST") {
      const input = loginSchema.parse(await jsonBody(request));
      const result = await login(input.email, input.password);
      return {
        data: result.user,
        headers: { "Set-Cookie": cookie(result.token) },
      };
    }
    const user = await currentUser(request);
    if (path === "auth/logout" && method === "POST") {
      z.object({})
        .strict()
        .parse(await jsonBody(request));
      await db().session.deleteMany({
        where: { tokenHash: digest(tokenFrom(request)!) },
      });
      return { status: 204, headers: { "Set-Cookie": cookie("", true) } };
    }
    if (path === "auth/me" && method === "GET")
      return {
        data: { id: user.id, email: user.email, companyId: user.companyId },
      };
    if (path === "company" && method === "GET") {
      const c = user.company,
        reduced = c.fixtureKey === "reduced-offer";
      return {
        data: {
          id: c.id,
          legalName: c.legalName,
          inn: c.inn,
          legalForm: c.legalForm,
          okved: c.okved,
          industry: c.industry,
          demoDefaults: config().DEMO_MODE
            ? {
                monthlyRevenueRub: reduced ? 500_000 : 1_200_000,
                monthlyOperatingExpensesRub: reduced ? 260_000 : 600_000,
              }
            : null,
        },
      };
    }
    if (path === "products" && method === "GET") return { data: [product] };
    if (path === "calculations" && method === "POST") {
      const input = calculationSchema.parse(await jsonBody(request));
      return { data: calculatePayment(input.amountRub, input.termMonths) };
    }
    if (parts[0] === "applications") {
      if (parts.length === 1 && method === "POST") {
        createSchema.parse(await jsonBody(request));
        return { data: await createApplication(user), status: 201 };
      }
      if (parts.length === 1 && method === "GET") {
        const params = new URL(request.url).searchParams;
        const limit = z.coerce
          .number()
          .int()
          .min(1)
          .max(50)
          .parse(params.get("limit") ?? 20);
        const cursor = params.get("cursor");
        if (cursor) await owned(uuid(cursor), user.id);
        const items = await db().creditApplication.findMany({
          where: { userId: user.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: {
            id: true,
            productCode: true,
            purpose: true,
            requestedAmountRub: true,
            status: true,
            version: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return {
          data: {
            items: items.slice(0, limit),
            nextCursor: items.length > limit ? items[limit - 1].id : null,
          },
        };
      }
      const id = uuid(parts[1]);
      if (parts.length === 2 && method === "GET")
        return { data: toDTO(await owned(id, user.id)) };
      if (parts.length === 2 && method === "PATCH") {
        const { expectedVersion, ...data } = draftSchema.parse(
          await jsonBody(request),
        );
        return {
          data: await updateApplication(id, user.id, expectedVersion, data),
        };
      }
      if (parts.length === 3 && parts[2] === "documents" && method === "POST") {
        await owned(id, user.id);
        const bytes = await boundedBody(request, 6 * 1024 * 1024);
        let form: FormData;
        try {
          form = await new Response(bytes, {
            headers: {
              "Content-Type": request.headers.get("content-type") ?? "",
            },
          }).formData();
        } catch {
          return fail(400, "INVALID_MULTIPART", "Не удалось прочитать файл.");
        }
        return { data: await upload(id, user.id, form), status: 201 };
      }
      if (method === "POST") {
        const { expectedVersion } = versionSchema.parse(
          await jsonBody(request),
        );
        if (parts.length === 3 && parts[2] === "submit")
          return submit(id, user.id, expectedVersion, idempotencyKey(request));
        if (parts.length === 3 && parts[2] === "reopen")
          return {
            data: await updateApplication(
              id,
              user.id,
              expectedVersion,
              {},
              true,
            ),
          };
        if (
          parts.length === 5 &&
          parts[2] === "offers" &&
          parts[4] === "accept"
        )
          return accept(
            id,
            user.id,
            uuid(parts[3]),
            expectedVersion,
            idempotencyKey(request),
          );
      }
    }
    if (parts[0] === "documents" && parts.length === 2) {
      const id = uuid(parts[1]);
      if (method === "GET") {
        const doc = await ownedDocument(id, user.id);
        return {
          response: new Response(
            new Uint8Array(await getFile(doc.storageKey)),
            {
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(doc.originalName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
                "X-Content-Type-Options": "nosniff",
              },
            },
          ),
        };
      }
      if (method === "DELETE") {
        const { expectedVersion } = versionSchema.parse(
          await jsonBody(request),
        );
        await deactivate(id, user.id, expectedVersion);
        return { status: 204 };
      }
    }
    if (parts[0] === "news" && method === "GET") {
      const latest = await db().creditApplication.findFirst({
        where: { userId: user.id },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      const feed = news(latest?.status);
      if (parts.length === 1) return { data: feed };
      const article = articles.find((a) => a.id === parts[1]);
      if (!article) fail(404, "NOT_FOUND", "Материал не найден.");
      return {
        data: {
          ...article,
          relevanceReason:
            feed.find((a) => a.id === article.id)?.relevanceReason ??
            "Справочный материал для предпринимателей",
          isDemoMaterial: true,
        },
      };
    }
    return fail(404, "NOT_FOUND", "Маршрут не найден.");
  });
}
