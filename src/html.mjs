const NOTICE_VERSION = '2026-10-07-store-terms-v2';

export { NOTICE_VERSION };

export function autoConfirmPage({ hiddenFields }) {
  const hiddenInputs = Object.entries(hiddenFields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('');
  return pageShell(`<h1>Đang xác nhận đơn hàng…</h1>
    <p>Bạn sẽ được chuyển về cửa hàng ngay sau khi hoàn tất.</p>
    <form id="order-confirm-form" method="post" action="/order-confirm">
      ${hiddenInputs}
      <noscript><button type="submit">Tiếp tục</button></noscript>
    </form>
    <script>document.getElementById('order-confirm-form').submit();</script>`);
}

export function errorPage(title, message) {
  return pageShell(`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}

export function storeRedirectPage(location) {
  const safeLocation = escapeHtml(location);
  const scriptLocation = JSON.stringify(String(location)).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0;url=${safeLocation}">
<title>Đang chuyển về cửa hàng</title></head>
<body><p>Đơn hàng đã được xác nhận. <a href="${safeLocation}">Tiếp tục đến cửa hàng</a>.</p>
<script>window.location.replace(${scriptLocation});</script></body></html>`;
}

function pageShell(content) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xác nhận đơn hàng</title>
<style>
body{margin:0;background:#f4f6f8;color:#1f2937;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.card{max-width:560px;margin:8vh auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 12px 40px #1112}h1{font-size:28px;margin:0 0 12px}button{border:0;border-radius:10px;background:#111827;color:#fff;padding:14px 20px;font-weight:700;font-size:16px;cursor:pointer}@media(max-width:640px){.card{margin:0;min-height:100vh;border-radius:0;box-sizing:border-box}}
</style></head><body><main class="card">${content}</main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
