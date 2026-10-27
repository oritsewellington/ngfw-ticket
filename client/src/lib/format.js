export const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const TZ = 'Africa/Lagos';
const nf0 = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** All money comes from the API in kobo. */
export const naira = (kobo = 0) => (kobo % 100 === 0 ? nf0 : nf2).format(kobo / 100);

export const fmtDate = (d) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'full', timeZone: TZ }).format(new Date(d));
export const fmtMedDate = (d) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: TZ }).format(new Date(d));
export const fmtDateTime = (d) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(d));
export const fmtTime = (d) => new Intl.DateTimeFormat('en-NG', { timeStyle: 'short', timeZone: TZ }).format(new Date(d));

/** <input type="datetime-local"> helpers that always mean Nigerian time, wherever the browser is. */
export const toLagosInput = (d) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d)).replace(' ', 'T');
export const fromLagosInput = (v) => new Date(`${v}:00+01:00`).toISOString();

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

export const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);

export const mapsLink = (event) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event?.venue, event?.address].filter(Boolean).join(', '))}`;

/** Build and download a calendar (.ics) so guests can add the event to their phone. */
export function buildIcs(event) {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + 8 * 3600000);
  const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s = '') => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NGFW//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${f(start)}@ngfw`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:${esc(event.name)}`,
    `LOCATION:${esc([event.venue, event.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc((event.schedule || []).map((s) => `${s.label} ${s.time}`).join(' | '))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
