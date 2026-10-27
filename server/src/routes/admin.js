// Platform-admin-only API.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { EmailJob, Event, Order, Payout, Ticket, User } from '../models/index.js';
import { AppError, asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { financeSummary, overviewData } from '../lib/finance.js';
import { cleanEmail, cleanName, csvEscape, escapeRegex, parsePage } from '../lib/validate.js';
import { refundTransaction, verifyTransaction } from '../lib/paystack.js';
import { finalizePaidOrder } from '../lib/issue.js';
import { processEmailQueue } from '../lib/mailer.js';
import { config } from '../config.js';

const router = Router();
router.use(requireAuth('admin'));

const naira = (k) => `₦${(k / 100).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/* ---------------- Overview ---------------- */
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const data = await overviewData();
    const event = await Event.findOne();
    const [pending, failed, sent] = await Promise.all([
      EmailJob.countDocuments({ status: 'pending' }),
      EmailJob.countDocuments({ status: 'failed' }),
      EmailJob.countDocuments({ status: 'sent' }),
    ]);
    const stalePending = await Order.countDocuments({ status: 'pending', source: 'paystack', createdAt: { $lt: new Date(Date.now() - 30 * 60000) } });
    const failedPayments = await Order.countDocuments({ status: 'failed' });
    const recent = await Order.find({ status: 'paid', source: 'paystack' }).sort({ paidAt: -1 }).limit(8);
    res.json({
      ...data,
      health: {
        emails: { pending, failed, sent },
        lastWebhookAt: event.lastWebhookAt || null,
        stalePending,
        failedPayments,
        paystackConfigured: Boolean(config.paystackSecret),
        paystackMode: config.paystackSecret.startsWith('sk_live') ? 'live' : config.paystackSecret ? 'test' : 'none',
        smtpConfigured: Boolean(config.smtp.user && config.smtp.pass),
      },
      recent: recent.map((o) => ({
        reference: o.reference,
        buyerName: o.buyerName,
        paidAt: o.paidAt,
        tickets: o.items.length,
        gross: o.total,
        fee: o.paystackFee,
        net: o.netRevenue,
        platform: o.platformShare,
        host: o.hostShare,
      })),
    });
  })
);

/* ---------------- Ledger: every payment, line by line ---------------- */
function ledgerFilter(q) {
  const f = { status: 'paid', source: 'paystack' };
  if (q.from || q.to) {
    f.paidAt = {};
    if (q.from) f.paidAt.$gte = new Date(q.from);
    if (q.to) f.paidAt.$lte = new Date(new Date(q.to).getTime() + 86399999);
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(String(q.search).trim()), 'i');
    f.$or = [{ buyerName: rx }, { buyerEmail: rx }, { reference: rx }];
  }
  return f;
}

router.get(
  '/ledger',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePage(req.query, 25);
    const filter = ledgerFilter(req.query);
    const [rows, total, sums] = await Promise.all([
      Order.find(filter).sort({ paidAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
      Order.aggregate([
        { $match: filter },
        { $group: { _id: null, gross: { $sum: '$total' }, fees: { $sum: '$paystackFee' }, net: { $sum: '$netRevenue' }, platform: { $sum: '$platformShare' }, host: { $sum: '$hostShare' }, tickets: { $sum: { $size: '$items' } } } },
      ]),
    ]);
    res.json({
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      totals: sums[0] || { gross: 0, fees: 0, net: 0, platform: 0, host: 0, tickets: 0 },
      rows: rows.map((o) => ({
        id: o._id,
        reference: o.reference,
        paidAt: o.paidAt,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        tickets: o.items.length,
        channel: o.channel,
        discount: o.discount,
        promoCode: o.promoCode,
        gross: o.total,
        fee: o.paystackFee,
        net: o.netRevenue,
        percent: o.platformPercent,
        platform: o.platformShare,
        host: o.hostShare,
      })),
    });
  })
);

router.get(
  '/ledger/export',
  asyncHandler(async (req, res) => {
    const rows = await Order.find(ledgerFilter(req.query)).sort({ paidAt: 1 }).limit(20000);
    const head = ['Paid at', 'Reference', 'Buyer', 'Buyer email', 'Tickets', 'Channel', 'Promo', 'Gross (NGN)', 'Paystack fee (NGN)', 'Net (NGN)', 'Platform %', 'Platform share (NGN)', 'Host share (NGN)'];
    const k = (v) => (v / 100).toFixed(2);
    const lines = [head.join(',')];
    for (const o of rows) {
      lines.push([o.paidAt?.toISOString(), o.reference, o.buyerName, o.buyerEmail, o.items.length, o.channel, o.promoCode, k(o.total), k(o.paystackFee), k(o.netRevenue), o.platformPercent, k(o.platformShare), k(o.hostShare)].map(csvEscape).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ngfw-ledger.csv"');
    res.send('﻿' + lines.join('\n'));
  })
);

/* ---------------- Payouts to the host ---------------- */
router.get(
  '/payouts',
  asyncHandler(async (_req, res) => {
    const [payouts, finance] = await Promise.all([Payout.find().sort({ paidOn: -1 }), financeSummary()]);
    res.json({ payouts, owed: finance.hostShare, paidOut: finance.paidOut, outstanding: finance.outstanding });
  })
);

router.post(
  '/payouts',
  asyncHandler(async (req, res) => {
    const amount = Math.round(Number(req.body.amount) * 100);
    if (!Number.isFinite(amount) || amount < 100) throw new AppError('Please enter the amount you paid the host.', 400, 'validation');
    const finance = await financeSummary();
    if (amount > finance.outstanding) {
      throw new AppError(`That is more than the host is currently owed (${naira(finance.outstanding)}). Please check the amount.`, 400, 'validation');
    }
    const paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();
    if (Number.isNaN(paidOn.getTime())) throw new AppError('Please enter a valid payment date.', 400, 'validation');
    const payout = await Payout.create({
      amount,
      paidOn,
      method: String(req.body.method || 'Bank transfer').slice(0, 60),
      reference: String(req.body.reference || '').slice(0, 80),
      note: String(req.body.note || '').slice(0, 300),
      recordedBy: req.user.name,
    });
    await audit(req.user, 'payout_recorded', `${naira(amount)} paid to host${payout.reference ? ` (ref ${payout.reference})` : ''}`);
    res.status(201).json({ payout });
  })
);

/* ---------------- Settings ---------------- */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const event = await Event.findOne();
    const host = await User.findOne({ role: 'host' });
    res.json({
      platformSharePercent: event.platformSharePercent,
      host: host ? { name: host.name, email: host.email } : null,
      system: {
        clientUrl: config.clientUrl,
        paystackMode: config.paystackSecret.startsWith('sk_live') ? 'live' : config.paystackSecret ? 'test' : 'none',
        smtpConfigured: Boolean(config.smtp.user && config.smtp.pass),
        mailFrom: config.smtp.from,
      },
    });
  })
);

router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const pct = Number(req.body.platformSharePercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new AppError('The platform share must be a number between 0 and 100.', 400, 'validation');
    const event = await Event.findOne();
    const before = event.platformSharePercent;
    event.platformSharePercent = Math.round(pct * 100) / 100;
    await event.save();
    await audit(req.user, 'platform_share_changed', `Platform share changed from ${before}% to ${event.platformSharePercent}%. Applies to future payments only.`);
    res.json({ platformSharePercent: event.platformSharePercent });
  })
);

router.put(
  '/host-account',
  asyncHandler(async (req, res) => {
    const host = await User.findOne({ role: 'host' });
    if (!host) throw new AppError("There's no host account yet.", 404, 'not_found');
    host.name = cleanName(req.body.name, 'host name');
    host.email = cleanEmail(req.body.email);
    if (req.body.password) {
      if (String(req.body.password).length < 8) throw new AppError('The password must be at least 8 characters long.', 400, 'validation');
      host.passwordHash = await bcrypt.hash(String(req.body.password), 12);
    }
    await host.save();
    await audit(req.user, 'host_account_updated', `${host.email}${req.body.password ? ' (password reset)' : ''}`);
    res.json({ ok: true });
  })
);

/* ---------------- Email queue ---------------- */
router.get(
  '/emails',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePage(req.query, 25);
    const filter = req.query.status ? { status: req.query.status } : {};
    const [rows, total] = await Promise.all([EmailJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), EmailJob.countDocuments(filter)]);
    res.json({ total, page, pages: Math.max(1, Math.ceil(total / limit)), rows });
  })
);

router.post(
  '/emails/:id/retry',
  asyncHandler(async (req, res) => {
    const job = await EmailJob.findByIdAndUpdate(req.params.id, { $set: { status: 'pending', attempts: 0, nextAttemptAt: new Date() } }, { new: true });
    if (!job) throw new AppError("We couldn't find that email.", 404, 'not_found');
    setImmediate(processEmailQueue);
    await audit(req.user, 'email_retried', `${job.to}`);
    res.json({ message: `We're trying again to send to ${job.to}.` });
  })
);

