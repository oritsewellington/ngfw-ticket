/**
 * Early-bird pricing. A tier has a normal `price` and an optional early-bird window
 * (`earlyPrice` between `earlyStartsAt` and `earlyEndsAt`). Everything that charges or
 * displays a price goes through here, so the website, checkout, cash sales and emails always agree.
 * All money is in kobo.
 */
export function earlyBirdState(tier, now = new Date()) {
  const price = tier.earlyPrice;
  const start = tier.earlyStartsAt ? new Date(tier.earlyStartsAt) : null;
  const end = tier.earlyEndsAt ? new Date(tier.earlyEndsAt) : null;
  if (!price || price <= 0 || !start || !end) return "none";
  if (now < start) return "upcoming";
  if (now >= end) return "ended";
  return "active";
}

/** The price a buyer pays RIGHT NOW for this tier. */
export function currentPrice(tier, now = new Date()) {
  return earlyBirdState(tier, now) === "active" ? tier.earlyPrice : tier.price;
}

/** Fields the website needs to show the offer. `price` is always what the buyer will be charged now. */
export function priceView(tier, now = new Date()) {
  const state = earlyBirdState(tier, now);
  const active = state === "active";
  return {
    price: active ? tier.earlyPrice : tier.price,
    regularPrice: tier.price,
    earlyBird: active
      ? { endsAt: tier.earlyEndsAt, savings: tier.price - tier.earlyPrice }
      : null,
    earlyBirdUpcoming:
      state === "upcoming"
        ? {
            price: tier.earlyPrice,
            startsAt: tier.earlyStartsAt,
            endsAt: tier.earlyEndsAt,
          }
        : null,
  };
}
