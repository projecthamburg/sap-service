import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  sampleState,
  validateStep,
  restoreState,
} from "../src/model.js";
import {
  measurementWarnings,
  measurementFingerprint,
  measurementWarningText,
} from "../src/measurement-checks.js";
const project = (area) => ({ ...initialState(), area, city: "Montréal" });
test("sample and ordinary project areas do not raise spurious checks", () => {
  assert.equal(measurementWarnings(sampleState()).length, 0);
  assert.equal(measurementWarnings(project(1000)).length, 0);
});
test("100 and 10000 sq ft residential scopes require correction or explicit confirmation", () => {
  for (const area of [100, 10000]) {
    const s = project(area);
    assert.ok(measurementWarnings(s).length);
    assert.equal(validateStep(s, 2).message, "plausibilityError");
    s.measurementConfirmation = measurementFingerprint(s);
    assert.equal(validateStep(s, 2), null);
    assert.equal(s.area, area);
  }
});
test("confirmation is invalidated by a changed measurement and survives normalized server restore", () => {
  const s = project(10000);
  s.measurementConfirmation = measurementFingerprint(s);
  assert.equal(validateStep(restoreState({ version: 1, scope: s }), 2), null);
  s.area = 100000;
  assert.equal(validateStep(s, 2).message, "plausibilityError");
});
test("room confirmation survives regenerated room identifiers", () => {
  const s = sampleState();
  s.rooms[0].length = 240;
  s.measurementConfirmation = measurementFingerprint(s);
  assert.equal(validateStep(restoreState({ version: 1, scope: s }), 2), null);
});
test("multi-unit and gross-area consistency provide independent typo signals", () => {
  assert.ok(measurementWarnings({ ...project(1000), units: 10 }).length);
  assert.ok(
    measurementWarnings({ ...project(1000), gross: 20000 }).some(
      (w) => w.code === "grossShare"
    )
  );
  assert.equal(
    validateStep({ ...project(1000), gross: 900 }, 2).message,
    "grossError"
  );
});
test("warnings are localized and suggestions do not modify supplied measurements", () => {
  const s = project(10000),
    w = measurementWarnings(s)[0];
  assert.match(measurementWarningText(w, "en"), /1,000/);
  assert.match(measurementWarningText(w, "fr", "m2"), /m²/);
  assert.equal(s.area, 10000);
});
