import "server-only";
import { db } from "../db";
import { fail } from "../errors";
import { digest } from "../auth/session";
import { lock, owned, event, toDTO } from "../applications/service";
import { saveFile, removeFile } from "./storage";
import { documentTypeSchema } from "@/contracts/application";
import { z } from "zod";
export async function upload(id: string, userId: string, form: FormData) {
  await owned(id, userId);
  if (
    Array.from(form.keys()).some(
      (k) => !["expectedVersion", "type", "file"].includes(k),
    ) ||
    [...form.keys()].length !== 3
  )
    fail(400, "INVALID_MULTIPART", "Ожидаются версия, тип и один файл.");
  const type = documentTypeSchema.parse(form.get("type"));
  const expectedVersion = z.coerce
    .number()
    .int()
    .positive()
    .parse(form.get("expectedVersion"));
  const file = form.get("file");
  if (!(file instanceof File)) fail(400, "FILE_REQUIRED", "Выберите PDF-файл.");
  if (file.size > 5 * 1024 * 1024)
    fail(413, "FILE_TOO_LARGE", "Размер PDF не должен превышать 5 МБ.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (
    !file.name.toLowerCase().endsWith(".pdf") ||
    file.type !== "application/pdf" ||
    bytes.subarray(0, 5).toString() !== "%PDF-"
  )
    fail(415, "INVALID_FILE_TYPE", "Нужен документ в формате PDF.");
  const storageKey = await saveFile(bytes);
  try {
    return await db().$transaction(async (tx) => {
      const app = await lock(tx, id, userId, expectedVersion, "edit");
      if (
        app.documents.reduce((sum, d) => sum + d.sizeBytes, 0) + bytes.length >
        25 * 1024 * 1024
      )
        fail(
          413,
          "APPLICATION_STORAGE_LIMIT",
          "Лимит документов заявки — 25 МБ с учётом истории.",
        );
      await tx.document.updateMany({
        where: { applicationId: id, type, active: true },
        data: { active: false },
      });
      const doc = await tx.document.create({
        data: {
          applicationId: id,
          type,
          storageKey,
          originalName: file.name.slice(0, 240),
          sizeBytes: bytes.length,
          sha256: digest(bytes),
        },
      });
      await event(
        tx,
        id,
        "DOCUMENT_UPLOADED",
        "CLIENT",
        type === "BANK_STATEMENT"
          ? "Загружена выписка по счёту"
          : "Загружен финансовый отчёт",
      );
      const dto = toDTO(await owned(id, userId, tx));
      return {
        document: dto.documents.find((d) => d.id === doc.id)!,
        applicationVersion: expectedVersion + 1,
      };
    });
  } catch (error) {
    await removeFile(storageKey).catch(() => undefined);
    throw error;
  }
}
export async function ownedDocument(id: string, userId: string) {
  const doc = await db().document.findFirst({
    where: { id, application: { userId } },
  });
  return doc ?? fail(404, "NOT_FOUND", "Документ не найден.");
}
export async function deactivate(
  id: string,
  userId: string,
  expectedVersion: number,
) {
  const doc = await ownedDocument(id, userId);
  await db().$transaction(async (tx) => {
    await lock(tx, doc.applicationId, userId, expectedVersion, "edit");
    const updated = await tx.document.updateMany({
      where: { id, active: true },
      data: { active: false },
    });
    if (!updated.count) fail(409, "INVALID_STATE", "Документ уже удалён.");
    await event(
      tx,
      doc.applicationId,
      "DOCUMENT_REMOVED",
      "CLIENT",
      "Документ исключён из текущего комплекта",
    );
  });
}
