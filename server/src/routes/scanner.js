import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { Event, Ticket } from '../models/index.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { buildQrPayload, looksLikeTicketCode, parseQrPayload } from '../lib/crypto.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

const pinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many PIN attempts. Please wait a few minutes and try again.', code: 'rate_limited' },
});

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

router.post(
  '/login',
  pinLimiter,
  asyncHandler(async (req, res) => {
    const event = await Event.findOne();
    if (!event?.gatePin) throw new AppError('Gate scanning has not been set up yet. Ask the host to set a gate PIN in the dashboard.', 403, 'no_pin');
    if (!safeEqual(String(req.body.pin || '').trim(), event.gatePin)) throw new AppError('That PIN is not correct. Please try again.', 401, 'bad_pin');
    res.json({ token: signToken({ sub: 'gate', role: 'scanner', name: 'Gate staff' }, '16h') });
  })
);

router.use(requireAuth('scanner', 'host', 'admin'));

const summary = (t) => ({ code: t.code, attendeeName: t.attendeeName, tierName: t.tierName, tierColor: t.tierColor });

/** All outcomes are HTTP 200 with a `result`, so the scanner UI can show a big green/red screen instead of an error toast. */
router.post(
  '/scan',
  asyncHandler(async (req, res) => {
    const gate = String(req.body.gate || '').slice(0, 30);
    let code;
    if (req.body.manual) {
      code = String(req.body.payload || '').trim().toUpperCase();
      if (!looksLikeTicketCode(code)) return res.json({ result: 'invalid', message: 'That does not look like a ticket code. It should look like NGFW-AB12-CD34.' });
    } else {
      code = parseQrPayload(req.body.payload);
      if (!code) return res.json({ result: 'invalid', message: 'This QR code is not a genuine NGFW ticket.' });
    }

    // One atomic update: only ONE scan can ever flip valid -> used, even if two gates scan at the same instant.
    const ticket = await Ticket.findOneAndUpdate({ code, status: 'valid' }, { $set: { status: 'used', usedAt: new Date(), usedGate: gate } }, { new: true });
    if (ticket) return res.json({ result: 'ok', message: 'Welcome in!', ticket: summary(ticket) });

    const existing = await Ticket.findOne({ code });
    if (!existing) return res.json({ result: 'invalid', message: 'No ticket was found for this code.' });
    if (existing.status === 'used') {
      return res.json({ result: 'already_used', message: 'This ticket has ALREADY been scanned.', usedAt: existing.usedAt, usedGate: existing.usedGate, ticket: summary(existing) });
    }
    return res.json({
      result: 'void',
      message: existing.voidReason === 'transferred' ? 'This ticket was transferred to someone else. Ask for their new ticket.' : 'This ticket has been cancelled.',
      ticket: summary(existing),
    });
  })
);

/** Cached on the phone so scanning still works if the venue's internet drops. */
router.get(
  '/manifest',
  asyncHandler(async (_req, res) => {
    const tickets = await Ticket.find({ status: 'valid' }).select('code attendeeName tierName tierColor');
    res.json({
      generatedAt: new Date(),
      tickets: tickets.map((t) => ({ ...summary(t), qr: buildQrPayload(t.code) })),
    });
  })
);

/** Upload scans that were taken offline. Anything already used elsewhere is reported back as a conflict. */
router.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const scans = Array.isArray(req.body.scans) ? req.body.scans.slice(0, 500) : [];
    const conflicts = [];
    let applied = 0;
    for (const s of scans) {
      const code = String(s.code || '').toUpperCase();
      if (!looksLikeTicketCode(code)) continue;
      const at = s.at ? new Date(s.at) : new Date();
      const done = await Ticket.findOneAndUpdate(
        { code, status: 'valid' },
        { $set: { status: 'used', usedAt: Number.isNaN(at.getTime()) ? new Date() : at, usedGate: `${String(s.gate || '').slice(0, 24)} (offline)` } }
      );
      if (done) applied += 1;
      else {
        const t = await Ticket.findOne({ code });
        if (t) conflicts.push({ ...summary(t), status: t.status, usedAt: t.usedAt });
      }
    }
    res.json({ applied, conflicts });
  })
);

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [valid, used] = await Promise.all([Ticket.countDocuments({ status: 'valid' }), Ticket.countDocuments({ status: 'used' })]);
    const recent = await Ticket.find({ status: 'used' }).sort({ usedAt: -1 }).limit(8);
    res.json({ valid, used, total: valid + used, recent: recent.map((t) => ({ ...summary(t), usedAt: t.usedAt, usedGate: t.usedGate })) });
  })
);

export default router;
