// Host dashboard API. Available to BOTH the host and the platform admin.
import { Router } from 'express';
import { Audit, Event, Order, Payout, Promo, Ticket, Tier } from '../models/index.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { overviewData } from '../lib/finance.js';
import { cleanEmail, cleanName, csvEscape, escapeRegex, parsePage } from '../lib/validate.js';
import { createManualOrder, remainingFor, tierStats } from '../lib/issue.js';
import { enqueueEmail } from '../lib/mailer.js';
import { formatEventDate } from '../lib/ticketPdf.js';

const router = Router();
router.use(requireAuth('host', 'admin'));

const naira = (k) => `₦${(k / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/* ---------------- Overview ---------------- */
router.get('/overview', asyncHandler(async (_req, res) => res.json(await overviewData())));

/* ---------------- Event settings ---------------- */
router.get(
  '/event',
  asyncHandler(async (_req, res) => {
    const event = await Event.findOne();
    res.json({ event });
  })
);

router.patch(
  '/event',
  asyncHandler(async (req, res) => {
    const event = await Event.findOne();
    const b = req.body;
    const changes = [];
    const setStr = (key, label, max = 2000) => {
      if (typeof b[key] === 'string') {
        const v = b[key].trim().slice(0, max);
        if (v !== (event[key] || '')) changes.push(label);
        event[key] = v;
      }
    };
    setStr('name', 'name', 120);
    if (!event.name) throw new AppError('The event name cannot be empty.', 400, 'validation');
    setStr('tagline', 'tagline', 200);
    setStr('description', 'description');
    setStr('venue', 'venue', 200);
    setStr('address', 'address', 300);
    setStr('contactEmail', 'contact email', 120);
    if (b.startsAt) {
      const d = new Date(b.startsAt);
      if (Number.isNaN(d.getTime())) throw new AppError('Please enter a valid event date and time.', 400, 'validation');
      if (d.getTime() !== event.startsAt.getTime()) changes.push(`date to ${formatEventDate(d)}`);
      event.startsAt = d;
    }
    if (Array.isArray(b.schedule)) {
      event.schedule = b.schedule.filter((s) => s?.label && s?.time).map((s) => ({ label: String(s.label).slice(0, 60), time: String(s.time).slice(0, 30) }));
      changes.push('schedule');
    }
    if (Array.isArray(b.contactPhones)) event.contactPhones = b.contactPhones.map((p) => String(p).trim()).filter(Boolean).slice(0, 4);
    if (typeof b.salesOpen === 'boolean' && b.salesOpen !== event.salesOpen) {
      event.salesOpen = b.salesOpen;
      changes.push(b.salesOpen ? 'ticket sales opened' : 'ticket sales closed');
    }
    if (typeof b.transferEnabled === 'boolean') event.transferEnabled = b.transferEnabled;
    if (b.maxPerOrder !== undefined) event.maxPerOrder = Math.min(20, Math.max(1, parseInt(b.maxPerOrder, 10) || 10));
    if (b.maxTransfersPerTicket !== undefined) event.maxTransfersPerTicket = Math.min(5, Math.max(0, parseInt(b.maxTransfersPerTicket, 10) || 0));
    if (b.transferCutoffHours !== undefined) event.transferCutoffHours = Math.min(72, Math.max(0, parseInt(b.transferCutoffHours, 10) || 0));
    if (typeof b.gatePin === 'string') {
      const pin = b.gatePin.trim();
      if (pin && !/^\d{4,8}$/.test(pin)) throw new AppError('The gate PIN must be 4 to 8 digits.', 400, 'validation');
      if (pin !== event.gatePin) changes.push('gate PIN');
      event.gatePin = pin;
    }
    if (b.policy && typeof b.policy === 'object') {
      for (const k of ['refund', 'transfer', 'entry']) {
        if (typeof b.policy[k] === 'string') event.policy[k] = b.policy[k].trim().slice(0, 2000);
      }
      changes.push('ticket policy');
    }
    await event.save();
    await audit(req.user, 'event_updated', changes.length ? `Updated: ${[...new Set(changes)].join(', ')}` : 'Saved settings');
    res.json({ event });
  })
);

/* ---------------- Tiers ---------------- */
function tierPayload(b, partial = false) {
  const out = {};
  if (!partial || b.name !== undefined) out.name = cleanName(b.name, 'ticket name');
  if (!partial || b.price !== undefined) {
    const price = Math.round(Number(b.price) * 100);
    if (!Number.isFinite(price) || price < 10000) throw new AppError('The ticket price must be at least ₦100.', 400, 'validation');
    out.price = price;
  }
  if (!partial || b.capacity !== undefined) {
    const cap = parseInt(b.capacity, 10);
    if (!Number.isFinite(cap) || cap < 0) throw new AppError('Please enter how many tickets are available.', 400, 'validation');
    out.capacity = cap;
  }
  if (b.perks !== undefined) out.perks = (Array.isArray(b.perks) ? b.perks : String(b.perks).split('\n')).map((p) => String(p).trim()).filter(Boolean).slice(0, 10);
  if (b.description !== undefined) out.description = String(b.description).trim().slice(0, 300);
  if (b.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(b.color)) throw new AppError('Please pick a valid colour.', 400, 'validation');
    out.color = b.color;
  }
  if (b.active !== undefined) out.active = Boolean(b.active);
  if (b.sortOrder !== undefined) out.sortOrder = parseInt(b.sortOrder, 10) || 0;
  return out;
}

router.get(
  '/tiers',
  asyncHandler(async (_req, res) => {
    const tiers = await Tier.find().sort({ sortOrder: 1, price: -1 });
    const stats = await tierStats();
    res.json({
      tiers: tiers.map((t) => ({
        ...t.toObject(),
        id: t._id,
        sold: stats.get(String(t._id))?.sold || 0,
        remaining: remainingFor(t, stats),
      })),
    });
  })
);

router.post(
  '/tiers',
  asyncHandler(async (req, res) => {
    const count = await Tier.countDocuments();
    const tier = await Tier.create({ sortOrder: count + 1, ...tierPayload(req.body) });
    await audit(req.user, 'tier_created', `${tier.name} at ${naira(tier.price)} (${tier.capacity} available)`);
    res.status(201).json({ tier });
  })
);

router.patch(
  '/tiers/:id',
  asyncHandler(async (req, res) => {
    const tier = await Tier.findById(req.params.id);
    if (!tier) throw new AppError("We couldn't find that ticket type.", 404, 'not_found');
    const before = { price: tier.price, capacity: tier.capacity, active: tier.active, name: tier.name };
    const upd = tierPayload(req.body, true);
    if (upd.capacity !== undefined) {
      const sold = await Ticket.countDocuments({ tier: tier._id, status: { $in: ['valid', 'used'] } });
      if (upd.capacity < sold) throw new AppError(`You have already sold ${sold} ${tier.name} tickets, so the limit can't go below ${sold}.`, 400, 'validation');
    }
    Object.assign(tier, upd);
    await tier.save();
    const diffs = [];
    if (tier.price !== before.price) diffs.push(`price ${naira(before.price)} to ${naira(tier.price)}`);
    if (tier.capacity !== before.capacity) diffs.push(`available ${before.capacity} to ${tier.capacity}`);
    if (tier.active !== before.active) diffs.push(tier.active ? 'shown on website' : 'hidden from website');
    if (tier.name !== before.name) diffs.push(`renamed from ${before.name}`);
    await audit(req.user, 'tier_updated', `${tier.name}: ${diffs.join(', ') || 'details edited'}. Existing tickets are not affected.`);
    res.json({ tier });
  })
);

