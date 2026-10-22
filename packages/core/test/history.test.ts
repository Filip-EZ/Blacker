import { describe, expect, it } from 'vitest';
import { computeHistory, shouldSnapshot } from '../src/history';

const now = new Date('2026-11-27T10:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('computeHistory', () => {
  it('excludes the current price run so a promo is not its own baseline', () => {
    const snaps = [
      { price: 899, fetchedAt: daysAgo(0.5) },
      { price: 899, fetchedAt: daysAgo(1) }, // promo started a day ago
      { price: 1199, fetchedAt: daysAgo(3) },
      { price: 1099, fetchedAt: daysAgo(10) },
    ];
    expect(computeHistory(snaps, 899, now)).toEqual({ minPrice30d: 1099, maxPrice14d: 1199, snapshots: 2 });
  });

  it('anchors the 30-day window at the start of the current run', () => {
    // Price dropped 20 days ago and stayed. A 1299 seen 35 days ago is within 30 days of the drop.
    const snaps = [
      { price: 999, fetchedAt: daysAgo(20) },
      { price: 1299, fetchedAt: daysAgo(35) },
      { price: 1499, fetchedAt: daysAgo(60) },
    ];
    expect(computeHistory(snaps, 999, now)).toMatchObject({ minPrice30d: 1299, snapshots: 1 });
  });

  it('a new lower price uses everything before it', () => {
    const snaps = [{ price: 899, fetchedAt: daysAgo(1) }, { price: 1099, fetchedAt: daysAgo(5) }];
    expect(computeHistory(snaps, 799, now)).toMatchObject({ minPrice30d: 899, snapshots: 2 });
  });

  it('no history or only the current price -> no baseline', () => {
    expect(computeHistory([], 100, now)).toEqual({ snapshots: 0 });
    expect(computeHistory([{ price: 100, fetchedAt: daysAgo(2) }], 100, now)).toEqual({ snapshots: 0 });
  });
});

describe('shouldSnapshot', () => {
  const last = { price: 100, inStock: true, fetchedAt: new Date(now.getTime() - 3_600_000) };
  it('writes on change or when the last snapshot is old', () => {
    expect(shouldSnapshot(undefined, { price: 100 }, now)).toBe(true);
    expect(shouldSnapshot(last, { price: 100, inStock: true }, now)).toBe(false);
    expect(shouldSnapshot(last, { price: 99, inStock: true }, now)).toBe(true);
    expect(shouldSnapshot(last, { price: 100, inStock: false }, now)).toBe(true);
    expect(shouldSnapshot({ ...last, fetchedAt: daysAgo(1) }, { price: 100, inStock: true }, now)).toBe(true);
  });
});
