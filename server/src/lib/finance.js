import { Event, Order, Payout, Ticket, Tier } from '../models/index.js';

const PAID_ONLINE = { status: 'paid', source: 'paystack' };

/** One source of truth for every money number shown on BOTH dashboards, so host and admin always see the same figures. */
export async function financeSummary() {
  const [online] = await Order.aggregate([
    { $match: PAID_ONLINE },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        tickets: { $sum: { $size: '$items' } },
        gross: { $sum: '$total' },
        fees: { $sum: '$paystackFee' },
        net: { $sum: '$netRevenue' },
        platform: { $sum: '$platformShare' },
        host: { $sum: '$hostShare' },
        discounts: { $sum: '$discount' },
      },
    },
  ]);
  const [refunded] = await Order.aggregate([
    { $match: { status: 'refunded', source: 'paystack' } },
    { $group: { _id: null, orders: { $sum: 1 }, gross: { $sum: '$total' } } },
  ]);
  const [offline] = await Order.aggregate([
    { $match: { status: 'paid', source: { $in: ['cash', 'complimentary'] } } },
    { $group: { _id: null, tickets: { $sum: { $size: '$items' } }, cash: { $sum: '$total' } } },
  ]);
  const [paid] = await Payout.aggregate([{ $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);

  const o = online || {};
  const hostShare = o.host || 0;
  const paidOut = paid?.total || 0;
  return {
    orders: o.orders || 0,
    tickets: o.tickets || 0,
    gross: o.gross || 0,
    fees: o.fees || 0,
    net: o.net || 0,
    platformShare: o.platform || 0,
    hostShare,
    discounts: o.discounts || 0,
    paidOut,
    payoutCount: paid?.count || 0,
    outstanding: hostShare - paidOut, // what the host is still owed
    refundedOrders: refunded?.orders || 0,
    refundedGross: refunded?.gross || 0,
    offlineTickets: offline?.tickets || 0,
    offlineCash: offline?.cash || 0,
  };
}

export async function overviewData() {
  const event = await Event.findOne();
  const finance = await financeSummary();

  const ticketCounts = await Ticket.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  const tc = Object.fromEntries(ticketCounts.map((t) => [t._id, t.n]));

  const series = await Order.aggregate([
    { $match: PAID_ONLINE },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Africa/Lagos' } },
        gross: { $sum: '$total' },
        net: { $sum: '$netRevenue' },
        tickets: { $sum: { $size: '$items' } },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const tiers = await Tier.find().sort({ sortOrder: 1, price: -1 });
  const perTierRaw = await Order.aggregate([
    { $match: PAID_ONLINE },
    { $unwind: '$items' },
    { $group: { _id: '$items.tier', tickets: { $sum: 1 }, faceValue: { $sum: '$items.unitPrice' } } },
  ]);
  const sold = await Ticket.aggregate([
    { $match: { status: { $in: ['valid', 'used'] } } },
    { $group: { _id: '$tier', n: { $sum: 1 }, used: { $sum: { $cond: [{ $eq: ['$status', 'used'] }, 1, 0] } } } },
  ]);
  const soldMap = new Map(sold.map((s) => [String(s._id), s]));
  const faceMap = new Map(perTierRaw.map((p) => [String(p._id), p]));

  const perTier = tiers.map((t) => ({
    id: t._id,
    name: t.name,
    color: t.color,
    price: t.price,
    capacity: t.capacity,
    active: t.active,
    sold: soldMap.get(String(t._id))?.n || 0,
    checkedIn: soldMap.get(String(t._id))?.used || 0,
    onlineTickets: faceMap.get(String(t._id))?.tickets || 0,
    faceValue: faceMap.get(String(t._id))?.faceValue || 0,
  }));

  return {
    event: { name: event.name, startsAt: event.startsAt, salesOpen: event.salesOpen },
    platformPercent: event.platformSharePercent,
    finance,
    tickets: {
      valid: tc.valid || 0,
      used: tc.used || 0,
      void: tc.void || 0,
      issued: (tc.valid || 0) + (tc.used || 0),
    },
    capacity: perTier.reduce((s, t) => s + t.capacity, 0),
    series,
    perTier,
  };
}