router.delete(
  '/tiers/:id',
  asyncHandler(async (req, res) => {
    const tier = await Tier.findById(req.params.id);
    if (!tier) throw new AppError("We couldn't find that ticket type.", 404, 'not_found');
    const used = await Order.countDocuments({ 'items.tier': tier._id });
    if (used > 0) throw new AppError('Tickets of this type have already been bought, so it can’t be deleted. Hide it from the website instead.', 409, 'in_use');
    await tier.deleteOne();
    await audit(req.user, 'tier_deleted', tier.name);
    res.json({ ok: true });
  })
);

/* ---------------- Attendees ---------------- */
function attendeeFilter(q) {
  const f = {};
  if (q.status && ['valid', 'used', 'void'].includes(q.status)) f.status = q.status;
  if (q.tier) f.tier = q.tier;
  if (q.search) {
    const rx = new RegExp(escapeRegex(String(q.search).trim()), 'i');
    f.$or = [{ attendeeName: rx }, { code: rx }, { attendeeEmail: rx }];
  }
  return f;
}

router.get(
  '/attendees',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePage(req.query, 25);
    const filter = attendeeFilter(req.query);
    const [rows, total] = await Promise.all([
      Ticket.find(filter).populate('order', 'buyerName buyerEmail reference source').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Ticket.countDocuments(filter),
    ]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      rows: rows.map((t) => ({
        id: t._id,
        code: t.code,
        attendeeName: t.attendeeName,
        attendeeEmail: t.attendeeEmail,
        tierName: t.tierName,
        tierColor: t.tierColor,
        status: t.status,
        usedAt: t.usedAt,
        usedGate: t.usedGate,
        voidReason: t.voidReason,
        buyerName: t.order?.buyerName,
        buyerEmail: t.order?.buyerEmail,
        source: t.order?.source,
        createdAt: t.createdAt,
      })),
    });
  })
);

