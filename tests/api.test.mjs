import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  corsHeaders,
  validatePayload,
  validateAttachment,
} from "../api/worker.js";
const application = () => ({
  name: "Test applicant",
  email: "candidate@example.com",
  city: "Montréal",
  phone: "514-000-0000",
  regions: "Montréal",
  languages: "French",
  availability: ["0-0"],
  consent: true,
  language: "fr",
});
test("service rejects origins outside the configured website", () => {
  assert.equal(
    corsHeaders("https://evil.example", "https://projecthamburg.github.io"),
    null
  );
  assert.equal(
    corsHeaders(
      "https://projecthamburg.github.io",
      "https://projecthamburg.github.io"
    )["Access-Control-Allow-Origin"],
    "https://projecthamburg.github.io"
  );
});
test("server validates consent, email, required application fields and availability", () => {
  assert.equal(validatePayload(application(), "application"), null);
  for (const payload of [
    { ...application(), consent: false },
    { ...application(), email: "bad" },
    { ...application(), city: "" },
    { ...application(), availability: ["7-9"] },
    { ...application(), availability: [] },
  ])
    assert.equal(typeof validatePayload(payload, "application"), "string");
});
test("file extension alone cannot disguise an executable as a PDF", async () => {
  assert.equal(
    await validateAttachment(
      new File(["not a pdf"], "fake.pdf", { type: "application/pdf" }),
      "application"
    ),
    false
  );
  assert.equal(
    await validateAttachment(
      new File(["%PDF-1.7\nfixture"], "cv.pdf", { type: "application/pdf" }),
      "application"
    ),
    true
  );
  assert.equal(
    await validateAttachment(
      new File(["%PDF-1.7\nfixture"], "cv.pdf", { type: "image/png" }),
      "application"
    ),
    false
  );
});
test("DOCX must contain a real Word package directory", async () => {
  const fake = new File(
    [new Uint8Array([0x50, 0x4b, 0x03, 0x04]), "random archive"],
    "cv.docx",
    { type: "application/zip" }
  );
  assert.equal(await validateAttachment(fake, "application"), false);
});
test("unauthorized administrators cannot list private applications or download files", async () => {
  const response = await worker.fetch(
    new Request("https://sap.example/admin/submissions"),
    { ADMIN_TOKEN: "test".repeat(10) },
    {}
  );
  assert.equal(response.status, 401);
});
test("form requests from unapproved origins do not reach storage", async () => {
  const response = await worker.fetch(
    new Request("https://sap.example/v1/application", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: "{}",
    }),
    { ALLOWED_ORIGINS: "https://projecthamburg.github.io" },
    {}
  );
  assert.equal(response.status, 403);
});
test("missing private storage returns unavailable rather than success", async () => {
  const response = await worker.fetch(
    new Request("https://sap.example/v1/quote", {
      method: "POST",
      headers: { Origin: "https://projecthamburg.github.io" },
      body: "{}",
    }),
    { ALLOWED_ORIGINS: "https://projecthamburg.github.io" },
    {}
  );
  assert.equal(response.status, 503);
});

function privateService({ failDatabase = false, limitCount = 1 } = {}) {
  const records = new Map(),
    objects = new Map(),
    deleted = [],
    tasks = [];
  const env = {
    ALLOWED_ORIGINS: "https://projecthamburg.github.io",
    RATE_SALT: "test-only-salt",
    DB: {
      prepare(sql) {
        return {
          values: [],
          bind(...values) {
            this.values = values;
            return this;
          },
          async first() {
            return { count: limitCount };
          },
          async run() {
            if (failDatabase) throw new Error("Storage unavailable");
            if (sql.startsWith("INSERT INTO submissions"))
              records.set(this.values[0], this.values);
            return { success: true };
          },
        };
      },
    },
    FILES: {
      async put(key, stream) {
        objects.set(key, await new Response(stream).arrayBuffer());
      },
      async delete(key) {
        deleted.push(key);
        objects.delete(key);
      },
    },
  };
  return {
    env,
    records,
    objects,
    deleted,
    ctx: {
      waitUntil(promise) {
        tasks.push(promise);
      },
    },
    tasks,
  };
}
function applicationRequest(
  file = new File(["%PDF-1.7\nExample résumé"], "cv.pdf", {
    type: "application/pdf",
  })
) {
  const form = new FormData();
  form.set("payload", JSON.stringify(application()));
  form.append("files", file);
  return new Request("https://sap.example/v1/application", {
    method: "POST",
    headers: { Origin: "https://projecthamburg.github.io" },
    body: form,
  });
}
test("valid applications receive a reference only after the private record and résumé are stored", async () => {
  const service = privateService();
  const response = await worker.fetch(
    applicationRequest(),
    service.env,
    service.ctx
  );
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.match(data.reference, /^SAP-A-[A-Z0-9]{8}$/);
  assert.equal(service.records.size, 1);
  assert.equal(service.objects.size, 1);
  assert.ok(
    [...service.objects.keys()][0].startsWith(`application/${data.reference}/`)
  );
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://projecthamburg.github.io"
  );
  await Promise.all(service.tasks);
});
test("a failed database write removes the private uploaded résumé and never confirms receipt", async () => {
  const service = privateService({ failDatabase: true });
  const response = await worker.fetch(
    applicationRequest(),
    service.env,
    service.ctx
  );
  assert.equal(response.status, 500);
  assert.equal(service.records.size, 0);
  assert.equal(service.objects.size, 0);
  assert.equal(service.deleted.length, 1);
  assert.equal((await response.json()).reference, undefined);
});
test("file signatures are checked before any private object is written", async () => {
  const service = privateService();
  const response = await worker.fetch(
    applicationRequest(
      new File(["executable"], "cv.pdf", { type: "application/pdf" })
    ),
    service.env,
    service.ctx
  );
  assert.equal(response.status, 400);
  assert.equal(service.objects.size, 0);
  assert.equal(service.records.size, 0);
});
test("rate limits reject excessive submissions without writing files", async () => {
  const service = privateService({ limitCount: 9 });
  const response = await worker.fetch(
    applicationRequest(),
    service.env,
    service.ctx
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "900");
  assert.equal(service.objects.size, 0);
});
