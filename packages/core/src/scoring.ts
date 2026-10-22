import type { RawOffer } from './types';

/** What we already know about this product's price from earlier snapshots. */
export interface PriceHistory {
  /**
   * Lowest price we saw in the 30 days before the current price started.
   * Measured before the current price run, so a promo does not become its own baseline.
   */
  minPrice30d?: number;
  /** Highest price we saw in the 14 days before the current price started. */
  maxPrice14d?: number;
  /** Number of earlier snapshots; 0 means we have no baseline of our own yet. */
  snapshots: number;
}

export type Flag =
  | 'no-baseline' // only the shop's strikethrough price to compare against
  | 'raised-before-promo' // price went up shortly before the "discount"
  | 'possible-price-error' // discount so large it may be a pricing mistake (or a scam)
  | 'out-of-stock'
  | 'not-a-discount'; // price is at or above the reference

export interface Score {
  /** 0-100; candidates for AI review are at or above the configured threshold. */
  score: number;
  /** Discount vs a reference we trust (Omnibus or our own history), in percent. */
  realDiscountPct?: number;
  referencePrice?: number;
  flags: Flag[];
}

const RAISE_TOLERANCE = 1.1;

export function scoreOffer(offer: RawOffer, history: PriceHistory = { snapshots: 0 }): Score {
  const flags: Flag[] = [];

  // Trusted reference: the lower of the Omnibus 30-day low and our own 30-day low.
  // Taking the lower one is conservative: a low seen by either source caps the discount.
  const trusted = [offer.omnibusLow30d, history.minPrice30d].filter((p): p is number => p != null && p > 0);
  let reference = trusted.length ? Math.min(...trusted) : undefined;
  let weight = 1;

  if (reference == null && offer.regularPrice) {
    reference = offer.regularPrice;
    weight = 0.5;
    flags.push('no-baseline');
  }

  // Inflated "before" price: something in our last 14 days was clearly above the 30-day low,
  // and the shop's strikethrough price matches that inflated level.
  if (
    history.maxPrice14d != null &&
    history.minPrice30d != null &&
    history.maxPrice14d > history.minPrice30d * RAISE_TOLERANCE &&
    (offer.regularPrice == null || offer.regularPrice >= history.maxPrice14d * 0.95)
  ) {
    flags.push('raised-before-promo');
  }

  if (offer.inStock === false) flags.push('out-of-stock');

  let realDiscountPct: number | undefined;
  let discountScore = 0;
  if (reference != null) {
    realDiscountPct = round1(((reference - offer.price) / reference) * 100);
    if (realDiscountPct <= 0) flags.push('not-a-discount');
    if (realDiscountPct >= 80) flags.push('possible-price-error');
    // 0% -> 0, 50% or more -> 80 points (capped).
    discountScore = Math.max(0, Math.min(realDiscountPct, 50)) * 1.6 * weight;
    if (trusted.length >= 2) discountScore += 5; // Omnibus and our history agree there is a baseline
  }

  // Pepper temperature: 100° ~ 40 pts, 300° ~ 60, 700° ~ 75, 1500°+ ~ 90.
  const t = offer.temperature ?? 0;
  const tempScore = t > 0 ? Math.max(0, Math.min(90, 40 + 18.2 * Math.log(t / 100))) : 0;

  let score = Math.max(discountScore, tempScore) + Math.min(discountScore, tempScore) * 0.25;
  if (flags.includes('raised-before-promo')) score -= 25;
  if (flags.includes('possible-price-error')) score -= 10; // keep visible, let AI and the user judge
  if (flags.includes('out-of-stock')) score *= 0.3;

  return { score: Math.round(Math.max(0, Math.min(100, score))), realDiscountPct, referencePrice: reference, flags };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
