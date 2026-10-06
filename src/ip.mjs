import { isIP } from 'node:net';

export function getClientIp(req, trustProxy = false) {
  if (trustProxy) {
    const candidates = [
      firstHeaderValue(req.headers['cf-connecting-ip']),
      firstHeaderValue(req.headers['x-forwarded-for']),
      firstHeaderValue(req.headers['x-real-ip'])
    ];
    for (const candidate of candidates) {
      const normalized = normalizeIp(candidate);
      if (normalized) return normalized;
    }
  }
  return normalizeIp(req.socket?.remoteAddress) || 'unknown';
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== 'string') return undefined;
  return value.split(',')[0].trim();
}

export function normalizeIp(value) {
  if (!value || typeof value !== 'string') return undefined;
  let candidate = value.trim();
  if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
  if (candidate.startsWith('[')) {
    const end = candidate.indexOf(']');
    if (end > 0) candidate = candidate.slice(1, end);
  }
  return isIP(candidate) ? candidate : undefined;
}
