import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { buildQrPayload } from './crypto.js';

const GOLD = '#e2b865';
const IVORY = '#f6ecd9';
const INK = '#0d0a08';
const MUTED = '#a8957a';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.resolve(here, '../../assets/logo.png');

export const qrPng = (code, size = 420) =>
  QRCode.toBuffer(buildQrPayload(code), {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#120d0a', light: '#f6ecd9' },
  });

export const formatEventDate = (date) =>
  new Intl.DateTimeFormat('en-NG', { dateStyle: 'full', timeZone: 'Africa/Lagos' }).format(new Date(date));

export const scheduleLine = (event) => (event.schedule || []).map((s) => `${s.label} ${s.time}`).join('  |  ');

/** Builds one landscape ticket as a PDF Buffer (works as email attachment, print-out or phone download). */
export async function ticketPdfBuffer({ ticket, event }) {
  const qr = await qrPng(ticket.code);
  const W = 820;
  const H = 340;
  const tierColor = ticket.tierColor || GOLD;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, H],
      margin: 0,
      info: { Title: `${event.name} - Ticket ${ticket.code}`, Author: event.name },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Background + frame
    doc.rect(0, 0, W, H).fill(INK);
    doc.roundedRect(12, 12, W - 24, H - 24, 14).lineWidth(1).strokeOpacity(0.45).stroke(GOLD).strokeOpacity(1);
    doc.rect(12, 30, 8, H - 60).fill(tierColor);

    // Optional logo
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, 528, 30, { fit: [52, 52], align: 'center' });
      } catch {
        /* ignore a bad logo file */
      }
    }

    // Left side
    const x = 48;
    doc.fillColor(GOLD).font('Helvetica').fontSize(11).text('NIGERIA', x, 42, { characterSpacing: 7, lineBreak: false });
    doc.fillColor(IVORY).font('Times-Bold').fontSize(32).text('GALA FASHION WEEK', x, 60, { width: 470, lineBreak: false });
    doc.moveTo(x, 104).lineTo(x + 70, 104).lineWidth(1.5).stroke(GOLD);

    // Tier pill + admit one
    const tierLabel = String(ticket.tierName || '').toUpperCase();
    doc.font('Helvetica-Bold').fontSize(11);
    const pillW = Math.min(doc.widthOfString(tierLabel, { characterSpacing: 2 }) + 34, 260);
    doc.roundedRect(x, 120, pillW, 26, 13).fill(tierColor);
    doc.fillColor(INK).text(tierLabel, x, 128, { width: pillW, align: 'center', characterSpacing: 2, lineBreak: false });
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('ADMIT ONE', x + pillW + 16, 130, { characterSpacing: 3, lineBreak: false });

    // Attendee
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('ATTENDEE', x, 166, { characterSpacing: 3, lineBreak: false });
    doc.fillColor(IVORY).font('Times-Bold').fontSize(26).text(String(ticket.attendeeName), x, 180, { width: 480, height: 32, ellipsis: true });

    // Details
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('DATE', x, 232, { characterSpacing: 3, lineBreak: false });
    doc.fillColor(IVORY).font('Helvetica-Bold').fontSize(11).text(formatEventDate(event.startsAt), x, 245, { width: 240, height: 14, ellipsis: true });
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(scheduleLine(event), x, 261, { width: 250, height: 24, ellipsis: true });

    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('VENUE', x + 280, 232, { characterSpacing: 3, lineBreak: false });
    doc.fillColor(IVORY).font('Helvetica-Bold').fontSize(11).text(event.venue || '', x + 280, 245, { width: 240, height: 14, ellipsis: true });
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(event.address || '', x + 280, 261, { width: 240, height: 24, ellipsis: true });

    doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(
      'One entry per QR code. A screenshot shared with others will only work for the first person scanned.',
      x,
      300,
      { width: 500, lineBreak: false }
    );

    // Perforation + notches
    doc.moveTo(592, 28).lineTo(592, H - 28).lineWidth(1).dash(4, { space: 5 }).strokeOpacity(0.5).stroke(GOLD).undash().strokeOpacity(1);
    doc.circle(592, 12, 11).fill(INK);
    doc.circle(592, H - 12, 11).fill(INK);

    // Right: QR panel
    doc.roundedRect(620, 38, 176, 252, 14).fill(IVORY);
    doc.image(qr, 632, 50, { width: 152, height: 152 });
    doc.fillColor(INK).font('Courier-Bold').fontSize(12).text(ticket.code, 620, 214, { width: 176, align: 'center', lineBreak: false });
    doc.fillColor('#6b5a45').font('Helvetica').fontSize(7.5).text('SCAN ONCE AT THE GATE', 620, 236, { width: 176, align: 'center', characterSpacing: 2, lineBreak: false });
    doc.fillColor('#6b5a45').font('Helvetica').fontSize(7).text('Keep this code private', 620, 252, { width: 176, align: 'center', lineBreak: false });

    doc.end();
  });
}
