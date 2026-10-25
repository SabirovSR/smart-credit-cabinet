import { db } from "@/server/db";
import { storageRoot } from "@/server/documents/storage";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db().$queryRaw`SELECT 1`;
    await storageRoot();
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
