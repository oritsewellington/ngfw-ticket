// All money in this system is stored in KOBO (integers) to avoid rounding bugs. ₦1 = 100 kobo.

/**
 * Paystack's standard Nigerian local-card fee: 1.5% (+ ₦100 flat only when the amount is ₦2,500 or more),
 * capped at ₦2,000. We prefer the REAL fee Paystack reports for each transaction; this is only a fallback.
 */
export function estimatePaystackFee(amountKobo) {
  const flat = amountKobo >= 250000 ? 10000 : 0;
  const fee = Math.round(amountKobo * 0.015) + flat;
  return Math.min(fee, 200000);
}

/** Net = what the customer paid minus Paystack's fee. Platform gets a % of NET, host gets the rest. */
export function splitRevenue(grossKobo, feeKobo, platformPercent) {
  const net = Math.max(0, grossKobo - feeKobo);
  const platform = Math.round((net * platformPercent) / 100);
  const host = net - platform;
  return { gross: grossKobo, fee: feeKobo, net, platform, host };
}

export const toKobo = (naira) => Math.round(Number(naira) * 100);
