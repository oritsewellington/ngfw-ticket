import test from 'node:test';
import assert from 'node:assert/strict';
process.env.TICKET_SECRET = 'test-secret';
const { buildQrPayload, parseQrPayload, generateTicketCode, looksLikeTicketCode } = await import('../src/lib/crypto.js');
const { splitRevenue, estimatePaystackFee } = await import('../src/lib/money.js');

test('genuine QR verifies, forged QR is rejected', () => {
  const code = generateTicketCode();
  assert.ok(looksLikeTicketCode(code));
  const payload = buildQrPayload(code);
  assert.equal(parseQrPayload(payload), code);
  assert.equal(parseQrPayload(payload.slice(0, -2) + 'xx'), null);
  assert.equal(parseQrPayload(`NGFW.${generateTicketCode()}.${payload.split('.')[2]}`), null);
  assert.equal(parseQrPayload('garbage'), null);
});

test('revenue split: fee first, then 10% platform / 90% host of NET', () => {
  // The example from the dashboard screenshot: ₦100 gross, ₦1.50 fee
  const s = splitRevenue(10000, 150, 10);
  assert.deepEqual(s, { gross: 10000, fee: 150, net: 9850, platform: 985, host: 8865 });
  assert.equal(s.platform + s.host, s.net);
});

test('fallback Paystack fee', () => {
  assert.equal(estimatePaystackFee(10000), 150); // ₦100 -> ₦1.50
  assert.equal(estimatePaystackFee(500000), 7500 + 10000); // ₦5,000 -> 1.5% + ₦100
  assert.equal(estimatePaystackFee(1000000000), 200000); // capped at ₦2,000
});
