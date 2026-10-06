import { createHmac, timingSafeEqual } from 'node:crypto';

export function signOrderLink({ orderId, timestamp, orderName }, secret) {
  return createHmac('sha256', secret)
    .update(buildPayload({ orderId, timestamp, orderName }))
    .digest('hex');
}

export function verifyOrderLink(input, { secret, ttlMs, now = Date.now() }) {
  const orderId = String(input.orderId || '');
  const orderName = String(input.orderName || '');
  const timestampText = String(input.timestamp || '');
  const signature = String(input.signature || '').toLowerCase();

  if (!/^[0-9]{1,32}$/.test(orderId)) return undefined;
  if (!isSafeOrderName(orderName)) return undefined;
  if (!/^[0-9]{10,13}$/.test(timestampText)) return undefined;
  if (!/^[a-f0-9]{64}$/.test(signature)) return undefined;

  const timestamp = Number.parseInt(timestampText, 10);
  if (!Number.isSafeInteger(timestamp)) return undefined;
  const createdAtMs = timestamp * 1000;
  const futureSkewMs = 10 * 60 * 1000;
  if (createdAtMs > now + futureSkewMs || now - createdAtMs > ttlMs) return undefined;

  const expected = signOrderLink({ orderId, timestamp, orderName }, secret);
  const suppliedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)) return undefined;

  return { orderId, orderName, timestamp, signature };
}

export function buildPayload({ orderId, timestamp, orderName }) {
  return `${orderId}|${timestamp}|${orderName}`;
}

function isSafeOrderName(value) {
  return value.length >= 1 && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
}
