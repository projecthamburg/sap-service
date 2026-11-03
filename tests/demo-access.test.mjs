import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRequestAllowed } from '../api/admin-auth.mjs';
import { createMapsService } from '../api/admin-maps.mjs';

test('demo credentials allow only map reads, including when private or write routes are called directly', () => {
  const demo = { id: 'demo-user', demo: true };
  for (const path of ['/admin/session', '/admin/maps/config', '/admin/maps/dataset']) {
    assert.equal(adminRequestAllowed(demo, path, 'GET'), true);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'])
      assert.equal(adminRequestAllowed(demo, path, method), false);
  }
  for (const path of ['/admin/submissions', '/admin/submissions/private-id', '/admin/files/private-id', '/admin/maps/site-status', '/admin/maps/field-sites', '/v1/plan-review/start', '/uploads', '/complete']) {
    for (const method of ['GET', 'POST', 'DELETE']) assert.equal(adminRequestAllowed(demo, path, method), false);
    assert.equal(adminRequestAllowed({ id: 'staff' }, path, 'POST'), true);
  }
});

test('demo map reads omit every live observation and note without querying the field index', async () => {
  const dbCalls = [], objectCalls = [];
  const db = { send: async (command) => {
    dbCalls.push(command.input);
    assert.equal(command.input.Key.pk, 'MAPS#DATASET');
    return { Item: { key: 'research.json', version: 'research-version', source: 'Reviewed register' } };
  } };
  const records = [{ lead_id: 'SAP-C001', project_name: 'Research fixture' }];
  const s3 = { send: async (command) => {
    objectCalls.push(command.input);
    return { Body: { transformToString: async () => JSON.stringify(records) } };
  } };
  const service = createMapsService({ db, s3, table: 'private-table', bucket: 'private-bucket' });
  const demo = { id: 'demo', demo: true };
  const session = await service('/admin/session', 'GET', {}, demo);
  assert.equal(session.data.demo, true);
  const result = await service('/admin/maps/dataset', 'GET', {}, demo, { test: true });
  assert.deepEqual(result.data.records, records);
  assert.deepEqual(result.data.fieldSites, []);
  assert.deepEqual(result.data.activity, {});
  assert.equal(dbCalls.length, 1);
  assert.equal(objectCalls.length, 1);
  for (const [path, method] of [['/admin/maps/dataset', 'POST'], ['/admin/maps/field-sites', 'POST'], ['/admin/maps/site-status', 'POST'], ['/admin/submissions', 'GET'], ['/admin/maps/field-sites/test-id', 'DELETE']]) {
    assert.equal((await service(path, method, { records: [] }, demo, { test: true })).status, 403);
  }
  assert.equal(dbCalls.length, 1);
  assert.equal(objectCalls.length, 1);
});
