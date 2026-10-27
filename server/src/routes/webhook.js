import { Event } from '../models/index.js';
import { verifyPaystackSignature } from '../lib/crypto.js';
import { finalizePaidOrder } from '../lib/issue.js';

/**
 * Paystack calls this after every payment. It is mounted with express.raw() so we can verify the signature
 * against the EXACT bytes Paystack sent. We never trust the browser redirect alone.
 */
export async function paystackWebhook(req, res) {
  const signature = req.headers['x-paystack-signature'];
  if (!Buffer.isBuffer(req.body) || !verifyPaystackSignature(req.body, signature)) {
    return res.status(401).json({ message: 'Invalid signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Unreadable payload.' });
  }

  try {
    await Event.updateOne({}, { $set: { lastWebhookAt: new Date() } });
    if (payload.event === 'charge.success' && payload.data?.reference) {
      await finalizePaidOrder(payload.data.reference, payload.data);
    }
    return res.sendStatus(200);
  } catch (err) {
    console.error('[webhook] processing failed', err);
    return res.sendStatus(500); // Paystack will retry
  }
}