router.get(
  '/attendees/export',
  asyncHandler(async (req, res) => {
    const rows = await Ticket.find(attendeeFilter(req.query)).populate('order', 'buyerName buyerEmail reference source').sort({ createdAt: 1 }).limit(20000);
    const head = ['Code', 'Attendee', 'Attendee email', 'Tier', 'Status', 'Checked in at', 'Buyer', 'Buyer email', 'Order', 'Source'];
    const lines = [head.join(',')];
    for (const t of rows) {
      lines.push(
        [t.code, t.attendeeName, t.attendeeEmail, t.tierName, t.status, t.usedAt?.toISOString() || '', t.order?.buyerName, t.order?.buyerEmail, t.order?.reference, t.order?.source]
          .map(csvEscape)
          .join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ngfw-attendees.csv"');
    res.send('﻿' + lines.join('\n'));
  })
);

router.post(
  '/tickets/:id/resend',
  asyncHandler(async (req, res) => {
    const ticket = await Ticket.findById(req.params.id).populate('order', 'buyerEmail');
    if (!ticket) throw new AppError("We couldn't find that ticket.", 404, 'not_found');
    if (ticket.status === 'void') throw new AppError('This ticket has been cancelled or transferred, so there is nothing to resend.', 409, 'ticket_void');
    const to = ticket.attendeeEmail || ticket.order?.buyerEmail;
    if (!to) throw new AppError('There is no email address on this ticket.', 400, 'validation');
    await enqueueEmail({ kind: 'find', to, subject: 'Your ticket: Nigeria Gala Fashion Week', ticketIds: [ticket._id] });
    await audit(req.user, 'ticket_resent', `${ticket.code} (${ticket.attendeeName}) to ${to}`);
    res.json({ message: `Ticket re-sent to ${to}.` });
  })
);

router.post(
  '/tickets/:id/void',
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    if (reason.length < 3) throw new AppError('Please give a short reason for cancelling this ticket.', 400, 'validation');
    const ticket = await Ticket.findOneAndUpdate({ _id: req.params.id, status: 'valid' }, { $set: { status: 'void', voidReason: reason } }, { new: true });
    if (!ticket) throw new AppError('Only unused tickets can be cancelled.', 409, 'ticket_unavailable');
    await audit(req.user, 'ticket_voided', `${ticket.code} (${ticket.attendeeName}): ${reason}`);
    res.json({ ok: true });
  })
);

