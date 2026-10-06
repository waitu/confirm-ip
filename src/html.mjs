const NOTICE_VERSION = '2026-10-05-v1';

export { NOTICE_VERSION };

export function confirmationPage({ hiddenFields, orderLabel, alreadyConfirmed = false, error = '' }) {
  const safeOrder = escapeHtml(orderLabel);
  const hiddenInputs = Object.entries(hiddenFields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join('');
  const content = alreadyConfirmed
    ? `<h1>Đơn hàng đã được xác nhận</h1><p>Mã đơn: <strong>${safeOrder}</strong></p><p>Bạn có thể đóng trang này.</p>`
    : `<h1>Xác nhận đơn hàng</h1>
       <p>Mã đơn: <strong>${safeOrder}</strong></p>
       ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
       <form method="post" action="/order-confirm">
         ${hiddenInputs}
         <label class="consent"><input type="checkbox" name="consent" value="yes" required> Tôi đồng ý để cửa hàng ghi nhận địa chỉ IP, thời gian xác nhận và vị trí gần đúng suy ra từ IP cho mục đích phân tích khu vực khách hàng.</label>
         <button type="submit">Xác nhận đơn hàng</button>
       </form>`;

  return pageShell(content);
}

export function errorPage(title, message) {
  return pageShell(`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}

function pageShell(content) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xác nhận đơn hàng</title>
<style>
body{margin:0;background:#f4f6f8;color:#1f2937;font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.card{max-width:560px;margin:8vh auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 12px 40px #1112}h1{font-size:28px;margin:0 0 12px}.consent{display:flex;gap:12px;margin:24px 0;color:#374151}.consent input{width:20px;height:20px;flex:0 0 auto}button{border:0;border-radius:10px;background:#111827;color:#fff;padding:14px 20px;font-weight:700;font-size:16px;cursor:pointer}.error{color:#b91c1c;background:#fee2e2;padding:10px;border-radius:8px}@media(max-width:640px){.card{margin:0;min-height:100vh;border-radius:0;box-sizing:border-box}}
</style></head><body><main class="card">${content}</main></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
