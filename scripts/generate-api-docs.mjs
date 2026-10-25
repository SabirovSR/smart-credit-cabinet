import fs from "node:fs";
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const str = { type: "string" },
  integer = { type: "integer" },
  uuid = { type: "string", format: "uuid" },
  time = { type: "string", format: "date-time" },
  nullable = (s) => ({ anyOf: [s, { type: "null" }] });
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const array = (items) => ({ type: "array", items });
const amount = { type: "integer", minimum: 500000, maximum: 5000000 },
  term = { type: "integer", minimum: 6, maximum: 24 },
  money = { type: "integer", minimum: 0, maximum: 1000000000 };
const schemas = {
  Meta: object({ requestId: uuid, replayed: { type: "boolean" } }),
  Error: object({
    error: object({
      code: str,
      message: str,
      fieldErrors: array(object({ field: str, message: str })),
    }),
    meta: ref("Meta"),
  }),
  User: object({
    id: uuid,
    email: { type: "string", format: "email" },
    companyId: uuid,
  }),
  Company: object({
    id: uuid,
    legalName: str,
    inn: str,
    legalForm: str,
    okved: str,
    industry: str,
    demoDefaults: nullable(
      object({ monthlyRevenueRub: money, monthlyOperatingExpensesRub: money }),
    ),
  }),
  Product: object({
    code: { const: "WORKING_CAPITAL" },
    name: str,
    currency: { const: "RUB" },
    minAmountRub: integer,
    maxAmountRub: integer,
    minTermMonths: integer,
    maxTermMonths: integer,
    annualRateBps: integer,
    requiredDocumentTypes: array({
      enum: ["BANK_STATEMENT", "FINANCIAL_REPORT"],
    }),
  }),
  Calculation: object({
    amountRub: amount,
    termMonths: term,
    annualRateBps: integer,
    monthlyPaymentRub: integer,
    totalRepaymentRub: integer,
    interestRub: integer,
    policyVersion: str,
  }),
  Document: object({
    id: uuid,
    applicationId: uuid,
    type: { enum: ["BANK_STATEMENT", "FINANCIAL_REPORT"] },
    originalName: str,
    mimeType: { const: "application/pdf" },
    sizeBytes: integer,
    sha256: str,
    active: { type: "boolean" },
    createdAt: time,
  }),
  Reason: object({ code: str, message: str, field: nullable(str) }),
  Check: object({
    type: str,
    status: str,
    message: str,
    details: { type: "object", additionalProperties: true },
  }),
  Evaluation: object({
    id: uuid,
    inputVersion: integer,
    resultVersion: integer,
    policyVersion: str,
    outcome: {
      enum: ["NEEDS_INFO", "FULL_OFFER", "REDUCED_OFFER", "REJECTED"],
    },
    reasons: array(ref("Reason")),
    checks: array(ref("Check")),
    createdAt: time,
  }),
  Offer: object({
    id: uuid,
    kind: { enum: ["FULL", "REDUCED"] },
    applicationVersion: integer,
    amountRub: amount,
    termMonths: term,
    annualRateBps: integer,
    monthlyPaymentRub: integer,
    totalRepaymentRub: integer,
    expiresAt: time,
    acceptedAt: nullable(time),
    expired: { type: "boolean" },
  }),
  Event: object({
    id: uuid,
    type: str,
    actor: { enum: ["CLIENT", "SYSTEM"] },
    message: str,
    sequence: integer,
    createdAt: time,
  }),
  NewsItem: object({
    id: str,
    title: str,
    summary: str,
    relevanceReason: str,
    isDemoMaterial: { const: true },
  }),
};
schemas.NewsArticle = object({
  ...schemas.NewsItem.properties,
  body: array(str),
});
schemas.ApplicationItem = object({
  id: uuid,
  productCode: { const: "WORKING_CAPITAL" },
  purpose: str,
  requestedAmountRub: nullable(amount),
  status: { enum: ["DRAFT", "NEEDS_INFO", "OFFERED", "REJECTED", "ACCEPTED"] },
  version: integer,
  createdAt: time,
  updatedAt: time,
});
schemas.Application = object({
  ...schemas.ApplicationItem.properties,
  companyId: uuid,
  termMonths: nullable(term),
  monthlyRevenueRub: nullable(money),
  monthlyOperatingExpensesRub: nullable(money),
  documents: array(ref("Document")),
  latestEvaluation: nullable(ref("Evaluation")),
  offer: nullable(ref("Offer")),
  events: array(ref("Event")),
});
const version = object({ expectedVersion: { type: "integer", minimum: 1 } });
const draft = {
  ...object({
    ...version.properties,
    purpose: { type: "string", maxLength: 1000 },
    requestedAmountRub: nullable(amount),
    termMonths: nullable(term),
    monthlyRevenueRub: nullable(money),
    monthlyOperatingExpensesRub: nullable(money),
  }),
  required: ["expectedVersion"],
  minProperties: 2,
};
const operations = [
  [
    "post",
    "/api/v1/auth/login",
    "login",
    ref("User"),
    object({
      email: { type: "string", format: "email", maxLength: 254 },
      password: { type: "string", minLength: 1, maxLength: 200 },
    }),
    200,
  ],
  ["post", "/api/v1/auth/logout", "logout", null, object({}), 204],
  ["get", "/api/v1/auth/me", "getMe", ref("User")],
  ["get", "/api/v1/company", "getCompany", ref("Company")],
  ["get", "/api/v1/products", "listProducts", array(ref("Product"))],
  [
    "post",
    "/api/v1/calculations",
    "calculateLoan",
    ref("Calculation"),
    object({ amountRub: amount, termMonths: term }),
  ],
  [
    "get",
    "/api/v1/applications",
    "listApplications",
    object({
      items: array(ref("ApplicationItem")),
      nextCursor: nullable(uuid),
    }),
  ],
  [
    "post",
    "/api/v1/applications",
    "createApplication",
    ref("Application"),
    object({ productCode: { const: "WORKING_CAPITAL" } }),
    201,
  ],
  ["get", "/api/v1/applications/{id}", "getApplication", ref("Application")],
  [
    "patch",
    "/api/v1/applications/{id}",
    "updateApplication",
    ref("Application"),
    draft,
  ],
  [
    "post",
    "/api/v1/applications/{id}/submit",
    "submitApplication",
    ref("Application"),
    version,
  ],
  [
    "post",
    "/api/v1/applications/{id}/reopen",
    "reopenApplication",
    ref("Application"),
    version,
  ],
  [
    "post",
    "/api/v1/applications/{id}/documents",
    "uploadDocument",
    object({ document: ref("Document"), applicationVersion: integer }),
    object({
      expectedVersion: { type: "string", pattern: "^[1-9][0-9]*$" },
      type: { enum: ["BANK_STATEMENT", "FINANCIAL_REPORT"] },
      file: { type: "string", format: "binary" },
    }),
    201,
  ],
  ["get", "/api/v1/documents/{id}", "downloadDocument", null],
  [
    "delete",
    "/api/v1/documents/{id}",
    "deactivateDocument",
    null,
    version,
    204,
  ],
  [
    "post",
    "/api/v1/applications/{id}/offers/{offerId}/accept",
    "acceptOffer",
    ref("Application"),
    version,
  ],
  ["get", "/api/v1/news", "listNews", array(ref("NewsItem"))],
  ["get", "/api/v1/news/{id}", "getNewsArticle", ref("NewsArticle")],
  ["get", "/api/v1/openapi", "getOpenApi", null],
  [
    "get",
    "/api/health/live",
    "getLiveness",
    object({ status: { const: "ok" } }),
  ],
  [
    "get",
    "/api/health/ready",
    "getReadiness",
    object({ status: { enum: ["ready", "unavailable"] } }),
  ],
];
const paths = {};
for (const [method, path, id, response, input, status = 200] of operations) {
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: id === "getNewsArticle" ? str : uuid,
  }));
  if (method !== "get")
    parameters.push({
      name: "Origin",
      in: "header",
      required: true,
      schema: { type: "string", format: "uri" },
      example: "http://localhost:3000",
    });
  if (["submitApplication", "acceptOffer"].includes(id))
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: uuid,
    });
  if (id === "listApplications")
    parameters.push(
      {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      { name: "cursor", in: "query", schema: uuid },
    );
  const content =
    id === "downloadDocument"
      ? { "application/pdf": { schema: { type: "string", format: "binary" } } }
      : id === "getOpenApi"
        ? { "application/yaml": { schema: str } }
        : response
          ? {
              "application/json": {
                schema: path.startsWith("/api/health")
                  ? response
                  : object({ data: response, meta: ref("Meta") }),
              },
            }
          : undefined;
  paths[path] ??= {};
  paths[path][method] = {
    operationId: id,
    summary: id,
    security: ["login", "getOpenApi", "getLiveness", "getReadiness"].includes(
      id,
    )
      ? []
      : [{ session: [] }],
    parameters,
    ...(input
      ? {
          requestBody: {
            required: true,
            content: {
              [id === "uploadDocument"
                ? "multipart/form-data"
                : "application/json"]: { schema: input },
            },
          },
        }
      : {}),
    responses: {
      [status]: { description: "Success", ...(content ? { content } : {}) },
      ...(path.startsWith("/api/health")
        ? { 503: { description: "Dependency unavailable" } }
        : {
            "4XX": {
              description:
                "Validation, ownership, state, version or authentication error",
              content: { "application/json": { schema: ref("Error") } },
            },
            "5XX": {
              description: "Temporary or internal failure",
              content: { "application/json": { schema: ref("Error") } },
            },
          }),
    },
  };
}
fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(
  "docs/openapi.yaml",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "Smart Credit Cabinet API",
        version: "1.0.0",
        description:
          "Synthetic hackathon prototype. Cookie authentication, exact Origin matching, versioned mutations and idempotent submission/acceptance.",
      },
      servers: [
        { url: "http://localhost:3000" },
        { url: "https://smart-credit-cabinet.sabirov.tech" },
      ],
      paths,
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "credit_session" },
        },
        schemas,
      },
    },
    null,
    2,
  ) + "\n",
);
const examples = {
  login: { email: "full@demo.local", password: "DemoCredit2026!" },
  logout: {},
  calculateLoan: { amountRub: 2000000, termMonths: 12 },
  createApplication: { productCode: "WORKING_CAPITAL" },
  updateApplication: {
    expectedVersion: "{{version}}",
    purpose: "Закупка сезонного товара",
    requestedAmountRub: 2000000,
    termMonths: 12,
    monthlyRevenueRub: 1200000,
    monthlyOperatingExpensesRub: 600000,
  },
  submitApplication: { expectedVersion: "{{version}}" },
  reopenApplication: { expectedVersion: "{{version}}" },
  acceptOffer: { expectedVersion: "{{version}}" },
  deactivateDocument: { expectedVersion: "{{version}}" },
};
const items = operations.map(([method, path, id]) => {
  const raw =
    "{{baseUrl}}" +
    path
      .replace("{offerId}", "{{offerId}}")
      .replace(
        "{id}",
        id === "getNewsArticle"
          ? "working-capital"
          : id.includes("Document") && id !== "uploadDocument"
            ? "{{documentId}}"
            : "{{applicationId}}",
      );
  const header = [{ key: "Origin", value: "{{baseUrl}}" }];
  let body;
  if (id === "uploadDocument")
    body = {
      mode: "formdata",
      formdata: [
        { key: "expectedVersion", value: "{{version}}", type: "text" },
        { key: "type", value: "BANK_STATEMENT", type: "text" },
        {
          key: "file",
          type: "file",
          src: "../public/demo-documents/bank-statement.pdf",
        },
      ],
    };
  else if (examples[id]) {
    header.push({ key: "Content-Type", value: "application/json" });
    body = {
      mode: "raw",
      raw: JSON.stringify(examples[id], null, 2).replaceAll(
        '"{{version}}"',
        "{{version}}",
      ),
    };
  }
  const event = [];
  if (["submitApplication", "acceptOffer"].includes(id)) {
    header.push({ key: "Idempotency-Key", value: "{{operationKey}}" });
    event.push({
      listen: "prerequest",
      script: {
        type: "text/javascript",
        exec: [
          "pm.environment.set('operationKey', pm.variables.replaceIn('{{$guid}}')); ",
          "pm.environment.set('operationVersion', pm.environment.get('version')); ",
        ],
      },
    });
  }
  event.push({
    listen: "test",
    script: {
      type: "text/javascript",
      exec: [
        "if (pm.response.code < 300 && pm.response.headers.get('Content-Type')?.includes('json')) {",
        " const d=pm.response.json().data;",
        " if(d?.version) {pm.environment.set('version',d.version); pm.environment.set('applicationId',d.id);}",
        " if(d?.offer) pm.environment.set('offerId',d.offer.id);",
        " if(d?.document) {pm.environment.set('documentId',d.document.id); pm.environment.set('version',d.applicationVersion);}",
        "}",
      ],
    },
  });
  return {
    name: id,
    request: {
      method: method.toUpperCase(),
      header,
      url: raw,
      ...(body ? { body } : {}),
    },
    event,
  };
});
for (const id of ["submitApplication", "acceptOffer"]) {
  const item = structuredClone(items.find((i) => i.name === id));
  item.name = id + "Replay";
  item.event = item.event.filter((e) => e.listen !== "prerequest");
  item.request.body.raw = item.request.body.raw.replaceAll(
    "{{version}}",
    "{{operationVersion}}",
  );
  items.push(item);
}
fs.writeFileSync(
  "docs/postman.collection.json",
  JSON.stringify(
    {
      info: {
        name: "Smart Credit Cabinet",
        schema:
          "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items,
    },
    null,
    2,
  ) + "\n",
);
fs.writeFileSync(
  "docs/postman.local.environment.json",
  JSON.stringify(
    {
      name: "Local demo",
      values: [
        { key: "baseUrl", value: "http://localhost:3000", enabled: true },
        ...[
          "applicationId",
          "documentId",
          "offerId",
          "operationKey",
          "operationVersion",
        ].map((key) => ({ key, value: "", enabled: true })),
        { key: "version", value: 1, enabled: true },
      ],
      _postman_variable_scope: "environment",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Generated ${operations.length} API operations and Postman collection`,
);
