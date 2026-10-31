import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.TABLE_NAME = "test-sap-records";
process.env.BUCKET_NAME = "test-sap-private";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key-for-signatures";
process.env.ALLOWED_ORIGINS = "https://projecthamburg.github.io";
process.env.ADMIN_TOKEN = "test-admin-key-for-private-api-validation";
process.env.RATE_SALT = "test-salt";
process.env.NOTIFICATIONS_ENABLED = "false";

const { S3Client } = await import(
  "../api/node_modules/@aws-sdk/client-s3/dist-cjs/index.js"
);
const { DynamoDBDocumentClient } = await import(
  "../api/node_modules/@aws-sdk/lib-dynamodb/dist-cjs/index.js"
);
const { handler, validateDescriptors } = await import("../api/lambda.mjs");
const { initialState } = await import("../src/model.js");
const records = new Map(),
  objects = new Map();
let rateCount = 1;
mock.method(DynamoDBDocumentClient.prototype, "send", async (command) => {
  const input = command.input,
    type = command.constructor.name;
  if (type === "TransactWriteCommand") {
    for (const action of input.TransactItems) {
      if (action.Update && records.get(action.Update.Key.pk)?.status !== "pending")
        throw Object.assign(new Error("Already received"), {name:"TransactionCanceledException"});
    }
    for (const action of input.TransactItems) {
      if (action.Delete) records.delete(action.Delete.Key.pk);
      if (action.Put) records.set(action.Put.Item.pk, structuredClone(action.Put.Item));
      if (action.Update) {
        const record = records.get(action.Update.Key.pk), v = action.Update.ExpressionAttributeValues;
        Object.assign(record, {status:v[":received"],recordType:v[":type"],receivedAt:v[":at"],notification:v[":notification"]});
      }
    }
    return {};
  }
  if (type === "UpdateCommand" && input.Key.pk.startsWith("RATE#"))
    return { Attributes: { count: rateCount } };
  if (type === "PutCommand") {
    records.set(input.Item.pk, structuredClone(input.Item));
    return {};
  }
  if (type === "GetCommand") return { Item: records.get(input.Key.pk) };
  if (type === "DeleteCommand") {
    records.delete(input.Key.pk);
    return {};
  }
  if (type === "QueryCommand") {
    const all = [...records.values()].filter((r) => r.status === "received").sort((a,b) => b.receivedAt.localeCompare(a.receivedAt));
    const start = input.ExclusiveStartKey ? all.findIndex(r=>r.pk===input.ExclusiveStartKey.pk)+1 : 0;
    const items = all.slice(start, start + input.Limit), last = items.at(-1);
    return {Items:items, ...(start + items.length < all.length ? {LastEvaluatedKey:{pk:last.pk,recordType:last.recordType,receivedAt:last.receivedAt}} : {})};
  }
  if (type === "UpdateCommand") {
    const record = records.get(input.Key.pk);
    if (record.status !== "pending")
      throw Object.assign(new Error("Already received"), {
        name: "ConditionalCheckFailedException",
      });
    record.status = "received";
    record.recordType = "received";
    record.receivedAt = input.ExpressionAttributeValues[":at"];
    return {};
  }
  throw new Error("Unexpected database command: " + type);
});
mock.method(S3Client.prototype, "send", async (command) => {
  const input = command.input,
    object = objects.get(input.Key);
  if (command.constructor.name === "DeleteObjectCommand") {
    objects.delete(input.Key);
    return {};
  }
  if (!object)
    throw Object.assign(new Error("Missing file"), { name: "NotFound" });
  if (command.constructor.name === "HeadObjectCommand")
    return { ContentLength: object.bytes.length, ContentType: object.type };
  if (command.constructor.name === "GetObjectCommand")
    return {
      Body: {
        transformToByteArray: async () =>
          input.Range ? object.bytes.subarray(0, 512) : object.bytes,
      },
    };
  throw new Error("Unexpected object command.");
});
const event = (path, body, admin = false, method = "POST") => ({
  rawPath: path,
  requestContext: { http: { method, sourceIp: "192.0.2.10" } },
  headers: {
    origin: "https://projecthamburg.github.io",
    ...(admin
      ? {
          authorization: `Bearer ${process.env.ADMIN_TOKEN}`,
          "x-sap-test": "true",
        }
      : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const appPayload = () => ({
  name: "Synthetic applicant",
  email: "qa@example.com",
  phone: "514-000-0000",
  city: "Montréal",
  regions: "Montréal",
  languages: "French",
  availability: ["0-0"],
  consent: true,
  language: "en",
});
const parsed = (response) => JSON.parse(response.body);

test("direct-upload manifest enforces total size, per-file size, formats and résumé requirements", () => {
  assert.equal(validateDescriptors([], "quote"), null);
  assert.equal(typeof validateDescriptors([], "application"), "string");
  assert.equal(
    typeof validateDescriptors(
      [{ name: "cv.exe", type: "application/octet-stream", size: 10 }],
      "application"
    ),
    "string"
  );
  assert.equal(
    typeof validateDescriptors(
      Array.from({ length: 3 }, (_, i) => ({
        name: i + ".pdf",
        type: "application/pdf",
        size: 9 * 1024 * 1024,
      })),
      "quote"
    ),
    "string"
  );
  assert.equal(
    validateDescriptors(
      [{ name: "plan.pdf", type: "application/pdf", size: 8 * 1024 * 1024 }],
      "quote"
    ),
    null
  );
});
test("pending submissions do not appear in the inbox before file validation", async () => {
  const response = await handler(
    event(
      "/v1/application/prepare",
      {
        payload: appPayload(),
        files: [{ name: "cv.pdf", type: "application/pdf", size: 20 }],
      },
      true
    )
  );
  assert.equal(response.statusCode, 201);
  const data = parsed(response);
  assert.equal(data.uploads.length, 1);
  assert.ok(data.uploads[0].fields.Policy);
  const inbox = parsed(
    await handler(event("/admin/submissions", null, true, "GET"))
  );
  assert.equal(
    inbox.submissions.some((r) => r.pk === data.reference),
    false
  );
  assert.equal(records.get(data.reference).isTest, true);
});
test("receipt is confirmed only after the uploaded résumé passes server checks", async () => {
  const bytes = Buffer.from("%PDF-1.7\nsynthetic cv");
  const prepared = parsed(
    await handler(
      event(
        "/v1/application/prepare",
        {
          payload: appPayload(),
          files: [
            { name: "cv.pdf", type: "application/pdf", size: bytes.length },
          ],
        },
        true
      )
    )
  );
  const record = records.get(prepared.reference);
  const missing = await handler(
    event("/v1/application/complete", {
      reference: prepared.reference,
      token: prepared.token,
    })
  );
  assert.equal(missing.statusCode, 400);
  objects.set(record.files[0].key, { bytes, type: "application/pdf" });
  const received = await handler(
    event("/v1/application/complete", {
      reference: prepared.reference,
      token: prepared.token,
    })
  );
  assert.equal(received.statusCode, 201);
  assert.equal(parsed(received).reference, prepared.reference);
  assert.equal(records.get(prepared.reference).status, "received");
  assert.equal(
    (
      await handler(
        event("/v1/application/complete", {
          reference: prepared.reference,
          token: prepared.token,
        })
      )
    ).statusCode,
    200
  );
});
test("a disguised file is removed and never creates a received application", async () => {
  const bytes = Buffer.from("invalid executable bytes");
  const prepared = parsed(
    await handler(
      event(
        "/v1/application/prepare",
        {
          payload: appPayload(),
          files: [
            { name: "cv.pdf", type: "application/pdf", size: bytes.length },
          ],
        },
        true
      )
    )
  );
  const file = records.get(prepared.reference).files[0];
  objects.set(file.key, { bytes, type: "application/pdf" });
  const response = await handler(
    event("/v1/application/complete", {
      reference: prepared.reference,
      token: prepared.token,
    })
  );
  assert.equal(response.statusCode, 400);
  assert.equal(records.has(prepared.reference), false);
  assert.equal(objects.has(file.key), false);
});
test("the server recomputes planning prices instead of trusting client totals", async () => {
  const scope = { ...initialState(), city: "Montréal", area: 1500 };
  const payload = {
    contact: { name: "Synthetic project manager", email: "qa@example.com" },
    consent: true,
    language: "en",
    estimate: { scope, estimate: { mid: 1 } },
  };
  const response = await handler(
    event("/v1/quote/prepare", { payload, files: [] }, true)
  );
  assert.equal(response.statusCode, 201);
  assert.ok(
    records.get(parsed(response).reference).payload.estimate.estimate.mid > 650
  );
});
test("completion tokens cannot be guessed and malformed Unicode admin keys are safely rejected", async () => {
  const reference = [...records.keys()].find((key) => key.startsWith("SAP-"));
  assert.equal(
    (
      await handler(
        event("/v1/application/complete", { reference, token: "wrong" })
      )
    ).statusCode,
    401
  );
  const request = event("/admin/submissions", null, false, "GET");
  request.headers.authorization =
    "Bearer " + "é".repeat(process.env.ADMIN_TOKEN.length);
  assert.equal((await handler(request)).statusCode, 401);
});

test("unapproved origins cannot prepare uploads or reach private records", async () => {
  const request = event("/v1/application/prepare", {
    payload: appPayload(),
    files: [],
  });
  request.headers.origin = "https://unapproved.example";
  assert.equal((await handler(request)).statusCode, 403);
});
test("invalid consent and malformed contact fields never create pending records", async () => {
  const before = records.size;
  for (const payload of [
    { ...appPayload(), consent: false },
    { ...appPayload(), city: {} },
    { ...appPayload(), email: "bad" },
  ]) {
    const response = await handler(
      event("/v1/application/prepare", {
        payload,
        files: [{ name: "cv.pdf", type: "application/pdf", size: 20 }],
      })
    );
    assert.equal(response.statusCode, 400);
  }
  assert.equal(records.size, before);
});
test("expired completion sessions cannot create a confirmed application", async () => {
  const prepared = parsed(
    await handler(
      event(
        "/v1/application/prepare",
        {
          payload: appPayload(),
          files: [{ name: "cv.pdf", type: "application/pdf", size: 20 }],
        },
        true
      )
    )
  );
  records.get(prepared.reference).completionExpires =
    Math.floor(Date.now() / 1000) - 1;
  assert.equal(
    (
      await handler(
        event("/v1/application/complete", {
          reference: prepared.reference,
          token: prepared.token,
        })
      )
    ).statusCode,
    410
  );
});
test("changed object size is rejected before receipt and removes the uploaded object", async () => {
  const prepared = parsed(
    await handler(
      event(
        "/v1/application/prepare",
        {
          payload: appPayload(),
          files: [{ name: "cv.pdf", type: "application/pdf", size: 20 }],
        },
        true
      )
    )
  );
  const file = records.get(prepared.reference).files[0];
  objects.set(file.key, { bytes: Buffer.alloc(21), type: "application/pdf" });
  assert.equal(
    (
      await handler(
        event("/v1/application/complete", {
          reference: prepared.reference,
          token: prepared.token,
        })
      )
    ).statusCode,
    400
  );
  assert.equal(objects.has(file.key), false);
});
test("private downloads require authentication and return short-lived attachment URLs", async () => {
  const record = [...records.values()].find((r) => r.status === "received");
  const body = { reference: record.pk, fileId: record.files[0].id };
  assert.equal((await handler(event("/admin/file-url", body))).statusCode, 401);
  const response = await handler(event("/admin/file-url", body, true));
  assert.equal(response.statusCode, 200);
  assert.equal(parsed(response).expiresIn, 60);
  const url = new URL(parsed(response).url);
  assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
  assert.match(
    url.searchParams.get("response-content-disposition"),
    /^attachment;/
  );
});
test("authenticated deletion removes only the chosen record and its private attachments", async () => {
  const record = [...records.values()].find((r) => r.status === "received"),
    before = records.size;
  const response = await handler(
    event("/admin/submissions/" + record.pk, null, true, "DELETE")
  );
  assert.equal(response.statusCode, 200);
  assert.equal(records.size, before - 1);
  assert.equal(objects.has(record.files[0].key), false);
});
test("excessive public submissions are rate-limited before storage", async () => {
  const before = records.size;
  rateCount = 9;
  try {
    assert.equal(
      (
        await handler(
          event("/v1/application/prepare", { payload: appPayload(), files: [] })
        )
      ).statusCode,
      429
    );
  } finally {
    rateCount = 1;
  }
  assert.equal(records.size, before);
});


test("authenticated inbox pagination retains older submissions and rejects malformed cursors", async () => {
  const seeded=[];
  for(let i=0;i<105;i++) {
    const pk="SAP-Q-"+i.toString(16).toUpperCase().padStart(12,"0");
    seeded.push(pk);
    records.set(pk,{pk,status:"received",recordType:"received",receivedAt:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString(),completionHash:"never-return-this"});
  }
  try {
    const first=parsed(await handler(event("/admin/submissions",null,true,"GET")));
    assert.equal(first.submissions.length,100);assert.ok(first.nextCursor);
    const request={...event("/admin/submissions",null,true,"GET"),rawQueryString:"cursor="+first.nextCursor};
    const second=parsed(await handler(request));
    const all=[...first.submissions,...second.submissions];
    assert.ok(seeded.every(pk=>all.some(r=>r.pk===pk)));
    assert.equal(new Set(all.map(r=>r.pk)).size,all.length);
    assert.ok(all.every(r=>!r.completionHash));
    assert.equal(second.nextCursor,null);
    const invalid=await handler({...request,rawQueryString:"cursor="+Buffer.from(JSON.stringify({pk:seeded[0],recordType:"notification",receivedAt:"2026-01-01T00:00:00.000Z"})).toString("base64url")});
    assert.equal(invalid.statusCode,400);
  } finally {for(const pk of seeded) records.delete(pk);}
});
