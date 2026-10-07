import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfirmationStore } from '../src/store.mjs';

test('creates opaque token and confirms only once', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'order-ip-test-'));
  const file = join(directory, 'store.json');
  const store = new ConfirmationStore(file, {
    tokenTtlMs: 60_000,
    retentionMs: 86_400_000
  });
  await store.init();
  const { rawToken } = await store.createToken({
    orderId: 'TEST-1001',
    redirectUrl: 'https://example.myshopify.com/'
  });
  assert.equal(store.lookup(rawToken).status, 'pending');
  const first = await store.confirm(rawToken, {
    ip: '203.0.113.10', userAgent: 'test', noticeVersion: 'v2',
    consent: null, legalBasis: 'store_terms', confirmationMethod: 'email_link_auto_post'
  });
  const second = await store.confirm(rawToken, {
    ip: '198.51.100.2', userAgent: 'other', noticeVersion: 'v2',
    consent: null, legalBasis: 'store_terms', confirmationMethod: 'email_link_auto_post'
  });
  assert.equal(first.status, 'confirmed');
  assert.equal(second.status, 'already_confirmed');
  assert.equal(second.entry.ip, '203.0.113.10');
  assert.equal(second.entry.legal_basis, 'store_terms');
  assert.equal(second.entry.consent, null);
  const disk = await readFile(file, 'utf8');
  assert.equal(disk.includes(rawToken), false);
});