router.post(
  '/tickets/manual',
  asyncHandler(async (req, res) => {
    const source = req.body.kind === 'cash' ? 'cash' : 'complimentary';
    const tier = await Tier.findById(req.body.tierId);
    if (!tier) throw new AppError('Please choose a ticket type.', 400, 'validation');
    const list = Array.isArray(req.body.attendees) ? req.body.attendees : [];
    if (list.length < 1 || list.length > 20) throw new AppError('Add between 1 and 20 attendees.', 400, 'validation');
    const attendees = list.map((a, i) => ({ name: cleanName(a.name, `name for person ${i + 1}`), email: cleanEmail(a.email, { required: false }) }));
    const buyerEmail = cleanEmail(req.body.sendTo || attendees.find((a) => a.email)?.email, { label: 'email to send the tickets to' });
    const stats = await tierStats();
    if (attendees.length > remainingFor(tier, stats)) throw new AppError(`There are only ${remainingFor(tier, stats)} ${tier.name} tickets left.`, 409, 'sold_out');
    const order = await createManualOrder({ source, tier, attendees, buyerName: attendees[0].name, buyerEmail, actor: req.user });
    await audit(req.user, source === 'cash' ? 'cash_tickets_issued' : 'complimentary_tickets_issued', `${attendees.length} x ${tier.name} to ${buyerEmail} (order ${order.reference})`);
    res.status(201).json({ message: `${attendees.length} ${tier.name} ${attendees.length === 1 ? 'ticket was' : 'tickets were'} issued and emailed to ${buyerEmail}.` });
  })
);

/* ---------------- Orders ---------------- */
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePage(req.query, 25);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const rx = new RegExp(escapeRegex(String(req.query.search).trim()), 'i');
      filter.$or = [{ buyerName: rx }, { buyerEmail: rx }, { reference: rx }];
    }
    const [rows, total] = await Promise.all([Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Order.countDocuments(filter)]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      rows: rows.map((o) => ({
        id: o._id,
        reference: o.reference,
        status: o.status,
        source: o.source,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        tickets: o.items.length,
        total: o.total,
        discount: o.discount,
        promoCode: o.promoCode,
        paystackFee: o.paystackFee,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
    });
  })
);

/* ---------------- Promo codes ---------------- */
function promoPayload(b) {
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new AppError('Promo codes must be 3 to 20 letters or numbers.', 400, 'validation');
  const type = b.type === 'fixed' ? 'fixed' : 'percent';
  let value = Number(b.value);
  if (!Number.isFinite(value) || value <= 0) throw new AppError('Please enter the discount amount.', 400, 'validation');
  if (type === 'percent') {
    if (value > 100) throw new AppError('A percentage discount can’t be more than 100%.', 400, 'validation');
  } else value = Math.round(value * 100); // naira to kobo
  return {
    code,
    type,
    value,
    maxUses: Math.max(0, parseInt(b.maxUses, 10) || 0),
    expiresAt: b.expiresAt ? new Date(b.expiresAt) : undefined,
    active: b.active === undefined ? true : Boolean(b.active),
  };
}

router.get('/promos', asyncHandler(async (_req, res) => res.json({ promos: await Promo.find().sort({ createdAt: -1 }) })));

router.post(
  '/promos',
  asyncHandler(async (req, res) => {
    const promo = await Promo.create(promoPayload(req.body));
    await audit(req.user, 'promo_created', promo.code);
    res.status(201).json({ promo });
  })
);

router.patch(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const promo = await Promo.findById(req.params.id);
    if (!promo) throw new AppError("We couldn't find that promo code.", 404, 'not_found');
    if (Object.keys(req.body).length === 1 && req.body.active !== undefined) promo.active = Boolean(req.body.active);
    else Object.assign(promo, promoPayload({ ...promo.toObject(), value: promo.type === 'fixed' ? promo.value / 100 : promo.value, ...req.body }));
    await promo.save();
    await audit(req.user, 'promo_updated', `${promo.code} (${promo.active ? 'active' : 'paused'})`);
    res.json({ promo });
  })
);

router.delete(
  '/promos/:id',
  asyncHandler(async (req, res) => {
    const promo = await Promo.findByIdAndDelete(req.params.id);
    if (promo) await audit(req.user, 'promo_deleted', promo.code);
    res.json({ ok: true });
  })
);

/* ---------------- Payouts (read-only here; the admin records them) ---------------- */
router.get('/payouts', asyncHandler(async (_req, res) => res.json({ payouts: await Payout.find().sort({ paidOn: -1 }) })));

/* ---------------- Activity log ---------------- */
router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePage(req.query, 30);
    const [rows, total] = await Promise.all([Audit.find().sort({ createdAt: -1 }).skip(skip).limit(limit), Audit.countDocuments()]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), rows });
  })
);

export default router;
