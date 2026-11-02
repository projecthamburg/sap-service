import test from "node:test";
import assert from "node:assert/strict";
import { validateDataset, createMapsService } from "../api/admin-maps.mjs";
import { authenticatedAdmin } from "../api/admin-auth.mjs";
import {
  distance,
  filterLeads,
  csv,
  parseCSV,
  importErrors,
  deadlineLabel,
} from "../admin/model.js";
import { TEXT_FIELDS } from "../admin/schema.js";
const lead = {
  ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, ""])),
  project_stage: "active construction",
  lead_id: "TEST-001",
  project_name: "TEST project",
  city: "Montréal",
  site_address: "Test address",
  general_contractor: "Test GC",
  priority: "Immediate",
  opportunity_score: 75,
  latitude_estimate: 45.5,
  longitude_estimate: -73.5,
  sources: ["TEST source"],
  source_ids: ["TEST citation"],
  emails: [],
  telephones: [],
  conflicts: [],
};
test("private register rejects duplicate IDs, impossible locations and missing evidence", () => {
  assert.deepEqual(validateDataset([lead]), []);
  assert(validateDataset([lead, lead]).some((s) => s.includes("duplicate")));
  assert(validateDataset([{ ...lead, latitude_estimate: 100 }]).length);
  assert(validateDataset([{ ...lead, sources: [] }]).length);
  assert(validateDataset([{ ...lead, googleVerified: true }]).length);
  assert(importErrors([{ ...lead, opportunity_score: NaN }]).length);
});
test("CSV round-trips research arrays, punctuation and multiline evidence", () => {
  const rows = [
    {
      ...lead,
      project_name: 'Test "quoted", project',
      conflicts: ["A\nB", "C,D"],
    },
  ];
  assert.deepEqual(parseCSV(csv(rows)), rows);
  assert.throws(() => parseCSV('a,b\n"unfinished'));
  assert.throws(() => parseCSV("a,a\n1,2"));
  assert(csv([{ value: '=IMPORTXML("bad")' }]).includes("'=IMPORTXML"));
});
test("radius calculations preserve sub-metre precision and filters combine", () => {
  const a = { lat: 45.5, lng: -73.5 },
    b = { lat: 45.500001, lng: -73.5 };
  assert(distance(a, b) > 0 && distance(a, b) < 1);
  assert.equal(filterLeads([lead], { tiers: ["Monitor"] }).length, 0);
  assert.equal(
    filterLeads([lead], { search: "montréal", gc: "Other" }).length,
    0
  );
  assert.equal(filterLeads([lead], { search: "test gc" }).length, 1);
});
test("date-only follow-ups do not invent a midnight deadline", () => {
  assert.match(
    deadlineLabel("2026-11-02", new Date("2026-11-02T18:00Z")),
    /today; confirm time/
  );
});
test("forged Cognito token cannot authenticate", async () => {
  process.env.COGNITO_POOL_ID = "ca-central-1_test";
  process.env.COGNITO_CLIENT_ID = "test";
  assert.equal(await authenticatedAdmin("fake-token"), null);
});
test("dataset uses private S3 keys, optimistic writes and audit without inbox indexing", async () => {
  const calls = [];
  let current;
  const db = {
    send: async (c) => {
      calls.push(c.input);
      if (c.constructor.name === "GetCommand") return { Item: current };
      current = c.input.TransactItems?.[0]?.Put?.Item;
      return {};
    },
  };
  const s3 = {
    send: async (c) => {
      calls.push(c.input);
      return {};
    },
  };
  const service = createMapsService({
    db,
    s3,
    table: "test-table",
    bucket: "private-test",
  });
  let r = await service(
    "/admin/maps/dataset",
    "POST",
    { records: [lead], expectedVersion: null },
    { id: "test-user" }
  );
  assert.equal(r.data.count, 1);
  assert(calls.some((c) => c.Key?.startsWith?.("admin/maps/datasets/")));
  const transaction = calls.find((c) => c.TransactItems);
  assert.equal(transaction.TransactItems.length, 2);
  assert.equal(transaction.TransactItems[1].Put.Item.recordType, undefined);
  r = await service(
    "/admin/maps/dataset",
    "POST",
    { records: [lead], expectedVersion: null },
    { id: "other-user" }
  );
  assert.equal(r.status, 409);
});

test("contractor bundles exclude lost bids and negative research cross-references", async () => {
  const { quickMatch, contractorAssociation } = await import(
    "../admin/model.js"
  );
  assert.equal(
    quickMatch(
      {
        ...lead,
        general_contractor: "Medifice inc. (confirmed; Pomerleau bid and lost)",
      },
      "pomerleau"
    ),
    false
  );
  assert.equal(
    quickMatch(
      {
        ...lead,
        general_contractor:
          "Mostly unknown — owner-direct track (Pomerleau won a different project, NOT this project)",
      },
      "pomerleau"
    ),
    false
  );
  assert.equal(
    contractorAssociation(
      { ...lead, general_contractor: "Pomerleau-Canam Consortium (confirmed)" },
      "pomerleau"
    ),
    true
  );
  assert.equal(
    contractorAssociation(
      {
        ...lead,
        general_contractor:
          "East-West Connectors (consortium) — with station-level building scopes credited to PCL Constructors, Bird Construction, and Pomerleau [CONFIRMED]",
      },
      "pomerleau"
    ),
    true
  );
});
test("approaching alerts require meaningful movement and a matching heading", async () => {
  const { approaching, bearing } = await import("../admin/model.js"),
    a = { lat: 45.5, lng: -73.5 },
    b = { lat: 45.53, lng: -73.5 };
  assert.equal(approaching(a, b, bearing(a, b), 5, 2500), true);
  assert.equal(approaching(a, b, 180, 5, 2500), false);
  assert.equal(approaching(a, b, 0, 0, 2500), false);
  assert.equal(approaching(a, b, null, 5, 2500), false);
});

