import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server.js';

test('health endpoint reports the API is available', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('protected routes reject missing authentication', async () => {
  const response = await request(app).get('/api/admin/stats');
  assert.equal(response.status, 401);
});