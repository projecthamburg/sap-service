import { createFieldService } from "./map-field.mjs";
import { adminRequestAllowed } from "./admin-auth.mjs";
import { createHash, randomUUID } from "node:crypto";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { validateDataset } from "../admin/schema.js";
export { validateDataset } from "../admin/schema.js";
export function createMapsService({ db, s3, table, bucket }) {
  const read = async () =>
    (
      await db.send(
        new GetCommand({
          TableName: table,
          Key: { pk: "MAPS#DATASET" },
          ConsistentRead: true,
        })
      )
    ).Item;
  const readResearch = async () => {
    const c = await read();
    if (!c) return [];
    const o = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: c.key })
    );
    return JSON.parse(await o.Body.transformToString());
  };
  const field = createFieldService({
    db,
    table,
    researchRecordExists: async (id) =>
      (await readResearch()).some((r) => r.lead_id === id),
  });
  return async (path, method, body, actor, options = {}) => {
    if (!adminRequestAllowed(actor, path, method))
      return { status: 403, data: { error: "This demo is read-only. Private submissions and live changes are unavailable." } };
    const operational = !actor.demo && await field.handle(path, method, body, actor, options);
    if (operational) return operational;
    if (path === "/admin/session" && method === "GET")
      return {
        data: { authenticated: true, user: actor.demo ? "Demo" : actor.username || "Operator", ...(actor.demo ? { demo: true } : {}) },
      };
    if (path === "/admin/maps/config" && method === "GET")
      return {
        data: { googleMapsKey: process.env.SAP_MAPS_BROWSER_KEY || "" },
      };
    if (path !== "/admin/maps/dataset") return null;
    const current = await read();
    if (method === "GET") {
      const fieldSnapshot = actor.demo ? { fieldSites: [], activity: {} } : await field.snapshot(options.test);
      if (!current)
        return {
          data: {
            records: [],
            version: null,
            ...fieldSnapshot,
          },
        };
      const object = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: current.key })
      );
      return {
        data: {
          records: JSON.parse(await object.Body.transformToString()),
          ...fieldSnapshot,
          version: current.version,
          updatedAt: current.updatedAt,
          source: current.source,
        },
      };
    }
    if (method !== "POST")
      return { status: 405, data: { error: "Method not allowed." } };
    const errors = validateDataset(body.records);
    if (errors.length)
      return {
        status: 422,
        data: { error: "Dataset was not saved.", errors: errors.slice(0, 100) },
      };
    if ((body.expectedVersion || null) !== (current?.version || null))
      return {
        status: 409,
        data: {
          error:
            "Another administrator changed the dataset. Reload before importing.",
        },
      };
    const content = JSON.stringify(body.records),
      version = createHash("sha256").update(content).digest("hex"),
      key = `admin/maps/datasets/${version}.json`,
      updatedAt = new Date().toISOString();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: "application/json",
        ServerSideEncryption: "AES256",
      })
    );
    const metadata = {
      pk: "MAPS#DATASET",
      version,
      key,
      updatedAt,
      actor: actor.id || "legacy-operator",
      source: String(body.source || "Administrator import").slice(0, 500),
      count: body.records.length,
    };
    try {
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: table,
                Item: metadata,
                ConditionExpression: current
                  ? "version = :previous"
                  : "attribute_not_exists(pk)",
                ...(current
                  ? {
                      ExpressionAttributeValues: {
                        ":previous": current.version,
                      },
                    }
                  : {}),
              },
            },
            {
              Put: {
                TableName: table,
                Item: {
                  ...metadata,
                  pk: `MAPS#AUDIT#${updatedAt}#${randomUUID()}`,
                },
              },
            },
          ],
        })
      );
    } catch (e) {
      if (e.name === "TransactionCanceledException")
        return {
          status: 409,
          data: { error: "Dataset changed during import. Reload and retry." },
        };
      throw e;
    }
    return { data: { version, updatedAt, count: body.records.length } };
  };
}
