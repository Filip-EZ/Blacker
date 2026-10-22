import type { PriceHistory } from './scoring';

const DAY = 86_400_000;

export interface SnapshotPoint {
  price: number;
  fetchedAt: Date;
}

/**
 * Builds the baseline from earlier snapshots, skipping the current price run:
 * if the price has been 89 for the last 3 runs, those 3 snapshots are not part of the baseline,
 * otherwise a promo would become its own reference after one run.
 */
export function computeHistory(snapshots: SnapshotPoint[], currentPrice: number, now = new Date()): PriceHistory {
  const sorted = [...snapshots].sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime());
  const runEnd = sorted.findIndex((s) => s.price !== currentPrice);
  if (runEnd < 0) return { snapshots: 0 };

  // Baseline window is anchored at the start of the current price run, not at "now".
  const runStart = runEnd === 0 ? now : sorted[runEnd - 1].fetchedAt;
  const prior = sorted.slice(runEnd).filter((s) => runStart.getTime() - s.fetchedAt.getTime() <= 30 * DAY);
  if (!prior.length) return { snapshots: 0 };

  const recent = prior.filter((s) => runStart.getTime() - s.fetchedAt.getTime() <= 14 * DAY);
  return {
    minPrice30d: Math.min(...prior.map((s) => s.price)),
    maxPrice14d: recent.length ? Math.max(...recent.map((s) => s.price)) : undefined,
    snapshots: prior.length,
  };
}

/** A snapshot is only written when something changed or the last one is old, to keep the DB small. */
export function shouldSnapshot(
  last: { price: number; inStock: boolean | null; fetchedAt: Date } | undefined,
  offer: { price: number; inStock?: boolean },
  now = new Date(),
  maxAgeMs = 12 * 3_600_000,
): boolean {
  if (!last) return true;
  return last.price !== offer.price || (last.inStock ?? undefined) !== offer.inStock || now.getTime() - last.fetchedAt.getTime() >= maxAgeMs;
}
