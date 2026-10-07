import test from 'node:test';
import assert from 'node:assert/strict';
import { autoConfirmPage } from '../src/html.mjs';

test('auto confirmation page posts signed fields without a consent checkbox', () => {
  const html = autoConfirmPage({
    hiddenFields: {
      order_id: '123',
      order_name: '#1001',
      ts: '1791336456',
      sig: 'abc'
    }
  });
  assert.match(html, /method="post" action="\/order-confirm"/);
  assert.match(html, /order-confirm-form'\)\.submit\(\)/);
  assert.doesNotMatch(html, /checkbox|name="consent"/);
  assert.match(html, /value="#1001"/);
});
