import { config } from '../config.js';
import { AppError } from './errors.js';

const BASE = 'https://api.paystack.co';

async function call(path, { method = 'GET', body } = {}) {
  if (!config.paystackSecret) {
    throw new AppError('Online payment is not available right now. Please try again later or contact the organisers.', 503, 'payments_unavailable');
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.paystackSecret}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    console.error('[paystack] network error', err?.message);
    throw new AppError("We couldn't reach our payment provider. Please check your connection and try again.", 502, 'payments_unreachable');
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || !json?.status) {
    console.error('[paystack] error', res.status, json?.message);
    throw new AppError('The payment provider could not process this request. Please try again in a moment.', 502, 'payments_error');
  }
  return json.data;
}

export const initializeTransaction = ({ email, amount, reference, callbackUrl, metadata }) =>
  call('/transaction/initialize', {
    method: 'POST',
    body: { email, amount, reference, callback_url: callbackUrl, currency: 'NGN', metadata },
  });

export const verifyTransaction = (reference) => call(`/transaction/verify/${encodeURIComponent(reference)}`);

export const refundTransaction = (reference, amountKobo) =>
  call('/refund', { method: 'POST', body: { transaction: reference, ...(amountKobo ? { amount: amountKobo } : {}) } });
