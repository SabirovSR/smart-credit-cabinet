import { route } from "@/server/router";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<Record<string, string>> },
) {
  const params = await context.params;
  return route(request, [
    "applications",
    params.id,
    "offers",
    params.offerId,
    "accept",
  ]);
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
