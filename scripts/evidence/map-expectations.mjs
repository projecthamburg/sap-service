import { readFile } from 'node:fs/promises';
export async function mapExpectations() {
  const path = process.env.SAP_MAP_AUDIT_EXPECTATIONS || '.local/admin-map/audit-expectations.json';
  const expected = JSON.parse(await readFile(path, 'utf8'));
  if (!Number.isInteger(expected.count) || expected.count < 1 || expected.records?.length !== expected.count || new Set(expected.records.map(r=>r.id)).size !== expected.count)
    throw Error('Supply independent map expectations from the approved source audit: ' + path);
  return expected;
}
// Observe real SDK Marker objects; never replace map data or fabricate coordinates.
export function observeGoogleMarkers() {
  const Original = window.google.maps.Marker;
  window.__sapAuditMarkers = [];
  function ObservedMarker(options) {
    const marker = new Original(options);
    window.__sapAuditMarkers.push(marker);
    return marker;
  }
  Object.setPrototypeOf(ObservedMarker, Original);
  ObservedMarker.prototype = Original.prototype;
  window.google.maps.Marker = ObservedMarker;
}
export function renderedGooglePoints() {
  return (window.__sapAuditMarkers || []).filter(m=>m.getMap()).map(m=>({title:m.getTitle(),lat:m.getPosition().lat(),lng:m.getPosition().lng()}));
}
export function researchMatchesAudit(records, expected) {
  return records.length === expected.count && new Set(records.map(r=>r.lead_id)).size === expected.count && expected.records.every(e=>{
    const r = records.find(r=>r.lead_id===e.id);
    return r && r.project_name===e.name && r.site_address===e.address && r.city===e.city &&
      Math.abs(r.latitude_estimate-e.lat)<1e-9 && Math.abs(r.longitude_estimate-e.lng)<1e-9 &&
      r.location_audit?.status===e.auditStatus && r.location_audit?.sha256===expected.sourceSha256;
  });
}
