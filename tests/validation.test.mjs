import test from "node:test";
import assert from "node:assert/strict";
import { validateAttachment, validatePayload } from "../api/validation.mjs";

test("PDF validation requires both the file signature and matching MIME type", async () => {
  assert.equal(
    await validateAttachment(
      new File(["%PDF-1.7\nsynthetic"], "cv.pdf", { type: "application/pdf" }),
      "application"
    ),
    true
  );
  assert.equal(
    await validateAttachment(
      new File(["executable bytes"], "cv.pdf", { type: "application/pdf" }),
      "application"
    ),
    false
  );
  assert.equal(
    await validateAttachment(
      new File(["%PDF-1.7\nsynthetic"], "cv.pdf", { type: "image/png" }),
      "application"
    ),
    false
  );
});
test("DOCX validation requires a Word document package rather than an arbitrary ZIP", async () => {
  const prefix = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  assert.equal(
    await validateAttachment(
      new File([prefix, "random archive"], "cv.docx", {
        type: "application/zip",
      }),
      "application"
    ),
    false
  );
  assert.equal(
    await validateAttachment(
      new File([prefix, "[Content_Types].xml word/document.xml"], "cv.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      "application"
    ),
    true
  );
});
test("unsupported image formats and empty documents are rejected", async () => {
  assert.equal(
    await validateAttachment(
      new File(["GIF89a"], "image.gif", { type: "image/gif" }),
      "quote"
    ),
    false
  );
  assert.equal(
    await validateAttachment(
      new File([], "cv.pdf", { type: "application/pdf" }),
      "application"
    ),
    false
  );
});
test("application validation rejects unavailable consent, header-injection emails and missing availability", () => {
  const payload = {
    name: "Synthetic",
    email: "qa@example.com",
    phone: "514-000-0000",
    city: "Montréal",
    regions: "Montréal",
    languages: "French",
    availability: ["0-0"],
    consent: true,
    language: "fr",
  };
  assert.equal(validatePayload(payload, "application"), null);
  for (const changed of [
    { consent: false },
    { email: "qa@example.com\nBcc: other@example.com" },
    { availability: [] },
    { city: {} },
  ])
    assert.equal(
      typeof validatePayload({ ...payload, ...changed }, "application"),
      "string"
    );
});