/* ---------------- Payments: reconcile + refund ---------------- */
router.post(
  '/reconcile',
  asyncHandler(async (req, res) => {
    const pending = await Order.find({ status: 'pending', source: 'paystack', createdAt: { $gte: new Date(Date.now() - 7 * 86400000), $lte: new Date(Date.now() - 2 * 60000) } }).limit(100);
    let recovered = 0;
    for (const o of pending) {
      try {
        const data = await verifyTransaction(o.reference);
        if (data.status === 'success') {
          const done = await finalizePaidOrder(o.reference, data);
          if (done?.status === 'paid') recovered += 1;
        }
      } catch {
        /* never completed on Paystack's side; ignore */
      }
    }
    await audit(req.user, 'payments_reconciled', `Checked ${pending.length} pending orders, recovered ${recovered}.`);
    res.json({ message: recovered ? `Found ${recovered} paid ${recovered === 1 ? 'order' : 'orders'} we had missed. Tickets are on their way.` : `Checked ${pending.length} pending ${pending.length === 1 ? 'order' : 'orders'}. Everything is up to date.` });
  })
);

router.post(
  '/orders/:id/refund',
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || '').trim().slice(0, 200);
    if (reason.length < 3) throw new AppError('Please give a short reason for this refund.', 400, 'validation');
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'paid' || order.source !== 'paystack') throw new AppError('Only paid online orders can be refunded.', 409, 'not_refundable');
    const used = await Ticket.countDocuments({ order: order._id, status: 'used' });
    if (used > 0) throw new AppError('Some tickets from this order have already been used at the gate, so it can’t be refunded.', 409, 'not_refundable');

    await refundTransaction(order.reference);
    order.status = 'refunded';
    order.refundedAt = new Date();
    order.refundNote = reason;
    await order.save();
    await Ticket.updateMany({ order: order._id, status: 'valid' }, { $set: { status: 'void', voidReason: 'refunded' } });
    await audit(req.user, 'order_refunded', `${order.reference} (${naira(order.total)}): ${reason}`);
    res.json({ message: `Refund of ${naira(order.total)} started. The tickets in this order no longer work.` });
  })
);

export default router;
