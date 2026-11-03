import { randomUUID, createHash } from "node:crypto";
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
export const VISIT_STATES = ["open", "visited", "return"];
export function validateFieldSite(body) {
  if(!body||typeof body!=="object"||Array.isArray(body))return ["Provide a site name and a shared location."];
  const errors = [];
  if (
    typeof body.name !== "string" ||
    body.name.trim().length < 3 ||
    body.name.length > 180
  )
    errors.push("Enter a site name (3–180 characters).");
  for (const [key, max] of [
    ["lat", 90],
    ["lng", 180],
  ])
    if (!Number.isFinite(body[key]) || Math.abs(body[key]) > max)
      errors.push("A valid shared location is required.");
  if (
    !Number.isFinite(body.accuracy) ||
    body.accuracy < 0 ||
    body.accuracy > 100000
  )
    errors.push("GPS accuracy is required.");
  if (body.accuracy > 200 && body.confirmLocation !== true)
    errors.push(
      "Confirm the location because GPS accuracy is greater than 200 metres."
    );
  for (const key of ["address", "city", "province", "notes", "contractor"])
    if (
      body[key] !== undefined &&
      (typeof body[key] !== "string" ||
        body[key].length > (key === "notes" ? 4000 : 300))
    )
      errors.push(`${key} is too long or invalid.`);
  if (body.province && !["QC", "ON"].includes(body.province))
    errors.push("Choose Québec, Ontario, or leave the province unconfirmed.");
  return errors;
}
export function createFieldService({ db, table, researchRecordExists }) {
  const get = async (pk) =>
    (
      await db.send(
        new GetCommand({ TableName: table, Key: { pk }, ConsistentRead: true })
      )
    ).Item;
  const list = async (type) => {
    const items = [];
    let cursor;
    do {
      const r = await db.send(
        new QueryCommand({
          TableName: table,
          IndexName: "received",
          KeyConditionExpression: "recordType = :type",
          ExpressionAttributeValues: { ":type": type },
          ...(cursor ? { ExclusiveStartKey: cursor } : {}),
          Limit: 250,
        })
      );
      items.push(...(r.Items || []));
      cursor = r.LastEvaluatedKey;
    } while (cursor && items.length < 2000);
    return items;
  };
  function keys(test) {
    return {
      prefix: test ? "MAPS#TEST#" : "MAPS#",
      fieldType: test ? "maps-field-test" : "maps-field",
      activityType: test ? "maps-activity-test" : "maps-activity",
    };
  }
  const publicSite = ({ pk, recordType, expiresAt, ...s }) => s;
  async function snapshot(test = false) {
    const k = keys(test),
      [sites, activities] = await Promise.all([
        list(k.fieldType),
        list(k.activityType),
      ]);
    return {
      fieldSites: sites.map(publicSite),
      activity: Object.fromEntries(
        activities.map((a) => [a.leadId, publicSite(a)])
      ),
    };
  }
  async function handle(path, method, body, actor, { test = false } = {}) {
    const k = keys(test),
      stamp = new Date().toISOString(),
      expiresAt = test ? Math.floor(Date.now() / 1000) + 7 * 86400 : undefined;
    if (path === "/admin/maps/field-sites" && method === "POST") {
      const errors = validateFieldSite(body);
      if (errors.length)
        return { status: 422, data: { error: "Site was not saved.", errors } };
      const id =
        "SAP-F-" +
        (typeof body.requestId === "string" &&
        /^[a-f0-9-]{36}$/i.test(body.requestId)
          ? createHash("sha256")
              .update(actor.id + body.requestId)
              .digest("hex")
              .slice(0, 16)
          : randomUUID().slice(0, 13).replaceAll("-", "")
        ).toUpperCase();
      const existing = await get(k.prefix + "FIELD#" + id);
      if (existing) return { data: { site: publicSite(existing) } };
      const site = {
        pk: k.prefix + "FIELD#" + id,
        recordType: k.fieldType,
        id,
        name: body.name.trim(),
        address: body.address?.trim() || "",
        city: body.city?.trim() || "",
        province: body.province || "",
        notes: body.notes?.trim() || "",
        contractor: body.contractor?.trim() || "",
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy,
        locationCapturedAt:
          typeof body.locationCapturedAt === "string"
            ? body.locationCapturedAt.slice(0, 60)
            : stamp,
        createdAt: stamp,
        createdBy: actor.id,
        receivedAt: stamp,
        ...(expiresAt ? { expiresAt } : {}),
      };
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: table,
                Item: site,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: table,
                Item: {
                  ...site,
                  pk: k.prefix + "FIELD-AUDIT#" + stamp + "#" + randomUUID(),
                  recordType: undefined,
                },
              },
            },
          ],
        })
      );
      return { status: 201, data: { site: publicSite(site) } };
    }
    if (path === "/admin/maps/site-status" && method === "POST") {
      if (
        typeof body.leadId !== "string" ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(body.leadId) ||
        !VISIT_STATES.includes(body.status) ||
        (body.notes !== undefined &&
          (typeof body.notes !== "string" || body.notes.length > 4000))
      )
        return {
          status: 422,
          data: {
            error: "Choose Open, Visited or Will return and valid notes.",
          },
        };
      const exists = body.leadId.startsWith("SAP-F-")
        ? await get(k.prefix + "FIELD#" + body.leadId)
        : await researchRecordExists(body.leadId);
      if (!exists) return { status: 404, data: { error: "Site not found." } };
      const pk = k.prefix + "ACTIVITY#" + body.leadId,
        current = await get(pk);
      if ((body.expectedVersion || null) !== (current?.version || null))
        return {
          status: 409,
          data: {
            error:
              "Another administrator updated this site. Refresh before saving.",
          },
        };
      const activity = {
        pk,
        recordType: k.activityType,
        leadId: body.leadId,
        status: body.status,
        notes: body.notes ?? current?.notes ?? "",
        updatedAt: stamp,
        updatedBy: actor.id,
        receivedAt: stamp,
        version: randomUUID(),
        ...(expiresAt ? { expiresAt } : {}),
      };
      try {
        await db.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: table,
                  Item: activity,
                  ConditionExpression: current
                    ? "version = :version"
                    : "attribute_not_exists(pk)",
                  ...(current
                    ? {
                        ExpressionAttributeValues: {
                          ":version": current.version,
                        },
                      }
                    : {}),
                },
              },
              {
                Put: {
                  TableName: table,
                  Item: {
                    ...activity,
                    pk: k.prefix + "FIELD-AUDIT#" + stamp + "#" + randomUUID(),
                    recordType: undefined,
                    previousStatus: current?.status || "open",
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
            data: {
              error: "This site changed during your update. Refresh and retry.",
            },
          };
        throw e;
      }
      return { data: { activity: publicSite(activity) } };
    }
    if (
      path.startsWith("/admin/maps/field-sites/") &&
      method === "DELETE" &&
      test
    ) {
      const id = path.split("/").pop(),
        site = await get(k.prefix + "FIELD#" + id);
      if (!site || site.createdBy !== actor.id)
        return { status: 404, data: { error: "Test site not found." } };
      await db.send(
        new DeleteCommand({ TableName: table, Key: { pk: site.pk } })
      );
      await db.send(
        new DeleteCommand({
          TableName: table,
          Key: { pk: k.prefix + "ACTIVITY#" + id },
        })
      );
      return { data: { deleted: true } };
    }
    return null;
  }
  return { snapshot, handle };
}
