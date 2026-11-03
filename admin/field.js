import { TEXT_FIELDS } from "./schema.js";
export const VISIT_LABELS = {
  open: ["Open", "Ouvert"],
  visited: ["Visited", "Visité"],
  return: ["Will return", "À revisiter"],
};
export function fieldLead(site) {
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, ""])),
    lead_id: site.id,
    project_name: site.name,
    project_type: "Field observation",
    general_contractor: site.contractor || "Not identified",
    site_address: site.address || "Address to confirm · GPS field observation",
    city: site.city || "To confirm",
    region: site.province || "Province to confirm",
    project_description: site.notes,
    project_stage: "Field observation",
    latitude_estimate: site.lat,
    longitude_estimate: site.lng,
    coordinates_basis: `GPS observation ±${Math.round(site.accuracy)} m · ${site.locationCapturedAt}`,
    priority: "Unqualified",
    opportunity_score: 0,
    evidence_confidence: "Field observation · commercial details unverified",
    sources: [
      `Saved by an invited operator at ${site.createdAt}. Location intentionally recorded from browser GPS; not AI-generated.`,
    ],
    source_ids: [site.id],
    conflicts: [],
    emails: [],
    telephones: [],
    isFieldSite: true,
  };
}
export function drivingURL(destination, origin) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("dir_action", "navigate");
  if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng))
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  return url.href;
}
const glyphs = {
  building:
    '<path d="M12 27V12h12v15M10 27h16M16 16h1m3 0h1m-5 4h1m3 0h1m-4 7v-4h2v4"/>',
  hardhat:
    '<path d="M10 23h16M12 22v-3a6 6 0 0 1 12 0v3M16 14v6m4-6v6M11 25h14"/>',
  crane:
    '<path d="M13 28V11h3v17M11 28h7M9 12h19L16 8l-3 4M23 12v10m-2 0a2 2 0 0 0 4 0M13 17l3 4m-3 0 3 4"/>',
};
export function sitePinSVG({
  color = "#657082",
  style = "building",
  state = "open",
  selected = false,
} = {}) {
  const glyph = glyphs[style] || glyphs.building,
    badge =
      state === "visited"
        ? '<circle cx="28" cy="8" r="7" fill="#247753" stroke="white" stroke-width="2"/><path d="m25 8 2 2 4-4" stroke="white" stroke-width="1.8" fill="none"/>'
        : state === "return"
          ? '<circle cx="28" cy="8" r="7" fill="#a76808" stroke="white" stroke-width="2"/><path d="M25 8a3 3 0 1 1 1 3m-1-6v3h3" stroke="white" stroke-width="1.5" fill="none"/>'
          : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46"><path d="M18 44S3 29 3 18a15 15 0 1 1 30 0c0 11-15 26-15 26Z" fill="${/^#[a-f0-9]{6}$/i.test(color) ? color : "#657082"}" stroke="${selected ? "#ff3b62" : "#fff"}" stroke-width="${selected ? 3 : 2}"/><g fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>${badge}</svg>`;
}
