import {
  comparePlanScope,
  planScopeFingerprint,
  reviewDecisionsValid,
} from "../src/plan-geometry.js";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPlanReviewService } from "./plan-review.mjs";
import { createOutbox, queuedNotification, outboxKey } from "./outbox.mjs";
import { authenticatedAdmin } from "./admin-auth.mjs";
import { createMapsService } from "./admin-maps.mjs";
import { validatePayload, validateAttachment } from "./validation.mjs";
import { restoreState, estimateInput, validateStep } from "../src/model.js";
import { estimate, PRICING } from "../src/pricing.js";

const region = process.env.AWS_REGION || "ca-central-1";
const s3 = new S3Client({ region });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const TABLE = process.env.TABLE_NAME,
  BUCKET = process.env.BUCKET_NAME;
const mapsService=createMapsService({db,s3,table:TABLE,bucket:BUCKET});
const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim());
const hash = (value) => createHash("sha256").update(value).digest("hex");
const secureEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest()
  );
const isAdmin = (headers) =>
  Boolean(
    process.env.ADMIN_TOKEN?.length >= 32 &&
      secureEqual(
        (headers.authorization || "").replace(/^Bearer /, ""),
        process.env.ADMIN_TOKEN
      )
  );
const expiresInDays = (days) => Math.floor(Date.now() / 1000) + days * 86400;
const json = (data, status = 200, origin = "") => ({
  statusCode: status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(allowedOrigins().includes(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-SAP-Test",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        }
      : {}),
  },
  body: JSON.stringify(data),
});
const MIME = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function validateDescriptors(files, kind) {
  if (
    !Array.isArray(files) ||
    files.length > (kind === "application" ? 1 : 6) ||
    (kind === "application" && files.length !== 1)
  )
    return "Choose the required number of files.";
  let total = 0;
  for (const file of files) {
    if (
      !file ||
      typeof file.name !== "string" ||
      file.name.length > 200 ||
      !Number.isSafeInteger(file.size) ||
      file.size <= 0 ||
      file.size > (kind === "application" ? 5 : 10) * 1024 * 1024
    )
      return "A file exceeds the size limit.";
    const ext = file.name.split(".").pop().toLowerCase();
    if (
      !(
        kind === "application"
          ? ["pdf", "docx"]
          : ["pdf", "jpg", "jpeg", "png", "webp"]
      ).includes(ext)
    )
      return "Unsupported file type.";
    if (
      file.type &&
      file.type !== MIME[ext] &&
      !(ext === "docx" && file.type === "application/zip")
    )
      return "The file type does not match its extension.";
    total += file.size;
  }
  return total > 25 * 1024 * 1024
    ? "Files exceed the 25 MB total limit."
    : null;
}
function sanitizePayload(payload, kind) {
  if (kind === "quote") {
    const scope = restoreState({ version: 1, scope: payload.estimate.scope });
    for (const step of [0, 1, 2, 3])
      if (validateStep(scope, step))
        throw new Error("Please check the project scope.");
    return {
      kind,
      language: payload.language,
      consent: true,
      contact: Object.fromEntries(
        ["name", "email", "phone", "company"].map((key) => [
          key,
          String(payload.contact[key] || "").slice(0, 250),
        ])
      ),
      notes: String(payload.notes || "").slice(0, 4000),
      estimate: {
        schemaVersion: 1,
        pricingVersion: PRICING.version,
        generatedAt: new Date().toISOString(),
        scope,
        estimate: estimate(estimateInput(scope)),
      },
    };
  }
  const clean = {
    kind,
    language: payload.language,
    consent: true,
    availability: [...new Set(payload.availability)],
  };
  for (const key of [
    "name",
    "email",
    "phone",
    "city",
    "province",
    "regions",
    "experience",
    "asp",
    "transport",
    "languages",
    "start",
    "training",
    "construction",
    "commercial",
    "travel",
    "driver",
    "hours",
    "cover",
  ])
    clean[key] = String(payload[key] || "").slice(
      0,
      ["cover", "hours"].includes(key) ? 4000 : 250
    );
  return clean;
}
async function rateLimit(event) {
  const period = Math.floor(Date.now() / 900000),
    ip = event.requestContext?.http?.sourceIp || "unknown";
  const key = `RATE#${period}#${hash(
    `${process.env.RATE_SALT}:${period}:${ip}`
  )}`;
  const result = await db.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { pk: key },
      UpdateExpression: "ADD #count :one SET expiresAt = :expires",
      ExpressionAttributeNames: { "#count": "count" },
      ExpressionAttributeValues: { ":one": 1, ":expires": expiresInDays(1) },
      ReturnValues: "UPDATED_NEW",
    })
  );
  return result.Attributes.count <= 8;
}
async function readRecord(reference) {
  if (!/^SAP-[QAP]-[A-F0-9]{12}$/.test(reference || "")) return null;
  return (
    (
      await db.send(
        new GetCommand({
          TableName: TABLE,
          Key: { pk: reference },
          ConsistentRead: true,
        })
      )
    ).Item || null
  );
}
async function removeRecord(record) {
  if (record.planReviewReference) {
    const review = await readRecord(record.planReviewReference);
    if (review?.recordType === "plan-review") await removeRecord(review);
  }
  for (const file of record.files || [])
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: file.key }));
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        { Delete: { TableName: TABLE, Key: { pk: record.pk } } },
        { Delete: { TableName: TABLE, Key: { pk: outboxKey(record.pk) } } },
      ],
    })
  );
}
const outbox = createOutbox({ db, table: TABLE, readRecord });
const planReview = createPlanReviewService({
  db,
  s3,
  table: TABLE,
  bucket: BUCKET,
  readRecord,
  secureEqual,
  rateLimit,
});

