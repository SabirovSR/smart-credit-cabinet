import "server-only";
import {
  mkdir,
  access,
  writeFile,
  rename,
  unlink,
  readFile,
  constants,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "../config";
import { fail } from "../errors";
export async function storageRoot() {
  const root = path.resolve(config().UPLOAD_DIR);
  await mkdir(root, { recursive: true });
  await access(root, constants.R_OK | constants.W_OK);
  return root;
}
async function filePath(key: string) {
  const root = await storageRoot();
  const result = path.resolve(root, key);
  if (!result.startsWith(root + path.sep))
    fail(500, "STORAGE_ERROR", "Документ недоступен.");
  return result;
}
export async function saveFile(data: Buffer) {
  const key = `${randomUUID()}.pdf`,
    target = await filePath(key),
    temp = target + ".tmp";
  try {
    await writeFile(temp, data, { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } catch (error) {
    await unlink(temp).catch(() => undefined);
    throw error;
  }
  return key;
}
export const removeFile = async (key: string) => unlink(await filePath(key));
export const getFile = async (key: string) => readFile(await filePath(key));
