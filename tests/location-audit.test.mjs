import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT_FIELDS, validateDataset } from '../admin/schema.js';
import { csv, parseCSV } from '../admin/model.js';
import { locationForMap } from '../admin/location.js';
const audit = {date:'2026-11-05',source:'owner-audit.txt',sha256:'a'.repeat(64),status:'finished',confidence:'medium',approximateAreaKm2:0.1};
const record = {...Object.fromEntries(TEXT_FIELDS.map(k=>[k,''])),lead_id:'SAP-C030',project_name:'Audit fixture',site_address:'281 boulevard Saint-Joseph',city:'Gatineau',general_contractor:'To confirm',project_stage:'post-handover',priority:'Monitor',opportunity_score:0,latitude_estimate:45.438541,longitude_estimate:-75.733343,sources:['Owner audit'],source_ids:['AUDIT'],conflicts:[],emails:[],telephones:[],location_audit:audit};
test('location audit requires traceable source, valid date, status, confidence, area and a point',()=>{
  assert.deepEqual(validateDataset([record]),[]);
  for(const bad of [{date:'2026-02-30'},{sha256:'missing'},{status:'confirmed contract'},{confidence:'guaranteed'},{approximateAreaKm2:0},{unexpected:true}])
    assert.ok(validateDataset([{...record,location_audit:{...audit,...bad}}]).length);
  assert.ok(validateDataset([{...record,latitude_estimate:null,longitude_estimate:null}]).length);
});
test('audited point wins over a conflicting Google session review and remains the fallback point',()=>{
  const conflicting={lat:45.47,lng:-75.74};
  assert.deepEqual(locationForMap(record,conflicting),{lat:45.438541,lng:-75.733343});
  assert.deepEqual(locationForMap(record),{lat:45.438541,lng:-75.733343});
  const {location_audit,...unreviewed}=record;
  assert.deepEqual(locationForMap(unreviewed,conflicting),conflicting);
});
test('CSV export/import preserves the audited point and complete provenance object',()=>{
  const restored=parseCSV(csv([record]));
  assert.deepEqual(restored,[record]);
  assert.deepEqual(validateDataset(restored),[]);
});
