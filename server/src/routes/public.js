import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Event, Order, Promo, Ticket, Tier } from "../models/index.js";
import { AppError, asyncHandler } from "../lib/errors.js";
import { buildQrPayload, generateReference } from "../lib/crypto.js";
import { cleanEmail, cleanName, cleanPhone } from "../lib/validate.js";
import { initializeTransaction, verifyTransaction } from "../lib/paystack.js";
import {
  ensureTickets,
  finalizePaidOrder,
  remainingFor,
  tierStats,
  transferTicket,
} from "../lib/issue.js";
import { enqueueEmail } from "../lib/mailer.js";
import { ticketPdfBuffer } from "../lib/ticketPdf.js";
import { config } from "../config.js";
import { cached } from "../lib/cache.js";

const router = Router();

const limiter = (windowMin, max, message) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message, code: "rate_limited" },
  });

const MIN_CHARGE = 10000; // ₦100 in kobo

// Buyers' pages check their order every 3 seconds. Ask Paystack at most once per 8 seconds for each order,
// so a rush of buyers doesn't flood Paystack or the database.
const lastVerify = new Map();
function shouldVerify(reference) {
  const now = Date.now();
  if (lastVerify.size > 5000)
    for (const [k, t] of lastVerify) if (now - t > 60000) lastVerify.delete(k);
  if (now - (lastVerify.get(reference) || 0) < 8000) return false;
  lastVerify.set(reference, now);
  return true;
}

const publicEvent = (e) => ({
  name: e.name,
  tagline: e.tagline,
  description: e.description,
  startsAt: e.startsAt,
  venue: e.venue,
  address: e.address,
  schedule: e.schedule,
  heroImage: e.heroImage,
  salesOpen: e.salesOpen,
  transferEnabled: e.transferEnabled,
  transferCutoffHours: e.transferCutoffHours,
  maxTransfersPerTicket: e.maxTransfersPerTicket,
  maxPerOrder: e.maxPerOrder,
  contactPhones: e.contactPhones,
  contactEmail: e.contactEmail,
  policy: e.policy,
});

async function resolvePromo(code, subtotal) {
  const clean = String(code || "")
    .trim()
    .toUpperCase();
  if (!clean) return { promo: null, discount: 0 };
  const promo = await Promo.findOne({ code: clean, active: true });
  const bad =
    !promo ||
    (promo.expiresAt && promo.expiresAt < new Date()) ||
    (promo.maxUses > 0 && promo.used >= promo.maxUses);
  if (bad)
    throw new AppError(
      "That promo code isn't valid or has expired.",
      400,
      "promo_invalid",
    );
  const discount =
    promo.type === "percent"
      ? Math.round((subtotal * promo.value) / 100)
      : Math.min(promo.value, subtotal);
  return { promo, discount };
}

/* ---------------- Event + tiers ---------------- */
router.get(
  "/event",
  asyncHandler(async (_req, res) => {
    // Shared for 10 seconds: during a rush, thousands of page loads cost the database a handful of reads in total.
    // Stock shown here can be a few seconds old, but checkout always re-checks real stock before taking payment.
    const payload = await cached("public:event", 10000, async () => {
      const event = await Event.findOne();
      if (!event)
        throw new AppError(
          "The event has not been set up yet.",
          404,
          "not_found",
        );
      const tiers = await Tier.find({ active: true }).sort({
        sortOrder: 1,
        price: -1,
      });
      const stats = await tierStats();
      return {
        event: publicEvent(event),
        tiers: tiers.map((t) => {
          const remaining = remainingFor(t, stats);
          return {
            id: t._id,
            name: t.name,
            price: t.price,
            color: t.color,
            description: t.description,
            perks: t.perks,
            remaining,
            soldOut: remaining === 0,
            lowStock:
              remaining > 0 &&
              remaining <= Math.max(5, Math.ceil(t.capacity * 0.1)),
          };
        }),
      };
    });
    res.set("Cache-Control", "public, max-age=5");
    res.json(payload);
  }),
);

/* ---------------- Promo check ---------------- */
router.post(
  "/promo/validate",
  limiter(
    10,
    40,
    "Too many attempts. Please wait a few minutes and try again.",
  ),
  asyncHandler(async (req, res) => {
    const subtotal = Number(req.body.subtotal) || 0;
    const { promo, discount } = await resolvePromo(req.body.code, subtotal);
    if (!promo)
      throw new AppError("Enter a promo code first.", 400, "validation");
    res.json({ code: promo.code, discount });
  }),
);

