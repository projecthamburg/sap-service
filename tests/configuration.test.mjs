import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadOperations,
  configureDocument,
} from "../scripts/configuration.mjs";
test("proposal routing cannot silently move to SAP; an unfilled handover profile cannot deploy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "sap-config-"));
  try {
    const profile = JSON.parse(await readFile("config/operations.json"));
    profile.contact.email = "other@business.test";
    const path = join(dir, "config.json");
    await writeFile(path, JSON.stringify(profile));
    await assert.rejects(loadOperations(path), /Proposal intake/);
    await assert.rejects(
      loadOperations(
        new URL("../config/handover.example.json", import.meta.url)
      ),
      /placeholders/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("handover metadata and no-JavaScript contact use the same supplied contact profile", async () => {
  const profile = await loadOperations();
  profile.stage = "live";
  profile.contact = {
    name: "SAP Service Inc.",
    email: "approved@business.test",
    phone: "+15145550123",
  };
  profile.bookingUrl = "https://calendar.business.test/consultation";
  const html = configureDocument(await readFile("index.html", "utf8"), profile);
  assert.ok(html.includes("approved@business.test"));
  assert.ok(html.includes("+15145550123"));
  assert.ok(html.includes(profile.bookingUrl));
  assert.ok(!html.includes("info@projecthamburg.com"));
});
test("consultation copy follows the proposal or approved live operator rather than promising Frank attends", async () => {
  const { getContent } = await import("../src/content.js");
  const proposal = await loadOperations();
  for (const language of ["en", "fr"]) {
    assert.ok(
      getContent(language, proposal).booking.with.includes("Project Hamburg")
    );
    const live = {
      ...proposal,
      stage: "live",
      contact: { name: "Approved SAP operator" },
    };
    assert.ok(
      getContent(language, live).booking.with.includes("Approved SAP operator")
    );
  }
});
