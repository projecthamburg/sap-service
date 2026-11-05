export const TIERS = [
  "Immediate",
  "Near-term",
  "Strategic",
  "Monitor",
  "Unqualified",
];
export const TEXT_FIELDS = [
  "lead_id",
  "project_name",
  "project_type",
  "owner_developer",
  "general_contractor",
  "procurement_chain",
  "contact_name",
  "contact_role",
  "contact_company",
  "site_address",
  "city",
  "region",
  "site_location_description",
  "coordinates_basis",
  "project_description",
  "cleaning_specifics",
  "project_stage",
  "timeline_notes",
  "start_date",
  "deadline",
  "deadline_type",
  "next_action",
  "follow_up_date",
  "evidence_confidence",
  "priority",
  "argon_view",
];
const ARRAY_FIELDS = [
  "sources",
  "source_ids",
  "conflicts",
  "emails",
  "telephones",
];
const STAGES = [
  "planning/zoning",
  "tender/award",
  "active construction",
  "interior finishing",
  "inspection/handover",
  "post-handover",
  "reopening/reconstruction",
];
const ALLOWED = new Set([
  ...TEXT_FIELDS,
  ...ARRAY_FIELDS,
  "latitude_estimate",
  "longitude_estimate",
  "opportunity_score",
  "satellite_sites",
  "location_audit",
]);
export function validateDataset(records) {
  const errors = [],
    ids = new Set();
  if (!Array.isArray(records) || !records.length || records.length > 2000)
    return ["Provide 1–2000 lead records."];
  records.forEach((r, i) => {
    const p = `Row ${i + 1}`;
    if (!r || typeof r !== "object" || Array.isArray(r)) {
      errors.push(`${p}: invalid record.`);
      return;
    }
    const unknown = Object.keys(r).filter((k) => !ALLOWED.has(k));
    if (unknown.length)
      errors.push(
        `${p}: unsupported fields (${unknown.join(", ")}). Google review and GPS data must stay outside the research register.`
      );
    for (const k of TEXT_FIELDS)
      if (typeof r[k] !== "string" || r[k].length > 30000)
        errors.push(`${p}: ${k} must be text, up to 30,000 characters.`);
    if (
      typeof r.lead_id !== "string" ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(r.lead_id) ||
      ids.has(r.lead_id)
    )
      errors.push(`${p}: invalid or duplicate lead ID.`);
    ids.add(r.lead_id);
    for (const k of [
      "project_name",
      "site_address",
      "city",
      "general_contractor",
    ])
      if (typeof r[k] !== "string" || !r[k].trim())
        errors.push(`${p}: ${k} is required.`);
    if (!TIERS.includes(r.priority)) errors.push(`${p}: invalid priority.`);
    if (!STAGES.includes(r.project_stage))
      errors.push(`${p}: invalid project stage.`);
    if (
      !Number.isFinite(r.opportunity_score) ||
      r.opportunity_score < 0 ||
      r.opportunity_score > 100
    )
      errors.push(`${p}: score must be 0–100.`);
    for (const [k, max] of [
      ["latitude_estimate", 90],
      ["longitude_estimate", 180],
    ])
      if (r[k] !== null && (!Number.isFinite(r[k]) || Math.abs(r[k]) > max))
        errors.push(`${p}: invalid ${k}.`);
    if ((r.latitude_estimate === null) !== (r.longitude_estimate === null))
      errors.push(`${p}: supply both coordinates or leave both null.`);
    for (const k of ARRAY_FIELDS)
      if (
        !Array.isArray(r[k]) ||
        r[k].length > 200 ||
        r[k].some((v) => typeof v !== "string" || v.length > 30000)
      )
        errors.push(`${p}: ${k} must be a text array (up to 200 items).`);
    if (!r.sources?.length || !r.source_ids?.length)
      errors.push(`${p}: research citations are required.`);
    if (r.location_audit !== undefined) {
      const a = r.location_audit;
      if (!a || typeof a !== "object" || Array.isArray(a) ||
          Object.keys(a).some(k => !["date", "source", "sha256", "status", "confidence", "approximateAreaKm2"].includes(k)) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(a.date || "") ||
          !Number.isFinite(Date.parse(a.date + "T12:00:00Z")) ||
          new Date(a.date + "T12:00:00Z").toISOString().slice(0, 10) !== a.date ||
          typeof a.source !== "string" || !a.source.trim() || a.source.length > 500 ||
          !/^[a-f0-9]{64}$/.test(a.sha256 || "") ||
          !["active", "finishing", "finished"].includes(a.status) ||
          !["high", "medium", "low"].includes(a.confidence) ||
          !Number.isFinite(a.approximateAreaKm2) || a.approximateAreaKm2 <= 0 || a.approximateAreaKm2 > 1000 ||
          !Number.isFinite(r.latitude_estimate) || !Number.isFinite(r.longitude_estimate))
        errors.push(`${p}: invalid location audit. Supply the source/date/hash, audited status/confidence, area and coordinates.`);
    }
    if (
      r.satellite_sites !== undefined &&
      (!Array.isArray(r.satellite_sites) ||
        r.satellite_sites.length > 100 ||
        r.satellite_sites.some(
          (s) =>
            !s ||
            typeof s.label !== "string" ||
            typeof s.address !== "string" ||
            !Number.isFinite(s.lat) ||
            Math.abs(s.lat) > 90 ||
            !Number.isFinite(s.lng) ||
            Math.abs(s.lng) > 180
        ))
    )
      errors.push(
        `${p}: satellite sites require explicit labels, addresses and valid coordinates.`
      );
    if (JSON.stringify(r).length > 100000)
      errors.push(`${p}: record too large.`);
  });
  return errors;
}
