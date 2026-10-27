import crypto from 'node:crypto';
import { config } from '../config.js';

// No 0/O/1/I/L so codes are easy to read out at the gate.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChars(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Human-friendly ticket code, e.g. NGFW-7K2Q-9MXD */
export const generateTicketCode = () => `NGFW-${randomChars(4)}-${randomChars(4)}`;

/** Unguessable token used in private ticket links. */
export const generateToken = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

/** Unguessable order reference (also used as the Paystack reference). */
export const generateReference = () => `NGFW-${Date.now().toString(36).toUpperCase()}-${randomChars(6)}`;

const hmac = (data) => crypto.createHmac('sha256', config.ticketSecret).update(data).digest('base64url').slice(0, 20);

/** What is encoded inside the QR: NGFW.<code>.<signature>  (a forged or edited QR can never match) */
export const buildQrPayload = (code) => `NGFW.${code}.${hmac(code)}`;

/** Returns the ticket code if the payload is genuine, otherwise null. */
export function parseQrPayload(payload) {
  if (typeof payload !== 'string') return null;
  const clean = payload.trim();
  // Allow staff to type the short code by hand (no signature) – handled by the caller with { manual: true }.
  const parts = clean.split('.');
  if (parts.length !== 3 || parts[0] !== 'NGFW') return null;
  const [, code, sig] = parts;
  const expected = hmac(code);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return code;
}

export const looksLikeTicketCode = (s) => /^NGFW-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(s || '').trim().toUpperCase());

/** Verify that a Paystack webhook really came from Paystack. */
export function verifyPaystackSignature(rawBody, signature) {
  if (!signature || !config.paystackSecret) return false;
  const expected = crypto.createHmac('sha512', config.paystackSecret).update(rawBody).digest('hex');
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