test("signed access tokens enforce issuer, client, expiry and SAP admin membership", async () => {
  const { generateKeyPair, SignJWT } = await import(
      "../api/node_modules/jose/dist/webapi/index.js"
    ),
    { verifyAdminToken } = await import("../api/admin-auth.mjs"),
    keys = await generateKeyPair("RS256"),
    issuer = "https://auth.example.test/pool",
    clientId = "sap-only-client";
  const sign = async (overrides = {}, options = {}) =>
    new SignJWT({
      sub: "test-user",
      username: "test",
      "cognito:groups": ["SAPAdmins"],
      token_use: "access",
      client_id: clientId,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(options.issuer || issuer)
      .setIssuedAt()
      .setExpirationTime(options.expiry || "5m")
      .sign(keys.privateKey);
  const verify = async (token) =>
    verifyAdminToken(token, { issuer, clientId, key: keys.publicKey });
  assert.equal((await verify(await sign())).id, "test-user");
  for (const claims of [
    { token_use: "id" },
    { client_id: "different-project" },
    { "cognito:groups": [] },
    { "cognito:groups": "SAPAdmins" },
  ])
    assert.equal(await verify(await sign(claims)), null);
  assert.equal(
    await verify(
      await sign({}, { issuer: "https://different-project.test/pool" })
    ),
    null
  );
  assert.equal(await verify(await sign({}, { expiry: "-1s" })), null);
  const other = await generateKeyPair("RS256");
  const forged = await new SignJWT({
    sub: "test-user",
    "cognito:groups": ["SAPAdmins"],
    token_use: "access",
    client_id: clientId,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(issuer)
    .setExpirationTime("5m")
    .sign(other.privateKey);
  assert.equal(await verify(forged), null);
});

test("location reviews preserve Ontario and Gatineau province boundaries and reject ambiguity", async () => {
  const { provinceForLead, reviewedLocation } = await import(
    "../admin/location.js"
  );
  assert.equal(
    provinceForLead({
      city: "Gatineau",
      region: "Ottawa-Gatineau",
      site_address: "100 Main Street",
    }),
    "QC"
  );
  assert.equal(
    provinceForLead({
      city: "Ottawa",
      region: "Ontario",
      site_address: "401 Smyth Rd, ON",
    }),
    "ON"
  );
  const record = { ...lead, region: "Québec" },
    result = {
      results: [
        {
          types: ["street_address"],
          address_components: [
            { types: ["country"], short_name: "CA" },
            { types: ["administrative_area_level_1"], short_name: "QC" },
          ],
          geometry: { location: { lat: () => 45.501, lng: () => -73.501 } },
        },
      ],
    };
  assert.equal(reviewedLocation(record, result).lat, 45.501);
  assert.throws(
    () =>
      reviewedLocation(record, {
        results: [{ ...result.results[0], partial_match: true }],
      }),
    /Ambiguous/
  );
  assert.throws(
    () =>
      reviewedLocation(record, {
        results: [{ ...result.results[0], types: ["locality"] }],
      }),
    /broad area/
  );
  assert.throws(
    () =>
      reviewedLocation(record, {
        results: [
          {
            ...result.results[0],
            geometry: { location: { lat: () => 47, lng: () => -73 } },
          },
        ],
      }),
    /24 km/
  );
});
test("dossiers escape research text while preserving safe primary-source links", async () => {
  const { dossierHTML } = await import("../admin/views.js");
  const html = dossierHTML(
    {
      ...lead,
      argon_view: "<img src=x onerror=alert(1)>",
      sources: [
        "Evidence https://www.example.com/research — <script>bad()</script>",
      ],
    },
    { w: (a) => a, p: null, analyst: true, reviewed: false }
  );
  assert(!html.includes("<script>"));
  assert(!html.includes("<img src=x"));
  assert(html.includes('href="https://www.example.com/research"'));
  assert(html.includes("&lt;script&gt;"));
});

test("owner legacy CSV accepts contact lists without splitting evidence semicolons", () => {
  const records = parseCSV(
    'emails,telephones,source_ids,sources,conflicts\n"one@example.com; two@example.com","111; 222","Engine A; Engine B","Report (chapter 1; appendix A)","Claim A; conflicting claim B"'
  );
  assert.deepEqual(records[0].emails, ["one@example.com", "two@example.com"]);
  assert.deepEqual(records[0].source_ids, ["Engine A", "Engine B"]);
  assert.deepEqual(records[0].sources, ["Report (chapter 1; appendix A)"]);
  assert.deepEqual(records[0].conflicts, ["Claim A; conflicting claim B"]);
});

test("account revocation uses a strongly consistent dedicated key and fails closed", async () => {
  const { revokedAdmin } = await import("../api/admin-auth.mjs");
  let input;
  const db = {
    send: async (command) => {
      input = command.input;
      return { Item: { revoked: true } };
    },
  };
  assert.equal(await revokedAdmin(db, "sap-table", "test-user"), true);
  assert.equal(input.ConsistentRead, true);
  assert.equal(input.Key.pk, "ADMIN#REVOKED#test-user");
  assert.equal(
    await revokedAdmin({ send: async () => ({}) }, "sap-table", "test-user"),
    false
  );
  assert.equal(
    await revokedAdmin(
      {
        send: async () => {
          throw Error("Dynamo unavailable");
        },
      },
      "sap-table",
      "test-user"
    ),
    true
  );
});
