/** Filter options and URL parsing; no database imports, so client components can use it. */

export const VIEWS = { active: 'Aktywne', starred: 'Z gwiazdką', hidden: 'Ukryte' } as const;
export const SORTS = { score: 'Wynik', discount: 'Rabat', new: 'Najnowsze', price: 'Cena' } as const;
export const PERIODS = { all: 'Cały czas', '24h': 'Ostatnie 24 h', live: 'LIVE (2 h)' } as const;
export const VERDICTS = { all: 'Wszystkie', super: 'Tylko „super”', good: '„Super” i „ok”', clean: 'Bez podejrzanych' } as const;
export const TIERS = { all: 'Wszystkie', big: 'Duże sklepy', aggregator: 'Pepper', small: 'Małe sklepy' } as const;
export const MIN_DISCOUNTS = [0, 10, 20, 30, 50] as const;

export interface DealFilters {
  view: keyof typeof VIEWS;
  category?: string;
  shop?: string;
  tier: keyof typeof TIERS;
  minDiscount: number;
  verdict: keyof typeof VERDICTS;
  period: keyof typeof PERIODS;
  sort: keyof typeof SORTS;
}

type Params = Record<string, string | string[] | undefined>;

function pick<T extends object>(options: T, value: string | undefined, fallback: keyof T): keyof T {
  return value && value in options ? (value as keyof T) : fallback;
}

/** Reads filters from the URL; anything unknown falls back to the default, so old links never break. */
export function parseFilters(params: Params): DealFilters {
  const one = (k: string) => [params[k]].flat()[0] || undefined;
  const min = Number(one('min'));
  return {
    view: pick(VIEWS, one('widok'), 'active'),
    category: one('kategoria'),
    shop: one('sklep'),
    tier: pick(TIERS, one('typ'), 'all'),
    minDiscount: Number.isFinite(min) && min > 0 ? min : 0,
    verdict: pick(VERDICTS, one('werdykt'), 'all'),
    period: pick(PERIODS, one('okres'), 'all'),
    sort: pick(SORTS, one('sort'), 'score'),
  };
}

/** Defaults are left out of the URL, so the plain address means the default view. */
export const DEFAULTS: Record<string, string> = { widok: 'active', typ: 'all', min: '0', werdykt: 'all', okres: 'all', sort: 'score', kategoria: '', sklep: '' };
