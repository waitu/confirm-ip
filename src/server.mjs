import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { loadEnvFile, getConfig } from './env.mjs';
import { getClientIp } from './ip.mjs';
import { ConfirmationStore } from './store.mjs';
import { confirmationPage, errorPage, NOTICE_VERSION } from './html.mjs';
import { verifyOrderLink } from './signature.mjs';

loadEnvFile();
const config = getConfig();
const store = new ConfirmationStore(config.dataFile, config);
await store.init();

const server = createServer(async (req, res) => {
  setSecurityHeaders(res);
  try {
    const url = new URL(req.url, config.baseUrl);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/api/test-link') {
      if (!isAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      const body = await readBody(req, 'json');
      const orderId = cleanOrderId(body.order_id);
      if (!orderId) return sendJson(res, 400, { error: 'order_id không hợp lệ' });
      const redirectUrl = body.redirect_url || config.redirectUrl;
      if (!isAllowedRedirect(redirectUrl, config.redirectUrl)) {
        return sendJson(res, 400, { error: 'redirect_url phải cùng origin với STORE_REDIRECT_URL' });
      }
      const created = await store.createToken({ orderId, redirectUrl });
      return sendJson(res, 201, {
        order_id: orderId,
        expires_at: created.entry.expires_at,
        confirmation_url: `${config.baseUrl}/order-confirm?t=${created.rawToken}`
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/confirmations') {
      if (!isAdmin(req)) return sendJson(res, 401, { error: 'Unauthorized' });
      return sendJson(res, 200, { confirmations: store.list() });
    }

    if (req.method === 'GET' && url.pathname === '/order-confirm') {
      const confirmation = resolveConfirmation(Object.fromEntries(url.searchParams));
      if (!confirmation) return sendHtml(res, 400, errorPage('Link không hợp lệ', 'Link đã hết hạn, bị thay đổi hoặc không tồn tại.'));
      return sendHtml(res, 200, confirmationPage({
        hiddenFields: confirmation.hiddenFields,
        orderLabel: confirmation.orderLabel,
        alreadyConfirmed: confirmation.alreadyConfirmed
      }));
    }

    if (req.method === 'POST' && url.pathname === '/order-confirm') {
      const body = await readBody(req, 'form');
      const confirmation = resolveConfirmation(body);
      if (!confirmation) return sendHtml(res, 400, errorPage('Link không hợp lệ', 'Link đã hết hạn, bị thay đổi hoặc không tồn tại.'));
      if (body.consent !== 'yes') {
        return sendHtml(res, 400, confirmationPage({
          hiddenFields: confirmation.hiddenFields,
          orderLabel: confirmation.orderLabel,
          error: 'Bạn cần đồng ý trước khi xác nhận.'
        }));
      }
      const details = {
        ip: getClientIp(req, config.trustProxy),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        noticeVersion: NOTICE_VERSION
      };
      const result = confirmation.type === 'opaque'
        ? await store.confirm(confirmation.token, details)
        : await store.confirmSigned(
            confirmation.signed,
            details,
            config.redirectUrl,
            config.signedLinkTtlMs
          );
      if (result.status === 'invalid') return sendHtml(res, 400, errorPage('Link không hợp lệ', 'Link đã hết hạn hoặc không tồn tại.'));
      res.writeHead(303, { Location: result.entry.redirect_url, 'Cache-Control': 'no-store' });
      return res.end();
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error.code === 'BODY_TOO_LARGE' || error instanceof SyntaxError) {
      return sendJson(res, 400, { error: 'Request body không hợp lệ' });
    }
    console.error(error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(config.port, () => {
  console.log(`API đang chạy tại ${config.baseUrl}`);
  console.log(`Dữ liệu lưu tại ${config.dataFile}`);
  console.log(`TRUST_PROXY=${config.trustProxy}`);
});

function isAdmin(req) {
  const supplied = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const expected = Buffer.from(config.adminApiKey);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function resolveConfirmation(input) {
  if (input.t) {
    const token = String(input.t);
    const entry = store.lookup(token);
    if (!entry) return undefined;
    return {
      type: 'opaque',
      token,
      hiddenFields: { t: token },
      orderLabel: entry.order_id,
      alreadyConfirmed: entry.status === 'confirmed'
    };
  }

  const signed = verifyOrderLink({
    orderId: input.order_id,
    orderName: input.order_name,
    timestamp: input.ts,
    signature: input.sig
  }, {
    secret: config.shopifyLinkSecret,
    ttlMs: config.signedLinkTtlMs
  });
  if (!signed) return undefined;
  const existing = store.lookupSigned(signed.signature);
  return {
    type: 'signed',
    signed,
    hiddenFields: {
      order_id: signed.orderId,
      order_name: signed.orderName,
      ts: String(signed.timestamp),
      sig: signed.signature
    },
    orderLabel: signed.orderName,
    alreadyConfirmed: existing?.status === 'confirmed'
  };
}

function cleanOrderId(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value.trim();
  return /^[A-Za-z0-9#_-]{1,80}$/.test(cleaned) ? cleaned : '';
}

function isAllowedRedirect(candidate, configured) {
  try {
    return new URL(candidate).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

async function readBody(req, type) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 8192) {
      const error = new Error('Body too large');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
  }
  if (type === 'json') return raw ? JSON.parse(raw) : {};
  return Object.fromEntries(new URLSearchParams(raw));
}

function setSecurityHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendHtml(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
