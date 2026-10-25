const origin = process.env.BASE_URL ?? "http://localhost:3000";
const deadline = Date.now() + 120000;
while (Date.now() < deadline) {
  try {
    const r = await fetch(origin + "/api/health/ready", {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      console.log("Application ready");
      process.exit(0);
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
throw new Error("Readiness timeout");
