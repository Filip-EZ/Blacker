import { describe, expect, it } from 'vitest';
import { scoreOffer } from '../src/scoring';
import type { RawOffer } from '../src/types';

const base: RawOffer = { url: 'https://shop.pl/p/1', shopName: 'Shop', shopDomain: 'shop.pl', title: 'Słuchawki', price: 100, currency: 'PLN' };

describe('scoreOffer', () => {
  it('real discount vs Omnibus scores high', () => {
    const s = scoreOffer({ ...base, price: 89, regularPrice: 169, omnibusLow30d: 169 });
    expect(s.realDiscountPct).toBe(47.3);
    expect(s.score).toBeGreaterThanOrEqual(70);
    expect(s.flags).toEqual([]);
  });

  it('uses the lower of Omnibus and our history, so a fake strikethrough price does not count', () => {
    // Shop claims 1000 -> 700, Omnibus says 900, but we saw 720 last week.
    const s = scoreOffer({ ...base, price: 700, regularPrice: 1000, omnibusLow30d: 900 }, { minPrice30d: 720, maxPrice14d: 1000, snapshots: 40 });
    expect(s.referencePrice).toBe(720);
    expect(s.realDiscountPct).toBe(2.8);
    expect(s.flags).toContain('raised-before-promo');
    expect(s.score).toBeLessThan(20);
  });

  it('no baseline: strikethrough price counts only at half weight', () => {
    const withBaseline = scoreOffer({ ...base, price: 50, omnibusLow30d: 100 });
    const without = scoreOffer({ ...base, price: 50, regularPrice: 100 });
    expect(without.flags).toContain('no-baseline');
    expect(without.score).toBeLessThan(withBaseline.score);
  });

  it('flags a possible price error but keeps it visible', () => {
    const s = scoreOffer({ ...base, price: 99, omnibusLow30d: 4999 });
    expect(s.flags).toContain('possible-price-error');
    expect(s.score).toBeGreaterThan(50);
  });

  it('out of stock is pushed down', () => {
    const inStock = scoreOffer({ ...base, price: 60, omnibusLow30d: 100, inStock: true });
    const gone = scoreOffer({ ...base, price: 60, omnibusLow30d: 100, inStock: false });
    expect(gone.score).toBeLessThan(inStock.score * 0.5);
  });

  it('price above the reference is not a discount', () => {
    const s = scoreOffer({ ...base, price: 120, omnibusLow30d: 100 });
    expect(s.flags).toContain('not-a-discount');
    expect(s.score).toBe(0);
  });

  it('Pepper temperature drives score when there is no price data', () => {
    expect(scoreOffer({ ...base, temperature: 100 }).score).toBe(40);
    expect(scoreOffer({ ...base, temperature: 300 }).score).toBe(60);
    expect(scoreOffer({ ...base, temperature: 1500 }).score).toBe(89);
    expect(scoreOffer({ ...base, temperature: -20 }).score).toBe(0);
  });
});
