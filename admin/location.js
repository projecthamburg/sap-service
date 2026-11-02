import { point, distance } from "./model.js";
export function provinceForLead(record) {
  const text = [record.site_address, record.region, record.city].join(" "),
    on = /\bON\b|\bOntario\b/i.test(text),
    qc = /\bQC\b|Québec|Quebec/i.test(text);
  if (on && !qc) return "ON";
  if (qc && !on) return "QC";
  if (on && qc) return null;
  if (
    /gatineau|montréal|montreal|laval|brossard|longueuil|québec|quebec/i.test(
      record.city
    )
  )
    return "QC";
  if (
    /ottawa|kingston|cornwall|casselman|deep river|the nation/i.test(
      record.city
    )
  )
    return "ON";
  return null;
}
export function reviewedLocation(record, result) {
  const hit = result.results?.[0],
    expected = provinceForLead(record);
  if (!expected)
    throw Error(
      "Province is ambiguous in the research. Review the address manually."
    );
  if (!hit || hit.partial_match)
    throw Error(
      "Ambiguous address. Keep research coordinates and review manually."
    );
  const part = (type) =>
    hit.address_components?.find((a) => a.types.includes(type))?.short_name;
  if (
    part("country") !== "CA" ||
    part("administrative_area_level_1") !== expected
  )
    throw Error(
      "Country or province differs from the research. Manual review required."
    );
  if (
    !hit.types?.some((t) =>
      [
        "street_address",
        "premise",
        "subpremise",
        "intersection",
        "establishment",
        "point_of_interest",
        "route",
      ].includes(t)
    )
  )
    throw Error(
      "Only a broad area was located. Keep the research point and review the address."
    );
  const c = {
    lat: hit.geometry.location.lat(),
    lng: hit.geometry.location.lng(),
  };
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng))
    throw Error("Invalid map location.");
  if (point(record) && distance(point(record), c) > 24140)
    throw Error(
      "Location differs by more than 24 km. Research point preserved; review the address."
    );
  return c;
}
