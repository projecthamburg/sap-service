import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const code = await readFile("src/scheduler-bridge.js", "utf8");
async function bridge({
  path = "/booking/sap-service-cleanup",
  templateId = 6,
  time = "14:00",
  date = "2026-11-02",
  timezone = "America/Toronto",
} = {}) {
  const original = {
      success: true,
      booking: {
        id: 48,
        bookingDate: date + "T00:00:00.000Z",
        bookingTime: time,
        durationMinutes: 30,
        timezone,
      },
    },
    location = {
      hostname: "schedule.projecthamburg.com",
      origin: "https://schedule.projecthamburg.com",
      pathname: path,
      href: "https://schedule.projecthamburg.com" + path,
    },
    window = {
      fetch: async () =>
        new Response(JSON.stringify(original), { status: 201 }),
    };
  const fetchBefore = window.fetch;
  runInNewContext(code, {
    window,
    location,
    URL,
    Response,
    Headers,
    Intl,
    Date,
    JSON,
  });
  const request = {
    templateId,
    bookingDate: date,
    bookingTime: time,
    timezone,
  };
  const response = await window.fetch("/api/booking/submit", {
    method: "POST",
    body: JSON.stringify(request),
  });
  return {
    data: await response.json(),
    request,
    original,
    unchanged: window.fetch === fetchBefore,
  };
}
test("SAP confirmation displays selected calendar day and converts stored UTC time", async () => {
  const r = await bridge();
  assert.equal(r.data.booking.bookingDate, "2026-11-02T12:00:00");
  assert.equal(r.data.booking.bookingTime, "09:00");
  assert.equal(r.request.bookingTime, "14:00");
  assert.equal(r.original.booking.bookingTime, "14:00");
});
test("SAP confirmation conversion respects summer daylight time and visitor timezone", async () => {
  assert.equal(
    (await bridge({ date: "2027-06-01", time: "13:30" })).data.booking
      .bookingTime,
    "09:30"
  );
  assert.equal(
    (await bridge({ time: "14:00", timezone: "Europe/London" })).data.booking
      .bookingTime,
    "14:00"
  );
});
test("compatibility adapter leaves other pages and templates unchanged", async () => {
  assert.equal(
    (await bridge({ path: "/booking/consultation-maplescholar" })).unchanged,
    true
  );
  const r = await bridge({ templateId: 2 });
  assert.deepEqual(r.data, r.original);
});
