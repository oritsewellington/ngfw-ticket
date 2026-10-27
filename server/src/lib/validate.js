import { AppError } from './errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isEmail = (s) => EMAIL_RE.test(String(s || '').trim());

export function cleanName(value, label = 'name') {
  const v = String(value || '').replace(/\s+/g, ' ').trim();
  if (v.length < 2) throw new AppError(`Please enter a valid ${label}.`, 400, 'validation');
  if (v.length > 80) throw new AppError(`That ${label} is too long.`, 400, 'validation');
  return v;
}

export function cleanEmail(value, { required = true, label = 'email address' } = {}) {
  const v = String(value || '').trim().toLowerCase();
  if (!v && !required) return '';
  if (!isEmail(v)) throw new AppError(`Please enter a valid ${label}.`, 400, 'validation');
  return v;
}

export function cleanPhone(value) {
  const v = String(value || '').replace(/[^\d+]/g, '');
  if (v && (v.length < 7 || v.length > 16)) throw new AppError('Please enter a valid phone number.', 400, 'validation');
  return v;
}

export function parsePage(query, defaultLimit = 20) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function csvEscape(v) {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection from attendee-typed names
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
