import test from 'node:test';
import assert from 'node:assert/strict';
import { getClientIp, normalizeIp } from '../src/ip.mjs';

test('normalizes IPv4-mapped IPv6', () => {
  assert.equal(normalizeIp('::ffff:203.0.113.10'), '203.0.113.10');
});

test('ignores forwarded headers when proxy is not trusted', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.10' },
    socket: { remoteAddress: '127.0.0.1' }
  };
  assert.equal(getClientIp(req, false), '127.0.0.1');
});

test('uses first forwarded address when proxy is trusted', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.2' },
    socket: { remoteAddress: '10.0.0.2' }
  };
  assert.equal(getClientIp(req, true), '203.0.113.10');
});
