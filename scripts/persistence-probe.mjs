import fs from "node:fs/promises";
import crypto from "node:crypto";
const origin = process.env.BASE_URL ?? "http://localhost:3000",
  file = "work/persistence-probe.json";
if (process.argv[2] === "before") {
  const response = await fetch(origin + "/api/v1/auth/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "full@demo.local",
      password: "DemoCredit2026!",
    }),
  });
  if (!response.ok) throw new Error("Login failed");
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const created = await fetch(origin + "/api/v1/applications", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productCode: "WORKING_CAPITAL" }),
  });
  if (!created.ok) throw new Error("Create failed");
  const app = (await created.json()).data;
  const bytes = await fs.readFile("public/demo-documents/bank-statement.pdf");
  const form = new FormData();
  form.set("expectedVersion", String(app.version));
  form.set("type", "BANK_STATEMENT");
  form.set(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "sample.pdf",
  );
  const uploaded = await fetch(
    origin + `/api/v1/applications/${app.id}/documents`,
    { method: "POST", headers: { Origin: origin, Cookie: cookie }, body: form },
  );
  if (!uploaded.ok) throw new Error("Upload failed");
  const doc = (await uploaded.json()).data.document;
  await fs.mkdir("work", { recursive: true });
  await fs.writeFile(
    file,
    JSON.stringify({
      cookie,
      app: app.id,
      doc: doc.id,
      hash: crypto.createHash("sha256").update(bytes).digest("hex"),
    }),
    { mode: 0o600 },
  );
  console.log("Persistence probe created");
} else {
  const probe = JSON.parse(await fs.readFile(file, "utf8"));
  const headers = { Cookie: probe.cookie };
  const app = await fetch(origin + `/api/v1/applications/${probe.app}`, {
    headers,
  });
  if (!app.ok) throw new Error("Application lost after restart");
  const doc = await fetch(origin + `/api/v1/documents/${probe.doc}`, {
    headers,
  });
  if (!doc.ok) throw new Error("PDF lost after restart");
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(await doc.arrayBuffer()))
    .digest("hex");
  if (hash !== probe.hash) throw new Error("PDF changed after restart");
  console.log("Application, session and PDF persist after restart");
}
