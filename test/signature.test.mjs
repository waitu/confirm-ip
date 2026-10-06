import test from 'node:test';
import assert from 'node:assert/strict';
import { signOrderLink, verifyOrderLink } from '../src/signature.mjs';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
const now = Date.UTC(2026, 9, 6, 12, 0, 0);
const valid = {
  orderId: '1234567890',
  orderName: '#1001',
  timestamp: Math.floor(now / 1000) - 60
};

test('accepts a valid Shopify HMAC link', () => {
  const signature = signOrderLink(valid, secret);
  const result = verifyOrderLink({ ...valid, signature }, {
    secret,
    ttlMs: 30 * 86_400_000,
    now
  });
  assert.deepEqual(result, { ...valid, signature });
});

test('rejects a modified order name', () => {
  const signature = signOrderLink(valid, secret);
  const result = verifyOrderLink({ ...valid, orderName: '#9999', signature }, {
    secret,
    ttlMs: 30 * 86_400_000,
    now
  });
  assert.equal(result, undefined);
});

test('rejects an expired link', () => {
  const signature = signOrderLink(valid, secret);
  const result = verifyOrderLink({ ...valid, signature }, {
    secret,
    ttlMs: 30_000,
    now
  });
  assert.equal(result, undefined);
});
