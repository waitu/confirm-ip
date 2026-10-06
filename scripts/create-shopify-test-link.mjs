import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile, getConfig } from '../src/env.mjs';
import { signOrderLink } from '../src/signature.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);
loadEnvFile();
const config = getConfig();
const args = parseArgs(process.argv.slice(2));
const orderId = args['order-id'] || '1234567890';
const orderName = args['order-name'] || '#TEST-1001';
const timestamp = Math.floor(Date.now() / 1000);
const signature = signOrderLink({ orderId, orderName, timestamp }, config.shopifyLinkSecret);
const url = new URL('/order-confirm', config.baseUrl);
url.searchParams.set('order_id', orderId);
url.searchParams.set('order_name', orderName);
url.searchParams.set('ts', String(timestamp));
url.searchParams.set('sig', signature);
console.log(url.toString());

function parseArgs(items) {
  const result = {};
  for (let i = 0; i < items.length; i += 2) {
    const key = items[i]?.replace(/^--/, '');
    if (key) result[key] = items[i + 1];
  }
  return result;
}
