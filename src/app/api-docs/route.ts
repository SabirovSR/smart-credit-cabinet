export async function GET() {
  return new Response(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Credit Cabinet API</title><link rel="stylesheet" href="/vendor/swagger/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="/vendor/swagger/swagger-ui-bundle.js"></script><script src="/swagger-init.js"></script></body></html>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