export async function handler(event) {
  if (
    event.source === "aws.events" &&
    event["detail-type"] === "Scheduled Event" &&
    !event.requestContext
  )
    return outbox.processBatch();
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
  const origin = headers.origin || "",
    method = event.requestContext?.http?.method || "GET",
    path = event.rawPath || "/";
  if (method === "OPTIONS")
    return json({}, allowedOrigins().includes(origin) ? 200 : 403, origin);
  if (path === "/health" && method === "GET")
    return json(
      {
        service: "sap-service",
        status: "ok",
        forms: Boolean(TABLE && BUCKET),
        uploadMode: "direct",
        planReview: {
          enabled:
            process.env.PLAN_REVIEW_ENABLED === "true" &&
            Boolean(process.env.OPENAI_API_KEY),
        },
        region,
        notifications: {
          enabled: process.env.NOTIFICATIONS_ENABLED === "true",
          configured: Boolean(
            process.env.RESEND_API_KEY &&
              process.env.NOTIFICATION_FROM &&
              process.env.NOTIFICATION_TO
          ),
        },
      },
      200,
      origin
    );
  if (
    process.env.SERVICE_MODE === "plan-review" &&
    !path.startsWith("/v1/plan-review/")
  )
    return json({ error: "Not found." }, 404, origin);
  if (
    process.env.SERVICE_MODE !== "plan-review" &&
    path.startsWith("/v1/plan-review/")
  )
    return json(
      { error: "Use the configured plan-review endpoint." },
      404,
      origin
    );
  const identity = await authenticatedAdmin((headers.authorization || "").replace(/^Bearer /, ""));
  const admin = identity
    ? !(await readRecord("ADMIN#REVOKED#"+identity.id).catch(()=>({revoked:true})))
    : isAdmin(headers);
  if (path.startsWith("/admin/") && !admin)
    return json({ error: "Unauthorized." }, 401, origin);
  if (!path.startsWith("/admin/") && !allowedOrigins().includes(origin))
    return json({ error: "Origin not allowed." }, 403);
  try {
    let body = {};
    if (event.body) {
      const text = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf8")
        : event.body;
      if (Buffer.byteLength(text) > (path === "/admin/maps/dataset" && admin ? 4500000 : 120000))
        return json({ error: "Request is too large." }, 413, origin);
      try {
        body = JSON.parse(text);
      } catch {
        return json({ error: "Invalid request." }, 400, origin);
      }
    }
    if (path.startsWith("/v1/plan-review/") && method === "POST") {
      const response = await planReview.handle(
        path.split("/").pop(),
        body,
        event,
        admin
      );
      return json(response.data, response.status, origin);
    }
    if (path.startsWith("/admin/")) {
      const result = await mapsService(path,method,body,identity || {id:"legacy-operator"});
      if(result) return json(result.data,result.status || 200,origin);
    }
    if (path === "/admin/submissions" && method === "GET") {
      const cursor =
        new URLSearchParams(event.rawQueryString || "").get("cursor") ||
        event.queryStringParameters?.cursor;
      let startKey;
      if (cursor) {
        try {
          if (cursor.length > 1000) throw Error();
          const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
          if (
            !/^SAP-[QAP]-[A-F0-9]{12}$/.test(value.pk) ||
            value.recordType !== "received" ||
            !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(value.receivedAt)
          )
            throw Error();
          startKey = {
            pk: value.pk,
            recordType: "received",
            receivedAt: value.receivedAt,
          };
        } catch {
          return json({ error: "Invalid page cursor." }, 400, origin);
        }
      }
      const result = await db.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: "received",
          ...(startKey ? { ExclusiveStartKey: startKey } : {}),
          KeyConditionExpression: "recordType = :type",
          ExpressionAttributeValues: { ":type": "received" },
          ScanIndexForward: false,
          Limit: 100,
        })
      );
      return json(
        {
          submissions: (result.Items || []).map(
            ({ completionHash, ...record }) => record
          ),
          nextCursor: result.LastEvaluatedKey
            ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
                "base64url"
              )
            : null,
        },
        200,
        origin
      );
    }
    if (path === "/admin/file-url" && method === "POST") {
      const record = await readRecord(body.reference),
        file = record?.files?.find((f) => f.id === body.fileId);
      if (!file || record.status !== "received")
        return json({ error: "File not found." }, 404, origin);
      const safe = file.name
        .replace(/[\r\n"\\]/g, "_")
        .replace(/[^\x20-\x7E]/g, "_");
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: file.key,
          ResponseContentType: "application/octet-stream",
          ResponseContentDisposition: `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(
            file.name
          )}`,
        }),
        { expiresIn: 60 }
      );
      return json({ url, expiresIn: 60 }, 200, origin);
    }
    if (path.startsWith("/admin/submissions/") && method === "DELETE") {
      const record = await readRecord(path.split("/").pop());
      if (!record) return json({ error: "Not found." }, 404, origin);
      await removeRecord(record);
      return json({ deleted: true }, 200, origin);
    }
    const match = path.match(/^\/v1\/(quote|application)\/(prepare|complete)$/);
    if (!match || method !== "POST")
      return json({ error: "Not found." }, 404, origin);
    const [, kind, stage] = match;
    if (stage === "prepare") {
      if (!admin && !(await rateLimit(event)))
        return json(
          { error: "Please wait before sending another request." },
          429,
          origin
        );
      let error;
      try {
        error = validatePayload(body.payload, kind);
      } catch {
        error = "Please check the required fields.";
      }
      if (!error) error = validateDescriptors(body.files, kind);
      if (error) return json({ error }, 400, origin);
      let payload;
      try {
        payload = sanitizePayload(body.payload, kind);
      } catch (error) {
        return json({ error: error.message }, 400, origin);
      }
      let reviewedSource = null,
        reviewedReference = null;
      if (kind === "quote" && body.payload.estimate?.planReviewProof) {
        const proof = body.payload.estimate.planReviewProof;
        const reviewed = await planReview.handle("status", proof, event, admin);
        if (
          reviewed.status !== 200 ||
          reviewed.data.status !== "complete" ||
          proof.confirmed !== true ||
          proof.scopeFingerprint !==
            planScopeFingerprint(payload.estimate.scope)
        )
          return json(
            {
              error:
                "Recheck the plan review against the current measurements.",
            },
            400,
            origin
          );
        const report = reviewed.data;
        const linksByIndex = proof.linksByIndex || {},
          links = {};
        for (const [claimId, index] of Object.entries(linksByIndex))
          if (
            Number.isSafeInteger(index) &&
            payload.estimate.scope.rooms[index]
          )
            links[claimId] = payload.estimate.scope.rooms[index].id;
        const comparison = comparePlanScope(
          report.claims,
          payload.estimate.scope,
          {
            wholeProject: proof.wholeProject === true,
            links,
            geometryWarnings: report.discardedGeometryClaims || 0,
          }
        );
        if (
          !Array.isArray(proof.decisions) ||
          proof.decisions.length > 300 ||
          !reviewDecisionsValid(comparison, proof.decisions)
        )
          return json(
            { error: "Review the measurement differences before sending." },
            400,
            origin
          );
        reviewedSource = report.source;
        reviewedReference = report.reference;
        if (
          !body.files.some(
            (f) =>
              f.name === reviewedSource.name && f.size === reviewedSource.size
          )
        )
          return json(
            { error: "Attach the original reviewed plan before sending." },
            400,
            origin
          );
        payload.estimate.planReview = {
          ...report,
          comparison,
          decisions: proof.decisions.map((d) => ({
            conflictId: String(d.conflictId).slice(0, 80),
            resolution: String(d.resolution).slice(0, 40),
            reason: String(d.reason).slice(0, 1000),
          })),
          reviewedAt: new Date().toISOString(),
          scopeFingerprint: proof.scopeFingerprint,
          requiresClarification: comparison.conflicts.length > 0,
        };
        if (Buffer.byteLength(JSON.stringify(payload)) > 240000)
          return json(
            {
              error:
                "This review is too large to attach. Please discuss the plan at consultation.",
            },
            400,
            origin
          );
      }
      const reference = `SAP-${kind === "quote" ? "Q" : "A"}-${randomUUID()
          .replaceAll("-", "")
          .slice(0, 12)
          .toUpperCase()}`,
        token = randomBytes(32).toString("hex");
      const files = body.files.map((file, index) => {
        const ext = file.name.split(".").pop().toLowerCase();
        return {
          id: String(index + 1),
          key: `submissions/${reference}/${randomUUID()}.${ext}`,
          name: file.name,
          size: file.size,
          type: MIME[ext],
          ...(reviewedSource &&
          file.name === reviewedSource.name &&
          file.size === reviewedSource.size
            ? { reviewSourceSha256: reviewedSource.sha256 }
            : {}),
        };
      });
      const record = {
        pk: reference,
        kind,
        status: "pending",
        createdAt: new Date().toISOString(),
        expiresAt: expiresInDays(90),
        completionExpires: Math.floor(Date.now() / 1000) + 1800,
        completionHash: hash(token),
        payload,
        files,
        isTest: admin && headers["x-sap-test"] === "true",
        ...(reviewedReference
          ? { planReviewReference: reviewedReference }
          : {}),
      };
      await db.send(
        new PutCommand({
          TableName: TABLE,
          Item: record,
          ConditionExpression: "attribute_not_exists(pk)",
        })
      );
      const uploads = await Promise.all(
        files.map(async (file) => ({
          id: file.id,
          ...(await createPresignedPost(s3, {
            Bucket: BUCKET,
            Key: file.key,
            Expires: 1800,
            Fields: {
              "Content-Type": file.type,
              "x-amz-server-side-encryption": "AES256",
              success_action_status: "204",
            },
            Conditions: [
              ["content-length-range", file.size, file.size],
              { "Content-Type": file.type },
              { "x-amz-server-side-encryption": "AES256" },
              { success_action_status: "204" },
            ],
          })),
        }))
      );
      return json(
        {
          reference,
          token,
          uploads,
          ...(record.isTest ? { testMode: true } : {}),
        },
        201,
        origin
      );
    }
    const record = await readRecord(body.reference);
    if (
      !record ||
      record.kind !== kind ||
      !secureEqual(hash(String(body.token || "")), record.completionHash)
    )
      return json({ error: "Invalid submission reference." }, 401, origin);
    if (record.status === "received")
      return json(
        { reference: record.pk, receivedAt: record.receivedAt },
        200,
        origin
      );
    if (record.completionExpires < Date.now() / 1000)
      return json(
        { error: "Upload session expired. Please send the request again." },
        410,
        origin
      );
    for (const file of record.files) {
      let head;
      try {
        head = await s3.send(
          new HeadObjectCommand({ Bucket: BUCKET, Key: file.key })
        );
      } catch {
        return json(
          { error: "A supporting file has not finished uploading." },
          400,
          origin
        );
      }
      if (head.ContentLength !== file.size || head.ContentType !== file.type) {
        await removeRecord(record);
        return json(
          { error: "A file does not match the upload specification." },
          400,
          origin
        );
      }
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: file.key,
          ...(file.name.toLowerCase().endsWith(".docx")
            ? {}
            : { Range: "bytes=0-511" }),
        })
      );
      const bytes = await object.Body.transformToByteArray();
      const validationFile = new File([bytes], file.name, { type: file.type });
      if (!(await validateAttachment(validationFile, kind))) {
        await removeRecord(record);
        return json(
          {
            error:
              "A file failed validation. Please choose a genuine supported document or image.",
          },
          400,
          origin
        );
      }
    }
    const receivedAt = new Date().toISOString();
    const job = queuedNotification(record);
    for (const file of record.files)
      if (file.reviewSourceSha256) {
        const source = await s3.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: file.key })
        );
        const actual = Buffer.from(await source.Body.transformToByteArray());
        if (hash(actual) !== file.reviewSourceSha256) {
          await removeRecord(record);
          return json(
            { error: "The uploaded original differs from the reviewed plan." },
            400,
            origin
          );
        }
      }
    const notification = {
      state: job ? "pending" : record.isTest ? "suppressed" : "disabled",
      attempts: 0,
      ...(job ? { recipient: job.email.to[0] } : {}),
    };
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: TABLE,
                Key: { pk: record.pk },
                UpdateExpression:
                  "SET #status = :received, recordType = :type, receivedAt = :at, notification = :notification",
                ConditionExpression: "#status = :pending",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: {
                  ":received": "received",
                  ":type": "received",
                  ":at": receivedAt,
                  ":pending": "pending",
                  ":notification": notification,
                },
              },
            },
            ...(job
              ? [
                  {
                    Put: {
                      TableName: TABLE,
                      Item: job,
                      ConditionExpression: "attribute_not_exists(pk)",
                    },
                  },
                ]
              : []),
          ],
        })
      );
    } catch (error) {
      if (
        [
          "ConditionalCheckFailedException",
          "TransactionCanceledException",
        ].includes(error.name) &&
        (await readRecord(record.pk))?.status === "received"
      )
        return json({ reference: record.pk }, 200, origin);
      throw error;
    }
    if (job) {
      try {
        await outbox.runJob(job.pk);
      } catch (error) {
        console.warn(
          "Submission retained; notification remains queued.",
          error.name || "Error"
        );
      }
    }
    return json({ reference: record.pk, receivedAt }, 201, origin);
  } catch (error) {
    console.error("SAP service error", error.name || "Error");
    return json(
      { error: "We could not receive the request. Please try again." },
      500,
      origin
    );
  }
}
