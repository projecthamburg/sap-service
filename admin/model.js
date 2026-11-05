import { TIERS, validateDataset } from "./schema.js";
export { TIERS };
export const COLORS = {
  Immediate: "#ff3b62",
  "Near-term": "#b47717",
  Strategic: "#1e2d53",
  Monitor: "#697688",
  Unqualified: "#777777",
};
export function distance(a, b) {
  const rad = (v) => (v * Math.PI) / 180,
    dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng),
    h =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return (
    6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function point(r) {
  return Number.isFinite(r.latitude_estimate) &&
    Number.isFinite(r.longitude_estimate)
    ? { lat: r.latitude_estimate, lng: r.longitude_estimate }
    : null;
}
export function filterLeads(
  records,
  { search = "", tiers = TIERS, gc = "", stage = "" } = {}
) {
  const q = search.trim().toLocaleLowerCase();
  return records.filter(
    (r) =>
      tiers.includes(r.priority) &&
      (!gc || contractorKey(r.general_contractor) === gc) &&
      (!stage || r.project_stage === stage) &&
      (!q ||
        [
          r.lead_id,
          r.project_name,
          r.city,
          r.general_contractor,
          r.site_address,
          r.owner_developer,
          ...(r.source_ids || []),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q))
  );
}
export function deadlineLabel(value, now = new Date()) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    return `${value}${value === today ? " · today; confirm time" : value < today ? " · past date; review status" : ""}`;
  }
  const date = new Date(value);
  return Number.isNaN(+date)
    ? value
    : date.toLocaleString("en-CA", { timeZone: "America/Toronto" }) +
        " Montréal" +
        (date < now ? " · past; review status" : "");
}
export function csv(records) {
  const keys = Object.keys(records[0] || {});
  const cell = (v) => {
    let s =
      Array.isArray(v) || (v && typeof v === "object")
        ? JSON.stringify(v)
        : String(v ?? "");
    if (typeof v !== "number" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [keys, ...records.map((r) => keys.map((k) => r[k]))]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
export function parseCSV(text) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (quoted || !value) quoted = !quoted;
      else throw Error("Unexpected quote in CSV.");
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw Error("Unclosed CSV quote.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  const keys = rows.shift()?.map((s) => s.replace(/^\uFEFF/, ""));
  if (!keys?.length || new Set(keys).size !== keys.length)
    throw Error("CSV needs unique column names.");
  return rows.map((row, i) => {
    if (row.length !== keys.length)
      throw Error(`CSV row ${i + 2}: wrong column count.`);
    return Object.fromEntries(
      keys.map((k, n) => {
        let v = row[n];
        if (k === "location_audit") {
          try { v = v.trim() ? JSON.parse(v) : undefined; }
          catch { throw Error(`Row ${i + 2}: location_audit contains invalid JSON.`); }
        } else if (
          [
            "sources",
            "source_ids",
            "conflicts",
            "emails",
            "telephones",
            "satellite_sites",
          ].includes(k)
        ) {
          const value = v.trim();
          if (!value) v = [];
          else if (
            k === "satellite_sites" ||
            /^\[\s*(?:["{\d-]|\])/.test(value)
          ) {
            try {
              v = JSON.parse(value);
            } catch {
              throw Error(`Row ${i + 2}: ${k} contains an invalid JSON array.`);
            }
          } else if (["emails", "telephones", "source_ids"].includes(k))
            v = value.split(/\s*;\s*/).filter(Boolean);
          else v = [v]; // Legacy citations contain meaningful internal semicolons; preserve the whole cell.
        } else if (
          [
            "latitude_estimate",
            "longitude_estimate",
            "opportunity_score",
          ].includes(k)
        )
          v = v === "" ? null : Number(v);
        return [k, v];
      })
    );
  });
}
export const importErrors = validateDataset;
export function bearing(a, b) {
  const rad = (v) => (v * Math.PI) / 180,
    lat1 = rad(a.lat),
    lat2 = rad(b.lat),
    dlon = rad(b.lng - a.lng);
  return (
    ((Math.atan2(
      Math.sin(dlon) * Math.cos(lat2),
      Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlon)
    ) *
      180) /
      Math.PI +
      360) %
    360
  );
}
export function approaching(origin, target, heading, speed, radius) {
  if (!Number.isFinite(heading) || !Number.isFinite(speed) || speed < 1)
    return false;
  const d = distance(origin, target),
    delta = Math.abs(((bearing(origin, target) - heading + 540) % 360) - 180);
  return d > radius && d <= radius * 1.5 && delta <= 35;
}

export function contractorName(value = "") {
  const plain = value
    .replace(/\s*\[[^\]]+\]/g, "")
    .split(/\s*\(|\s+[—–]|\s*;/)[0]
    .trim();
  for (const name of [
    "Pomerleau",
    "Frecon",
    "AXOR",
    "PCL",
    "Tisseur",
    "Broccolini",
  ])
    if (new RegExp("\\b" + name + "\\b", "i").test(plain)) return name;
  return plain || "Unknown contractor";
}
export function contractorKey(value) {
  return contractorName(value).toLocaleLowerCase();
}
// A contractor mentioned in a lost bid or a cross-reference is not the project's contractor.
export function contractorAssociation(record, name) {
  const value = record.general_contractor || "",
    prefix = value.split(/\s*\(|\s+[—–]|\s*;/)[0],
    pattern = new RegExp("\\b" + name + "\\b", "i");
  if (pattern.test(prefix)) return true;
  const credited = value.match(
    /with station-level building scopes credited to ([^[]+)/i
  )?.[1];
  return !!credited && pattern.test(credited);
}
export function quickMatch(record, key) {
  if (!key) return true;
  if (key === "healthcare")
    return /hospital|health|healthcare|long.term|ltc|hôpital|santé|aîné|md[ae]|chsld|maison.des.a/i.test(
      [
        record.project_type,
        record.project_name,
        record.cleaning_specifics,
      ].join(" ")
    );
  if (key === "frecon") return /\bfrecon\b/i.test(record.general_contractor);
  return contractorAssociation(record, key);
}
