import test from "node:test";
import assert from "node:assert/strict";
import { createFieldService, validateFieldSite } from "../api/map-field.mjs";
import { drivingURL, fieldLead, sitePinSVG } from "../admin/field.js";
const input = {
  name: "Test construction site",
  lat: 45.55,
  lng: -73.55,
  accuracy: 8,
  requestId: "12345678-1234-1234-1234-123456789abc",
  address: "TEST address",
  city: "Montréal",
  province: "QC",
  notes: "Test-only observation",
};
function memory() {
  const rows = new Map();
  return {
    rows,
    db: {
      send: async (command) => {
        const i = command.input;
        if (command.constructor.name === "GetCommand")
          return { Item: rows.get(i.Key.pk) };
        if (command.constructor.name === "QueryCommand")
          return {
            Items: [...rows.values()].filter(
              (r) => r.recordType === i.ExpressionAttributeValues[":type"]
            ),
          };
        if (command.constructor.name === "DeleteCommand") {
          rows.delete(i.Key.pk);
          return {};
        }
        if (command.constructor.name === "TransactWriteCommand") {
          for (const a of i.TransactItems) {
            const p = a.Put,
              previous = rows.get(p.Item.pk);
            if (
              (p.ConditionExpression === "attribute_not_exists(pk)" &&
                previous) ||
              (p.ExpressionAttributeValues?.[":version"] &&
                p.ExpressionAttributeValues[":version"] !== previous?.version)
            )
              throw Object.assign(Error("Conflict"), {
                name: "TransactionCanceledException",
              });
          }
          for (const a of i.TransactItems)
            rows.set(a.Put.Item.pk, structuredClone(a.Put.Item));
          return {};
        }
        throw Error("Unexpected command");
      },
    },
  };
}
test("field capture requires an honest GPS position and confirmation for coarse fixes", () => {
  assert.deepEqual(validateFieldSite(input), []);
  assert(validateFieldSite({ ...input, name: "a" }).length);
  assert(validateFieldSite({ ...input, lat: 150 }).length);
  assert(validateFieldSite({ ...input, accuracy: 500 }).length);
  assert.deepEqual(
    validateFieldSite({ ...input, accuracy: 500, confirmLocation: true }),
    []
  );
});
test("test field sites are isolated, idempotent and do not become research claims", async () => {
  const { db, rows } = memory(),
    service = createFieldService({
      db,
      table: "test",
      researchRecordExists: async () => true,
    }),
    actor = { id: "audit-operator" },
    a = await service.handle("/admin/maps/field-sites", "POST", input, actor, {
      test: true,
    }),
    b = await service.handle("/admin/maps/field-sites", "POST", input, actor, {
      test: true,
    });
  assert.equal(a.status, 201);
  assert.equal(a.data.site.id, b.data.site.id);
  assert.equal((await service.snapshot(false)).fieldSites.length, 0);
  assert.equal((await service.snapshot(true)).fieldSites.length, 1);
  const lead = fieldLead(a.data.site);
  assert.equal(lead.priority, "Unqualified");
  assert.equal(lead.opportunity_score, 0);
  assert.equal(lead.isFieldSite, true);
  assert([...rows.keys()].every((k) => k.startsWith("MAPS#TEST#")));
});
test("visited / return / reopened changes persist with audit and reject stale versions", async () => {
  const { db, rows } = memory(),
    service = createFieldService({
      db,
      table: "test",
      researchRecordExists: async (id) => id === "SAP-C001",
    }),
    actor = { id: "operator" };
  let version = null;
  for (const state of ["visited", "return", "open"]) {
    const r = await service.handle(
      "/admin/maps/site-status",
      "POST",
      {
        leadId: "SAP-C001",
        status: state,
        expectedVersion: version,
        notes: "Recorded in test",
      },
      actor,
      { test: true }
    );
    assert.equal(r.data.activity.status, state);
    version = r.data.activity.version;
  }
  const stale = await service.handle(
    "/admin/maps/site-status",
    "POST",
    { leadId: "SAP-C001", status: "visited", expectedVersion: null },
    actor,
    { test: true }
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await service.snapshot(true)).activity["SAP-C001"].status,
    "open"
  );
  assert.equal((await service.snapshot(false)).activity["SAP-C001"], undefined);
  assert([...rows.values()].some((r) => r.previousStatus === "visited"));
});
test("driving links use current GPS as origin, car mode and navigation without a fabricated origin", () => {
  const url = new URL(drivingURL({ lat: 45, lng: -73 }, { lat: 46, lng: -74 }));
  assert.equal(url.searchParams.get("origin"), "46,-74");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.get("dir_action"), "navigate");
  assert.equal(
    new URL(drivingURL({ lat: 45, lng: -73 })).searchParams.has("origin"),
    false
  );
});
test("construction markers have distinct shapes and safe status badges", () => {
  const a = sitePinSVG({ style: "building" }),
    b = sitePinSVG({ style: "hardhat" });
  assert.notEqual(a, b);
  assert(sitePinSVG({ state: "visited" }).includes("#247753"));
  assert(!sitePinSVG({ color: '" onload="alert(1)' }).includes("onload"));
});
