# Nigeria Gala Fashion Week: Ticketing

Online ticket sales with Paystack, one signed QR ticket per guest, ticket emails through Nodemailer, a host dashboard, a platform-admin dashboard with a transparent 90/10 revenue split, and a phone-based gate scanner.

**Stack:** React 18 + Vite · **Tailwind CSS v4** · Redux Toolkit + RTK Query · Framer Motion · Lucide React · Sonner · Node/Express · MongoDB (Mongoose) · Paystack · Nodemailer · PDFKit

---

## 1. Run it on your laptop (about 5 minutes)

You need **Node.js 18+** and a **MongoDB** database (local, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
npm run setup      # installs everything and creates server/.env with random secrets
# edit server/.env  (see below)
npm run dev        # API on :5000, website on :5173
```

Open **http://localhost:5173**.

### What to put in `server/.env`

| Key | What it is |
|---|---|
| `MONGO_URI` | `mongodb://127.0.0.1:27017/ngfw-tickets` locally, or your Atlas URL |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` from Paystack dashboard > Settings > API Keys. Use test keys until launch |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | **Your** platform-admin login (created on first start) |
| `HOST_EMAIL` / `HOST_PASSWORD` | The client's host login (created on first start) |
| `SMTP_USER` / `SMTP_PASS` | Optional free email: a Gmail address + an **App Password** (Google Account > Security > 2-Step Verification > App passwords) |
| `CLIENT_URL` | Where the website runs (`http://localhost:5173` locally) |

> **No SMTP yet?** Leave `SMTP_USER` empty. Emails are not sent, but each ticket link is printed in the API terminal, so you can test the whole flow immediately.

On first start the API creates both accounts, the event (28 Nov 2026, Voen Mall Film House, Ugbowo, Benin City), the four tiers from the flyer (Royalty ₦100,000 · Celebrity ₦20,000 · Gala ₦10,000 · Ball ₦5,000) and a random **gate PIN** (printed in the terminal). Capacities are placeholders. The host changes everything in the dashboard.

### Pages

| URL | Who | What |
|---|---|---|
| `/` | Public | Landing page, countdown, ticket tiers |
| `/checkout` | Public | A name on every ticket, promo code, pay with Paystack |
| `/order/:reference` | Public | Payment confirmation and the tickets |
| `/ticket/:token` | Ticket holder | Ticket, PDF, add to calendar, **transfer** |
| `/find-ticket` | Public | Re-send tickets by email |
| `/policy` | Public | Refund, transfer and entry policy |
| `/console/login` | Host + Admin | Sign in |
| `/console/*` | Host (and admin) | Overview, attendees, orders, payouts received, tickets & prices, event & policy, promo codes, issue tickets by hand, activity log |
| `/admin/*` | **You only** | Platform overview and health, payments ledger (with CSV and refunds), host payouts, email delivery, settings (platform %, host account) |
| `/scanner` | Gate staff | PIN, camera scanner, works offline |

### Add the client's logo
Drop their logo at `client/public/logo.png` (shown in the site header, footer and sign-in) and `server/assets/logo.png` (printed on the PDF ticket). Without them, a gold "N" monogram is used.

---

## 2. How duplicate and shared tickets are prevented

1. **One QR per person.** Buying 4 tickets creates 4 tickets, each with the guest's name. Guests can arrive at different times and each walks in on their own.
2. **Signed QR codes.** Each QR holds `NGFW.<code>.<signature>` (HMAC-SHA256 with `TICKET_SECRET`). Edited or invented QR codes fail.
3. **Single use, enforced by the database.** The gate does one atomic `valid → used` update, so even two gates scanning the same code at the same instant only admit one. The second person sees a red/amber **"Already scanned at 7:42 PM, Gate 2"** screen.
4. **Official transfer.** The ticket page has "Transfer ticket". The old QR is voided and a brand-new one is emailed to the new person. Limits: 2 transfers per ticket and closes 2 hours before the event (both editable).
5. **Payments are never trusted from the browser.** Tickets are created only after Paystack confirms the payment (webhook signature + amount check, or server-to-server verify when the buyer returns). A unique database index guarantees a payment can never produce two sets of tickets, even if the webhook fires twice.
6. **Offline-safe gate.** The scanner downloads the valid-ticket list. If the venue's internet drops, it keeps validating, remembers scans on that phone, and uploads them when back online (reporting conflicts).

> Nothing stops someone forwarding a screenshot. What the system guarantees is that **only the first person to scan gets in**, and that gate staff can see exactly when and where it was used.

---

## 3. Money and transparency

- The buyer pays **exactly the ticket price**. No fee is added at checkout.
- Paystack's fee comes out of the proceeds. The system stores Paystack's **real fee for every payment**.
- `Net = Gross − Paystack fee`. **Platform share = 10% of Net** (changeable in Admin > Settings, applies to future payments only; every past payment keeps the % it was made with). **Host share = the rest.**
- The **same Revenue & Payment Fees panel** appears on both dashboards, so the host and you always see identical numbers.
- The admin ledger lists every payment line by line with CSV export. Host payouts are recorded by you and visible to the host (earned, paid, still owed).
- Every change to prices, dates, refunds, payouts and platform % goes into an uneditable **activity log**.
- All money is stored in kobo (integers) to avoid rounding errors.

> **Important:** Paystack settles to *one* bank account (the one on the Paystack business account). This system **tracks** the 90/10 split and the payouts you record; it doesn't move money between people by itself. If you later want Paystack to split automatically, use Paystack *subaccounts/split payments* (a good phase 2).

### Suggested refund policy (already in the app, editable by the host)
All sales are final, **but tickets are free to transfer** to someone else until 2 hours before the event. Refunds only if the organisers cancel or reschedule the event. This protects the client's revenue while giving real people a fair way out. Admins can still refund an individual order from the ledger when needed.

---

## 4. Paystack setup

1. Create/ask for a Paystack business account. Copy the **secret key** into `PAYSTACK_SECRET_KEY`.
2. In Paystack > Settings > API Keys & Webhooks, set the **Webhook URL** to `https://YOUR-API-URL/api/paystack/webhook`.
3. Test with Paystack's test cards, then swap in the live key at launch.

Webhooks can't reach `localhost`, so during local development the app also **verifies the payment directly with Paystack when the buyer returns to the order page**. Tickets still appear. The admin overview has a "Check Paystack for missed payments" button as a safety net.

---

## 5. Deploy

**API on Render** (Web Service, root directory `server`, build `npm install`, start `npm start`; or use `render.yaml`). Set the env vars from `.env.example`, with `NODE_ENV=production` and `CLIENT_URL=https://your-site`. Use the **same `TICKET_SECRET` forever**.

**Website on Vercel** (root directory `client`, framework Vite). Add env var `VITE_API_URL=https://your-api.onrender.com` (no trailing slash, no `/api`). `vercel.json` already handles page refreshes.

Render's free tier sleeps when idle. Use a paid instance (or a keep-alive ping on `/api/health`) before ticket sales and on the event day.

---

## 6. Before you go live: checklist

- [ ] Paystack live key + webhook URL set; one real ₦100 test purchase, refunded afterwards
- [ ] Gmail App Password works (Admin > Overview > "Email" shows connected; send yourself a ticket)
- [ ] Logo files added; event details, tiers and capacities confirmed by the host
- [ ] Both default passwords changed; gate PIN changed and shared only with gate staff
- [ ] Rehearsal: buy 2 tickets for 2 names, scan one twice, transfer one, scan the old QR (must fail), try the scanner in airplane mode

## Notes
- Gmail's free sending limit is around 500 emails/day. If the client expects more, swap the SMTP settings for Brevo's or Resend's free tier. No code change, just the 4 `SMTP_*` variables.
- Run `npm test` for the unit tests on QR signing and the revenue split.
