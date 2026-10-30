export function validatePayload(payload, kind) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.consent !== true ||
    payload.website
  )
    return "Consent and a valid request are required.";
  const name = kind === "quote" ? payload.contact?.name : payload.name,
    email = kind === "quote" ? payload.contact?.email : payload.email;
  if (typeof name !== "string" || !name.trim() || name.length > 200)
    return "A name is required.";
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    /[\r\n]/.test(email)
  )
    return "A valid email is required.";
  if (JSON.stringify(payload).length > 100000)
    return "The request is too large.";
  if (!["en", "fr"].includes(payload.language))
    return "A supported language is required.";
  if (
    kind === "quote" &&
    (!payload.estimate ||
      !Array.isArray(payload.estimate.scope?.phases) ||
      !payload.estimate.scope.phases.length)
  )
    return "A cleaning scope is required.";
  if (kind === "application") {
    if (
      !["city", "phone", "regions", "languages"].every(
        (key) =>
          typeof payload[key] === "string" &&
          payload[key].trim() &&
          payload[key].length <= 250
      )
    )
      return "Please complete the required application fields.";
    if (
      !Array.isArray(payload.availability) ||
      payload.availability.some(
        (v) => typeof v !== "string" || !/^[0-6]-[0-3]$/.test(v)
      )
    )
      return "Invalid availability.";
    if (
      !payload.availability.length &&
      !(typeof payload.hours === "string" && payload.hours.trim())
    )
      return "Availability is required.";
  }
  return null;
}
export async function validateAttachment(file, kind) {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.arrayBuffer !== "function" ||
    !file.size
  )
    return false;
  if (file.size > (kind === "application" ? 5 : 10) * 1024 * 1024) return false;
  const ext = file.name.split(".").pop().toLowerCase(),
    bytes = new Uint8Array(
      await file.slice(0, Math.min(file.size, 512)).arrayBuffer()
    );
  const starts = (...values) => values.every((v, i) => bytes[i] === v);
  if (ext === "pdf")
    return (
      (!file.type || file.type === "application/pdf") &&
      new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    );
  if (kind === "application" && ext === "docx") {
    if (
      file.type &&
      ![
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/zip",
      ].includes(file.type)
    )
      return false;
    if (!starts(0x50, 0x4b, 0x03, 0x04)) return false;
    const directory = new TextDecoder("latin1").decode(
      await file.arrayBuffer()
    );
    return (
      directory.includes("[Content_Types].xml") &&
      directory.includes("word/document.xml")
    );
  }
  if (kind === "application") return false;
  if (["jpg", "jpeg"].includes(ext))
    return (
      (!file.type || file.type === "image/jpeg") && starts(0xff, 0xd8, 0xff)
    );
  if (ext === "png")
    return (
      (!file.type || file.type === "image/png") &&
      starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    );
  if (ext === "webp")
    return (
      (!file.type || file.type === "image/webp") &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