/* ---------------- Checkout ---------------- */
router.post(
  "/orders/checkout",
  limiter(
    10,
    25,
    "Too many checkout attempts. Please wait a few minutes and try again.",
  ),
  asyncHandler(async (req, res) => {
    const event = await Event.findOne();
    if (!event)
      throw new AppError(
        "The event has not been set up yet.",
        404,
        "not_found",
      );
    if (!event.salesOpen)
      throw new AppError(
        "Ticket sales are closed right now. Please check back soon.",
        403,
        "sales_closed",
      );

    const buyerName = cleanName(req.body.buyerName, "full name");
    const buyerEmail = cleanEmail(req.body.buyerEmail);
    const buyerPhone = cleanPhone(req.body.buyerPhone);
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    if (rawItems.length === 0)
      throw new AppError(
        "Please choose at least one ticket.",
        400,
        "validation",
      );
    if (rawItems.length > event.maxPerOrder) {
      throw new AppError(
        `You can buy up to ${event.maxPerOrder} tickets in one order.`,
        400,
        "validation",
      );
    }

    const tiers = await Tier.find({
      _id: { $in: rawItems.map((i) => i.tierId) },
      active: true,
    });
    const tierMap = new Map(tiers.map((t) => [String(t._id), t]));

    const items = rawItems.map((raw, idx) => {
      const tier = tierMap.get(String(raw.tierId));
      if (!tier)
        throw new AppError(
          "One of the ticket types you chose is no longer available. Please refresh and choose again.",
          409,
          "tier_unavailable",
        );
      return {
        tier: tier._id,
        tierName: tier.name,
        tierColor: tier.color,
        unitPrice: tier.price,
        attendeeName: cleanName(raw.attendeeName, `name for ticket ${idx + 1}`),
        attendeeEmail: cleanEmail(raw.attendeeEmail, {
          required: false,
          label: `email for ticket ${idx + 1}`,
        }),
      };
    });

    // Stock check per tier
    const stats = await tierStats();
    const wanted = new Map();
    for (const it of items)
      wanted.set(String(it.tier), (wanted.get(String(it.tier)) || 0) + 1);
    for (const [tierId, qty] of wanted) {
      const tier = tierMap.get(tierId);
      const left = remainingFor(tier, stats);
      if (qty > left) {
        throw new AppError(
          left === 0
            ? `${tier.name} tickets are sold out.`
            : `Only ${left} ${tier.name} ${left === 1 ? "ticket is" : "tickets are"} left. Please reduce your quantity.`,
          409,
          "sold_out",
        );
      }
    }

    const subtotal = items.reduce((s, i) => s + i.unitPrice, 0);
    const { promo, discount } = await resolvePromo(
      req.body.promoCode,
      subtotal,
    );
    const total = subtotal - discount;
    if (total < MIN_CHARGE) {
      throw new AppError(
        "This promo code covers the full price. Please contact the organisers for complimentary tickets.",
        400,
        "promo_invalid",
      );
    }

    const reference = generateReference();
    const order = await Order.create({
      reference,
      buyerName,
      buyerEmail,
      buyerPhone,
      items,
      subtotal,
      discount,
      promoCode: promo?.code || "",
      total,
      status: "pending",
    });

    try {
      const init = await initializeTransaction({
        email: buyerEmail,
        amount: total, // customer is charged EXACTLY the ticket price. Paystack's fee comes out of the host/platform proceeds.
        reference,
        callbackUrl: `${config.clientUrl}/order/${reference}`,
        metadata: {
          orderId: String(order._id),
          tickets: items.length,
          buyerName,
        },
      });
      res
        .status(201)
        .json({ reference, authorizationUrl: init.authorization_url });
    } catch (err) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { status: "failed", note: "Could not start payment." } },
      );
      throw err;
    }
  }),
);

