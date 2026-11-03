import test from "node:test";
import assert from "node:assert/strict";
import {
  readable,
  siteTitle,
  companyLabel,
  stageLabel,
  priorityLabel,
  contactOptions,
  fieldDate,
} from "../admin/presentation.js";
const en = (a, b) => a,
  fr = (a, b) => b;
test("Field titles suppress budget/procurement annotations and keep phase identifiers", () => {
  assert.equal(
    siteTitle("Sample health centre ($12M DBFM facility)"),
    "Sample health centre"
  );
  assert.equal(
    siteTitle("Sample health centre (Phase 2)"),
    "Sample health centre (Phase 2)"
  );
  assert.equal(siteTitle("Sample centre (45-bed facility)"), "Sample centre");
  assert.equal(
    readable("Example [CONFIRMED] · Room [B2]"),
    "Example · Room [B2]"
  );
});
test("Display labels retain uncertainty without presenting unknown companies as assigned contractors", () => {
  const r = { general_contractor: "unknown / TBD (planning only) [CONFIRMED]" };
  const before = JSON.stringify(r);
  assert.equal(companyLabel(r, en), "Not listed");
  assert.equal(JSON.stringify(r), before);
  assert.equal(
    companyLabel({ general_contractor: "Example Builders (bidding)" }, en),
    "Example Builders"
  );
  assert.equal(stageLabel("planning/zoning", en), "Planning");
  assert.equal(priorityLabel("Monitor", en), "Watchlist");
  assert.equal(stageLabel("tender/award", fr), "Appel d’offres");
  assert.equal(priorityLabel("Unqualified", fr), "Site enregistré");
});
test("Field contact actions keep phone extensions separate and reject unsafe contact links", () => {
  const r = {
    project_name: "Sample <site> & phase",
    telephones: ["+1 (514) 555-0100 ext. 123", "javascript:alert(1)", "123"],
    emails: [
      "crew+site@example.com",
      "x@example.com?bcc=elsewhere",
      "x%0a@example.com",
    ],
  };
  const before = JSON.stringify(r);
  const c = contactOptions(r);
  assert.deepEqual(c.phones, [
    { label: r.telephones[0], href: "tel:+15145550100;ext=123" },
  ]);
  assert.equal(c.emails.length, 1);
  assert.equal(
    decodeURIComponent(c.emails[0].href.split("?")[0].slice(7)),
    "crew+site@example.com"
  );
  assert.equal(
    new URL(c.emails[0].href).searchParams.get("subject"),
    r.project_name
  );
  assert.equal(JSON.stringify(r), before);
});

test("Field dates keep calendar days intact and hide internal scheduling annotations", () => {
  assert.match(fieldDate("2026-11-02", en), /Nov.*2.*2026/);
  assert.match(
    fieldDate("2026-11-02 · today; confirm time", en),
    /Nov.*2.*2026/
  );
  assert.equal(fieldDate("2026-02-31", en), "");
  assert.equal(fieldDate("not yet known", en), "");
  assert.match(fieldDate("2026-11-02T19:00:00Z", en), /2:00/);
});
