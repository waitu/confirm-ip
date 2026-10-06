import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvFile(file = '.env') {
  try {
    const content = readFileSync(resolve(file), 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const index = line.indexOf('=');
      if (index < 1) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function getConfig() {
  const port = parsePositiveInt(process.env.PORT, 8787);
  const tokenTtlHours = parsePositiveInt(process.env.TOKEN_TTL_HOURS, 168);
  const retentionDays = parsePositiveInt(process.env.RETENTION_DAYS, 90);
  const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  const adminApiKey = process.env.ADMIN_API_KEY;
  const shopifyLinkSecret = process.env.SHOPIFY_LINK_SECRET;
  const redirectUrl = process.env.STORE_REDIRECT_URL || 'https://example.myshopify.com/';
  const signedLinkTtlDays = parsePositiveInt(process.env.SIGNED_LINK_TTL_DAYS, 30);

  if (!adminApiKey || adminApiKey.length < 24) {
    throw new Error('ADMIN_API_KEY phải có ít nhất 24 ký tự. Chạy run-test.ps1 để tự tạo.');
  }
  if (!shopifyLinkSecret || shopifyLinkSecret.length < 32) {
    throw new Error('SHOPIFY_LINK_SECRET phải có ít nhất 32 ký tự. Chạy run-test.ps1 để tự tạo.');
  }

  assertHttpUrl(baseUrl, 'BASE_URL');
  assertHttpUrl(redirectUrl, 'STORE_REDIRECT_URL');

  return {
    port,
    baseUrl: baseUrl.replace(/\/$/, ''),
    adminApiKey,
    shopifyLinkSecret,
    redirectUrl,
    tokenTtlMs: tokenTtlHours * 60 * 60 * 1000,
    signedLinkTtlMs: signedLinkTtlDays * 24 * 60 * 60 * 1000,
    retentionMs: retentionDays * 24 * 60 * 60 * 1000,
    trustProxy: /^true$/i.test(process.env.TRUST_PROXY || ''),
    dataFile: resolve(process.env.DATA_FILE || './data/store.json')
  };
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Giá trị số không hợp lệ: ${value}`);
  }
  return parsed;
}

function assertHttpUrl(value, name) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} phải dùng http hoặc https`);
  }
}
