import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { EmailJob, Event, Ticket } from '../models/index.js';
import { formatEventDate, qrPng, scheduleLine, ticketPdfBuffer } from './ticketPdf.js';

let transporter = null;
function getTransporter() {
  if (!config.smtp.user || !config.smtp.pass) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export const ticketUrl = (t) => `${config.clientUrl}/ticket/${t.accessToken}`;

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const INTROS = {
  tickets: 'Your payment was successful. Your tickets are below. Each person has their own QR code, so everyone can walk in on their own phone.',
  transfer: 'A ticket has been transferred to you. Your personal QR code is below. The previous holder’s code no longer works.',
  find: 'You asked us to resend your tickets. They are below.',
};

async function renderEmail({ kind, event, tickets }) {
  const attachments = [];
  const cards = [];

  for (const t of tickets) {
    const cid = `qr-${t.code}@ngfw`;
    const png = await qrPng(t.code, 320);
    attachments.push({ filename: `${t.code}.png`, content: png, cid, contentDisposition: 'inline' });
    const pdf = await ticketPdfBuffer({ ticket: t, event });
    attachments.push({ filename: `NGFW-ticket-${t.code}.pdf`, content: pdf, contentType: 'application/pdf' });

    cards.push(`
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#17110d;border:1px solid #3a2c1f;border-radius:16px;margin:0 0 18px;">
        <tr>
          <td style="padding:22px;vertical-align:top;">
            <span style="display:inline-block;background:${esc(t.tierColor || '#e2b865')};color:#120d0a;font:700 11px Arial,sans-serif;letter-spacing:2px;padding:6px 14px;border-radius:999px;">${esc(String(t.tierName).toUpperCase())}</span>
            <p style="margin:16px 0 2px;font:11px Arial,sans-serif;letter-spacing:3px;color:#a8957a;">ATTENDEE</p>
            <p style="margin:0 0 14px;font:700 24px Georgia,serif;color:#f6ecd9;">${esc(t.attendeeName)}</p>
            <p style="margin:0 0 14px;font:700 13px 'Courier New',monospace;color:#e2b865;">${esc(t.code)}</p>
            <a href="${ticketUrl(t)}" style="display:inline-block;background:#e2b865;color:#120d0a;text-decoration:none;font:700 13px Arial,sans-serif;padding:11px 20px;border-radius:10px;">Open ticket</a>
          </td>
          <td width="190" style="padding:22px;vertical-align:middle;text-align:center;">
            <div style="background:#f6ecd9;border-radius:14px;padding:10px;">
              <img src="cid:${cid}" width="160" height="160" alt="QR code for ${esc(t.code)}" style="display:block;margin:0 auto;" />
            </div>
          </td>
        </tr>
      </table>`);
  }

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0d0a08;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0a08;"><tr><td align="center" style="padding:28px 14px;">
    <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;">
      <tr><td align="center" style="padding-bottom:22px;">
        <p style="margin:0;font:11px Arial,sans-serif;letter-spacing:8px;color:#e2b865;">NIGERIA</p>
        <p style="margin:4px 0 0;font:700 30px Georgia,serif;color:#f6ecd9;letter-spacing:1px;">GALA FASHION WEEK</p>
      </td></tr>
      <tr><td style="padding:0 0 22px;font:15px/1.6 Arial,sans-serif;color:#d9cbb4;">${esc(INTROS[kind] || INTROS.tickets)}</td></tr>
      <tr><td>${cards.join('')}</td></tr>
      <tr><td style="background:#17110d;border:1px solid #3a2c1f;border-radius:16px;padding:20px;font:14px/1.7 Arial,sans-serif;color:#d9cbb4;">
        <strong style="color:#f6ecd9;">${esc(formatEventDate(event.startsAt))}</strong><br/>
        ${esc(scheduleLine(event))}<br/>
        ${esc(event.venue)}${event.address ? ', ' + esc(event.address) : ''}
      </td></tr>
      <tr><td style="padding:22px 4px 0;font:13px/1.7 Arial,sans-serif;color:#a8957a;">
        <strong style="color:#d9cbb4;">Good to know</strong><br/>
        • Each QR code admits one person, once. If a code has already been scanned, it will be refused.<br/>
        • Keep your code private. Anyone who scans it first gets in.<br/>
        • Can’t make it? Use &ldquo;Transfer ticket&rdquo; on your ticket page to move it to someone else.<br/>
        • Tickets are not refundable. Please read our <a href="${config.clientUrl}/policy" style="color:#e2b865;">ticket policy</a>.<br/>
        • Lost this email? Visit <a href="${config.clientUrl}/find-ticket" style="color:#e2b865;">Find my ticket</a>.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    INTROS[kind] || INTROS.tickets,
    '',
    ...tickets.map((t) => `${t.tierName} - ${t.attendeeName}\nCode: ${t.code}\nOpen: ${ticketUrl(t)}`),
    '',
    `${formatEventDate(event.startsAt)} | ${scheduleLine(event)} | ${event.venue}`,
  ].join('\n');

  return { html, text, attachments };
}

const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360];
let running = false;

async function attempt(job) {
  const event = await Event.findOne();
  const tickets = await Ticket.find({ _id: { $in: job.ticketIds } }).sort({ itemIndex: 1 });
  if (!event || tickets.length === 0) {
    job.status = 'failed';
    job.lastError = 'Missing event or tickets for this email.';
    await job.save();
    return;
  }

  try {
    const mail = await renderEmail({ kind: job.kind, event, tickets });
    const tx = getTransporter();
    if (!tx) {
      // Dev mode: no SMTP configured. Print the links so you can test the full flow locally.
      console.log(`\n[email:dev-log] To: ${job.to}\n  Subject: ${job.subject}`);
      tickets.forEach((t) => console.log(`  ${t.tierName} / ${t.attendeeName}: ${ticketUrl(t)}`));
      job.mode = 'dev-log';
    } else {
      await tx.sendMail({
        from: config.smtp.from,
        to: job.to,
        subject: job.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
      job.mode = 'smtp';
    }
    job.status = 'sent';
    job.sentAt = new Date();
    job.lastError = undefined;
  } catch (err) {
    job.attempts += 1;
    job.lastError = String(err?.message || err).slice(0, 400);
    if (job.attempts >= BACKOFF_MINUTES.length) {
      job.status = 'failed';
    } else {
      job.nextAttemptAt = new Date(Date.now() + BACKOFF_MINUTES[job.attempts - 1] * 60000);
    }
    console.error('[email] send failed', job.to, job.lastError);
  }
  await job.save();
}

export async function processEmailQueue() {
  if (running) return;
  running = true;
  try {
    const jobs = await EmailJob.find({ status: 'pending', nextAttemptAt: { $lte: new Date() } }).sort({ createdAt: 1 }).limit(10);
    for (const job of jobs) await attempt(job);
  } catch (err) {
    console.error('[email] queue error', err?.message);
  } finally {
    running = false;
  }
}

export async function enqueueEmail({ kind = 'tickets', to, subject, orderRef, ticketIds }) {
  const job = await EmailJob.create({ kind, to, subject, orderRef, ticketIds });
  setImmediate(processEmailQueue);
  return job;
}

export function startEmailWorker() {
  setInterval(processEmailQueue, 20000).unref();
  setImmediate(processEmailQueue);
}
