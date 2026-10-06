import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from '../src/env.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);
loadEnvFile();

const args = parseArgs(process.argv.slice(2));
const orderId = args['order-id'] || 'TEST-1001';
const recipient = args.to || 'your-email@example.com';
const baseUrl = (process.env.BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY;
if (!adminKey) throw new Error('Thiếu ADMIN_API_KEY trong .env');

const response = await fetch(`${baseUrl}/api/test-link`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
  body: JSON.stringify({ order_id: orderId })
});
if (!response.ok) throw new Error(`Không tạo được link: ${response.status} ${await response.text()}`);
const created = await response.json();
const template = await readFile(resolve('templates/order-confirmation-test.html'), 'utf8');
const html = template
  .replaceAll('{{ORDER_ID}}', escapeHtml(orderId))
  .replaceAll('{{CONFIRMATION_URL}}', escapeHtml(created.confirmation_url));

const outputDir = resolve('out');
await mkdir(outputDir, { recursive: true });
const safeName = orderId.replace(/[^A-Za-z0-9_-]/g, '_');
const htmlPath = resolve(outputDir, `${safeName}.html`);
const emlPath = resolve(outputDir, `${safeName}.eml`);
await writeFile(htmlPath, html, 'utf8');
await writeFile(emlPath, buildEml({ recipient, orderId, html }), 'utf8');

console.log(`Link: ${created.confirmation_url}`);
console.log(`HTML: ${htmlPath}`);
console.log(`EML:  ${emlPath}`);

function parseArgs(items) {
  const result = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = items[i]?.replace(/^--/, '');
    if (key) result[key] = items[i + 1];
  }
  return result;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function buildEml({ recipient, orderId, html }) {
  const lines = [
    `To: ${recipient}`,
    'From: test-store@example.com',
    `Subject: Xac nhan don hang ${orderId}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html
  ];
  return lines.join('\r\n');
}
