import { Event, Order, Promo, Ticket } from '../models/index.js';
import { AppError } from './errors.js';
import { generateReference, generateTicketCode, generateToken } from './crypto.js';
import { estimatePaystackFee, splitRevenue } from './money.js';
import { enqueueEmail } from './mailer.js';
import { audit } from './audit.js';

const isDuplicateError = (e) =>
  e?.code === 11000 || (Array.isArray(e?.writeErrors) && e.writeErrors.every((w) => w.code === 11000 || w.err?.code === 11000));

/** Live stock per tier: tickets issued + seats held by checkouts that started in the last 15 minutes. */
export async function tierStats() {
  const sold = await Ticket.aggregate([
    { $match: { status: { $in: ['valid', 'used'] } } },
    { $group: { _id: '$tier', n: { $sum: 1 } } },
  ]);
  const held = await Order.aggregate([
    { $match: { status: 'pending', source: 'paystack', createdAt: { $gte: new Date(Date.now() - 15 * 60000) } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.tier', n: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const s of sold) map.set(String(s._id), { sold: s.n, held: 0 });
  for (const h of held) {
    const cur = map.get(String(h._id)) || { sold: 0, held: 0 };
    cur.held = h.n;
    map.set(String(h._id), cur);
  }
  return map;
}

export const remainingFor = (tier, stats) => {
  const s = stats.get(String(tier._id)) || { sold: 0, held: 0 };
  return Math.max(0, tier.capacity - s.sold - s.held);
};

/** Creates any missing tickets for a paid order. Safe to call many times (unique index prevents duplicates). */
export async function ensureTickets(order) {
  const existing = await Ticket.find({ order: order._id, generation: 0 }).select('itemIndex');
  const have = new Set(existing.map((t) => t.itemIndex));
  const docs = [];
  order.items.forEach((it, i) => {
    if (have.has(i)) return;
    docs.push({
      code: generateTicketCode(),
      accessToken: generateToken(),
      order: order._id,
      itemIndex: i,
      generation: 0,
      tier: it.tier,
      tierName: it.tierName,
      tierColor: it.tierColor,
      attendeeName: it.attendeeName,
      attendeeEmail: it.attendeeEmail,
    });
  });
  if (docs.length) {
    try {
      await Ticket.insertMany(docs, { ordered: false });
    } catch (e) {
      if (!isDuplicateError(e)) throw e;
    }
  }
  return Ticket.find({ order: order._id }).sort({ itemIndex: 1, generation: 1 });
}

/** Sends the order's tickets: everything to the buyer, and each attendee's own ticket to them if they gave an email. */
async function queueOrderEmails(order, tickets) {
  const claimed = await Order.findOneAndUpdate({ _id: order._id, emailsQueued: false }, { emailsQueued: true });
  if (!claimed) return;
  const gen0 = tickets.filter((t) => t.generation === 0);
  await enqueueEmail({
    to: order.buyerEmail,
    subject: `Your tickets: Nigeria Gala Fashion Week (${gen0.length} ${gen0.length === 1 ? 'ticket' : 'tickets'})`,
    orderRef: order.reference,
    ticketIds: gen0.map((t) => t._id),
  });
  const byEmail = new Map();
  for (const t of gen0) {
    if (t.attendeeEmail && t.attendeeEmail !== order.buyerEmail) {
      byEmail.set(t.attendeeEmail, [...(byEmail.get(t.attendeeEmail) || []), t._id]);
    }
  }
  for (const [to, ids] of byEmail) {
    await enqueueEmail({
      to,
      subject: 'Your ticket: Nigeria Gala Fashion Week',
      orderRef: order.reference,
      ticketIds: ids,
    });
  }
}

async function afterPaid(order) {
  const tickets = await ensureTickets(order);
  const gen0 = tickets.filter((t) => t.generation === 0);
  if (gen0.length >= order.items.length) await queueOrderEmails(order, tickets);
  return tickets;
}

/**
 * The single place a Paystack payment becomes tickets. Called by BOTH the webhook and the verify-on-return
 * fallback, so it must be idempotent: only the first caller flips the order to paid; everyone else is a no-op.
 */
export async function finalizePaidOrder(reference, data) {
  const order = await Order.findOne({ reference });
  if (!order) return null;
  if (order.status === 'paid' || order.status === 'refunded') {
    await afterPaid(order);
    return Order.findById(order._id);
  }

  if (Number(data.amount) !== order.total) {
    console.error(`[payments] amount mismatch for ${reference}: paid ${data.amount}, expected ${order.total}`);
    await audit(null, 'payment_amount_mismatch', `Order ${reference}: Paystack reported ${data.amount} kobo, expected ${order.total}.`);
    return null;
  }

  const event = await Event.findOne();
  const pct = event?.platformSharePercent ?? 10;
  const fee = typeof data.fees === 'number' ? data.fees : estimatePaystackFee(order.total);
  const split = splitRevenue(order.total, fee, pct);

  const won = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending', 'failed'] } },
    {
      $set: {
        status: 'paid',
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        channel: data.channel || '',
        paystackFee: split.fee,
        netRevenue: split.net,
        platformPercent: pct,
        platformShare: split.platform,
        hostShare: split.host,
      },
    },
    { new: true }
  );
  const finalOrder = won || (await Order.findById(order._id));
  if (won && won.promoCode) await Promo.updateOne({ code: won.promoCode }, { $inc: { used: 1 } });
  await afterPaid(finalOrder);
  return finalOrder;
}

/** Creates a paid order without Paystack (cash at the door, complimentary / sponsor tickets). Not part of the revenue split. */
export async function createManualOrder({ source, tier, attendees, buyerName, buyerEmail, amountKobo, actor }) {
  const items = attendees.map((a) => ({
    tier: tier._id,
    tierName: tier.name,
    tierColor: tier.color,
    unitPrice: source === 'cash' ? tier.price : 0,
    attendeeName: a.name,
    attendeeEmail: a.email || '',
  }));
  const subtotal = items.reduce((s, i) => s + i.unitPrice, 0);
  const order = await Order.create({
    reference: generateReference(),
    source,
    buyerName,
    buyerEmail,
    items,
    subtotal,
    total: source === 'cash' ? amountKobo ?? subtotal : 0,
    status: 'paid',
    paidAt: new Date(),
    emailsQueued: false,
    note: `Issued by ${actor.name}`,
  });
  await afterPaid(order);
  return order;
}

/** Official transfer: the old QR is voided and a brand-new QR is issued to the new person. */
export async function transferTicket(ticket, { name, email }, event) {
  if (!event.transferEnabled) throw new AppError('Ticket transfers are currently turned off for this event.', 403, 'transfer_disabled');
  const cutoff = new Date(new Date(event.startsAt).getTime() - event.transferCutoffHours * 3600000);
  if (Date.now() > cutoff.getTime()) {
    throw new AppError(`Transfers close ${event.transferCutoffHours} hours before the event starts.`, 403, 'transfer_closed');
  }
  if (ticket.transferCount >= event.maxTransfersPerTicket) {
    throw new AppError(`This ticket has already been transferred the maximum number of times (${event.maxTransfersPerTicket}).`, 403, 'transfer_limit');
  }

  const voided = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: 'valid', transferCount: { $lt: event.maxTransfersPerTicket } },
    { $set: { status: 'void', voidReason: 'transferred' } },
    { new: true }
  );
  if (!voided) throw new AppError('This ticket can no longer be transferred. It may have been used or already transferred.', 409, 'transfer_unavailable');

  try {
    const fresh = await Ticket.create({
      code: generateTicketCode(),
      accessToken: generateToken(),
      order: voided.order,
      itemIndex: voided.itemIndex,
      generation: voided.generation + 1,
      tier: voided.tier,
      tierName: voided.tierName,
      tierColor: voided.tierColor,
      attendeeName: name,
      attendeeEmail: email,
      transferCount: voided.transferCount + 1,
      transferredFromCode: voided.code,
    });
    await enqueueEmail({
      kind: 'transfer',
      to: email,
      subject: 'A ticket was transferred to you: Nigeria Gala Fashion Week',
      orderRef: String(voided.order),
      ticketIds: [fresh._id],
    });
    return fresh;
  } catch (err) {
    // Put the original ticket back so nobody loses their seat if something goes wrong.
    await Ticket.updateOne({ _id: voided._id }, { $set: { status: 'valid' }, $unset: { voidReason: 1 } });
    throw err;
  }
}
