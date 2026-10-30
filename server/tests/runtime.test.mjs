import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl, fetchApiWithFallback, randomId } from '../app/static/runtime.mjs';

test('APK uses bundled catalog but the configured HTTPS server for progress', () => {
  assert.equal(apiUrl('/api/v1/catalog', true), '/static/catalog.json');
  assert.match(apiUrl('/api/v1/progress', true), /^https:\/\/[^/]+\/api\/v1\/progress$/);
  assert.equal(apiUrl('/api/v1/progress', false), '/api/v1/progress');
});
test('API routing rejects unrelated and protocol-relative destinations', () => {
  for (const value of ['https://evil.test', '//evil.test', '/static/app.js', '/api/\\evil.test']) {
    assert.throws(() => apiUrl(value, true));
  }
});
test('device and retry identifiers are unique UUIDs', () => {
  const first = randomId(), second = randomId();
  assert.match(first, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.notEqual(first, second);
});
test('network failure uses only the configured HTTPS fallback', async () => {
  const urls = [];
  const result = await fetchApiWithFallback('/api/v1/progress', { method: 'POST' },
    ['https://primary.example', 'https://backup.example'], async url => {
      urls.push(url);
      if (url.startsWith('https://primary')) throw new TypeError('Failed to fetch');
      return { ok: true, status: 200 };
    });
  assert.equal(result.index, 1);
  assert.deepEqual(urls, ['https://primary.example/api/v1/progress', 'https://backup.example/api/v1/progress']);
});
test('HTTP conflict and caller cancellation never replay a request on fallback', async () => {
  let calls = 0;
  const conflict = await fetchApiWithFallback('/api/v1/progress', {},
    ['https://primary.example', 'https://backup.example'], async () => { calls++; return { ok: false, status: 409 }; });
  assert.equal(conflict.response.status, 409);
  assert.equal(calls, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchApiWithFallback('/api/v1/progress', { signal: controller.signal },
    ['https://primary.example', 'https://backup.example'], async (_, options) => {
      calls++;
      assert.equal(options.signal.aborted, true);
      throw new DOMException('Aborted', 'AbortError');
    }), { name: 'AbortError' });
  assert.equal(calls, 2);
});
test('fallback rejects non-HTTPS or decorated origins', async () => {
  for (const origin of ['http://backup.example', 'https://backup.example/path', 'https://user@backup.example']) {
    await assert.rejects(fetchApiWithFallback('/api/v1/progress', {}, [origin], async () => ({ ok: true })));
  }
});
