import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/* ------------------------------ Users ------------------------------ */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'host'], required: true },
  },
  { timestamps: true }
);

/* ------------------------------ Event (single-event site) ------------------------------ */
const eventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    startsAt: { type: Date, required: true },
    venue: { type: String, default: '' },
    address: { type: String, default: '' },
    schedule: [{ _id: false, label: String, time: String }],
    heroImage: { type: String, default: '' },
    salesOpen: { type: Boolean, default: true },
    transferEnabled: { type: Boolean, default: true },
    maxTransfersPerTicket: { type: Number, default: 2 },
    transferCutoffHours: { type: Number, default: 2 },
    maxPerOrder: { type: Number, default: 10 },
    gatePin: { type: String, default: '' },
    contactPhones: [String],
    contactEmail: { type: String, default: '' },
    policy: {
      refund: { type: String, default: '' },
      transfer: { type: String, default: '' },
      entry: { type: String, default: '' },
    },
    // Admin-only setting. A snapshot is stored on every order so changing it never rewrites history.
    platformSharePercent: { type: Number, default: 10, min: 0, max: 100 },
    lastWebhookAt: { type: Date },
  },
  { timestamps: true }
);

/* ------------------------------ Tiers ------------------------------ */
const tierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 }, // kobo
    capacity: { type: Number, required: true, min: 0 },
    perks: [String],
    color: { type: String, default: '#d9b36c' },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ------------------------------ Promo codes ------------------------------ */
const promoSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 1 }, // percent (1-100) or kobo
    maxUses: { type: Number, default: 0 }, // 0 = unlimited
    used: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

/* ------------------------------ Orders ------------------------------ */
const orderItemSchema = new Schema(
  {
    tier: { type: Schema.Types.ObjectId, ref: 'Tier', required: true },
    tierName: String,
    tierColor: String,
    unitPrice: { type: Number, required: true }, // kobo, at time of purchase
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: { type: String, trim: true, lowercase: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },
    source: { type: String, enum: ['paystack', 'complimentary', 'cash'], default: 'paystack' },
    buyerName: { type: String, required: true, trim: true },
    buyerEmail: { type: String, required: true, trim: true, lowercase: true },
    buyerPhone: { type: String, default: '' },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true }, // kobo
    discount: { type: Number, default: 0 },
    promoCode: { type: String, default: '' },
    total: { type: Number, required: true }, // what the customer pays (kobo) – exactly the ticket price(s)
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending', index: true },
    paidAt: Date,
    channel: String,
    // Finance (filled when payment is confirmed)
    paystackFee: { type: Number, default: 0 },
    netRevenue: { type: Number, default: 0 },
    platformPercent: { type: Number, default: 0 },
    platformShare: { type: Number, default: 0 },
    hostShare: { type: Number, default: 0 },
    emailsQueued: { type: Boolean, default: false },
    refundedAt: Date,
    refundNote: String,
    note: String,
  },
  { timestamps: true }
);
orderSchema.index({ createdAt: -1 });
orderSchema.index({ buyerEmail: 1 });

/* ------------------------------ Tickets ------------------------------ */
const ticketSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    itemIndex: { type: Number, required: true },
    generation: { type: Number, default: 0 }, // 0 = original, +1 on every official transfer
    tier: { type: Schema.Types.ObjectId, ref: 'Tier', required: true },
    tierName: String,
    tierColor: String,
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: { type: String, trim: true, lowercase: true, default: '' },
    status: { type: String, enum: ['valid', 'used', 'void'], default: 'valid', index: true },
    usedAt: Date,
    usedGate: String,
    voidReason: String,
    transferCount: { type: Number, default: 0 },
    transferredFromCode: String,
  },
  { timestamps: true }
);
// Guarantees a payment can never create two tickets for the same seat, even if the webhook fires twice.
ticketSchema.index({ order: 1, itemIndex: 1, generation: 1 }, { unique: true });
ticketSchema.index({ attendeeEmail: 1 });
ticketSchema.index({ attendeeName: 'text', code: 'text' });

/* ------------------------------ Payouts to host (recorded by admin) ------------------------------ */
const payoutSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 1 }, // kobo
    paidOn: { type: Date, default: Date.now },
    method: { type: String, default: 'Bank transfer' },
    reference: { type: String, default: '' },
    note: { type: String, default: '' },
    recordedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

/* ------------------------------ Email queue ------------------------------ */
const emailJobSchema = new Schema(
  {
    kind: { type: String, enum: ['tickets', 'transfer', 'find'], default: 'tickets' },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    orderRef: String,
    ticketIds: [{ type: Schema.Types.ObjectId, ref: 'Ticket' }],
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: String, // internal only – never returned to the public
    sentAt: Date,
    mode: String, // 'smtp' | 'dev-log'
  },
  { timestamps: true }
);

/* ------------------------------ Audit log ------------------------------ */
const auditSchema = new Schema(
  {
    actorName: String,
    actorRole: String,
    action: { type: String, required: true },
    detail: String,
  },
  { timestamps: true }
);
auditSchema.index({ createdAt: -1 });

export const User = model('User', userSchema);
export const Event = model('Event', eventSchema);
export const Tier = model('Tier', tierSchema);
export const Promo = model('Promo', promoSchema);
export const Order = model('Order', orderSchema);
export const Ticket = model('Ticket', ticketSchema);
export const Payout = model('Payout', payoutSchema);
export const EmailJob = model('EmailJob', emailJobSchema);
export const Audit = model('Audit', auditSchema);