/* ---------------- Order status (polled after payment) ---------------- */
router.get(
  "/orders/:reference",
  asyncHandler(async (req, res) => {
    let order = await Order.findOne({ reference: req.params.reference });
    if (!order)
      throw new AppError(
        "We couldn't find that order. Please check the link in your email.",
        404,
        "not_found",
      );

    // Webhooks can be delayed (and never reach localhost), so we also ask Paystack directly when the buyer returns.
    if (
      order.status === "pending" &&
      order.source === "paystack" &&
      shouldVerify(order.reference)
    ) {
      try {
        const data = await verifyTransaction(order.reference);
        if (data.status === "success")
          order = (await finalizePaidOrder(order.reference, data)) || order;
        else if (data.status === "failed") {
          await Order.updateOne(
            { _id: order._id, status: "pending" },
            { $set: { status: "failed" } },
          );
          order = await Order.findById(order._id);
        }
      } catch {
        /* Not paid yet / reference unknown to Paystack: keep showing "pending" */
      }
    }

    let tickets = [];
    if (order.status === "paid") {
      // Only the ORIGINAL tickets. After a transfer, the new holder's ticket link must stay private to them.
      tickets = (await ensureTickets(order)).filter((t) => t.generation === 0);
    }

    res.json({
      reference: order.reference,
      status: order.status,
      total: order.total,
      discount: order.discount,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      items: order.items.map((i) => ({
        tierName: i.tierName,
        attendeeName: i.attendeeName,
        unitPrice: i.unitPrice,
      })),
      tickets: tickets
        .filter((t) => t.status !== "void")
        .map((t) => ({
          code: t.code,
          token: t.accessToken,
          tierName: t.tierName,
          tierColor: t.tierColor,
          attendeeName: t.attendeeName,
          status: t.status,
        })),
    });
  }),
);

/* ---------------- Ticket page ---------------- */
async function loadTicket(token) {
  const ticket = await Ticket.findOne({ accessToken: token });
  if (!ticket)
    throw new AppError(
      'We couldn\'t find that ticket. Please use the link from your email, or try "Find my ticket".',
      404,
      "not_found",
    );
  return ticket;
}

router.get(
  "/tickets/view/:token",
  asyncHandler(async (req, res) => {
    const ticket = await loadTicket(req.params.token);
    const event = await Event.findOne();
    const cutoff = new Date(
      new Date(event.startsAt).getTime() - event.transferCutoffHours * 3600000,
    );
    const canTransfer =
      ticket.status === "valid" &&
      event.transferEnabled &&
      ticket.transferCount < event.maxTransfersPerTicket &&
      Date.now() < cutoff.getTime();
    res.json({
      ticket: {
        code: ticket.code,
        tierName: ticket.tierName,
        tierColor: ticket.tierColor,
        attendeeName: ticket.attendeeName,
        status: ticket.status,
        usedAt: ticket.usedAt,
        voidReason: ticket.voidReason || "",
        transferCount: ticket.transferCount,
      },
      qrPayload: ticket.status === "void" ? null : buildQrPayload(ticket.code),
      canTransfer,
      event: publicEvent(event),
    });
  }),
);

router.get(
  "/tickets/view/:token/pdf",
  asyncHandler(async (req, res) => {
    const ticket = await loadTicket(req.params.token);
    if (ticket.status === "void")
      throw new AppError(
        "This ticket is no longer valid, so it cannot be downloaded.",
        410,
        "ticket_void",
      );
    const event = await Event.findOne();
    const buf = await ticketPdfBuffer({ ticket, event });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="NGFW-ticket-${ticket.code}.pdf"`,
    );
    res.send(buf);
  }),
);

/* ---------------- Find my ticket ---------------- */
router.post(
  "/tickets/find",
  limiter(15, 6, "Too many requests. Please wait a few minutes and try again."),
  asyncHandler(async (req, res) => {
    const email = cleanEmail(req.body.email);
    const orders = await Order.find({
      buyerEmail: email,
      status: "paid",
    }).select("_id");
    const tickets = await Ticket.find({
      status: "valid",
      $or: [
        { attendeeEmail: email },
        { order: { $in: orders.map((o) => o._id) } },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(10);
    if (tickets.length) {
      await enqueueEmail({
        kind: "find",
        to: email,
        subject: "Your tickets: Nigeria Gala Fashion Week",
        ticketIds: tickets.map((t) => t._id),
      });
    }
    // Same answer whether or not tickets exist, so nobody can use this form to discover who has bought tickets.
    res.json({
      message:
        "If there are tickets linked to that email address, we have just sent them. It can take a minute or two to arrive. Please check your spam folder too.",
    });
  }),
);

/* ---------------- Transfer ---------------- */
router.post(
  "/tickets/transfer/:token",
  limiter(
    15,
    8,
    "Too many transfer attempts. Please wait a few minutes and try again.",
  ),
  asyncHandler(async (req, res) => {
    const ticket = await loadTicket(req.params.token);
    const event = await Event.findOne();
    const name = cleanName(req.body.name, "new holder's name");
    const email = cleanEmail(req.body.email, {
      label: "new holder's email address",
    });
    const fresh = await transferTicket(ticket, { name, email }, event);
    res.status(201).json({
      message: `Done! A new ticket for ${fresh.attendeeName} is on its way to ${email}. Your old QR code has stopped working.`,
    });
  }),
);

export default router;
