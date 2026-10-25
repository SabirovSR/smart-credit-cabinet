import fs from "node:fs";
const api = JSON.parse(fs.readFileSync("docs/openapi.yaml", "utf8"));
const expected = [
  "login",
  "logout",
  "getMe",
  "getCompany",
  "listProducts",
  "calculateLoan",
  "listApplications",
  "createApplication",
  "getApplication",
  "updateApplication",
  "submitApplication",
  "reopenApplication",
  "uploadDocument",
  "downloadDocument",
  "deactivateDocument",
  "acceptOffer",
  "listNews",
  "getNewsArticle",
  "getOpenApi",
  "getLiveness",
  "getReadiness",
];
const actual = Object.values(api.paths).flatMap((p) =>
  Object.values(p).map((o) => o.operationId),
);
const postman = JSON.parse(
  fs.readFileSync("docs/postman.collection.json", "utf8"),
).item.map((i) => i.name);
if (
  new Set(actual).size !== 21 ||
  actual.length !== 21 ||
  expected.some((id) => !actual.includes(id) || !postman.includes(id))
)
  throw new Error("Missing or duplicate API operation");
for (const [path, methods] of Object.entries(api.paths)) {
  const file =
    "src/app" +
    path.replaceAll("{id}", "[id]").replaceAll("{offerId}", "[offerId]") +
    "/route.ts";
  if (!fs.existsSync(file)) throw new Error(`Missing route ${file}`);
  for (const method of Object.keys(methods))
    if (!fs.readFileSync(file, "utf8").includes(method.toUpperCase()))
      throw new Error(`Missing method ${method} ${path}`);
}
console.log("21 operations, route files and Postman collection verified");
