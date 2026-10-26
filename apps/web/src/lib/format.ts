const pln = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
const plnRound = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const rel = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });
const dateTime = new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const shortDate = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: 'numeric', month: 'numeric' });

/** "1 299 zł" for round prices, "36,05 zł" otherwise. */
export const formatPrice = (n: number) => (Number.isInteger(n) ? plnRound : pln).format(n);
export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatShortDate = (d: Date) => shortDate.format(d);
export const formatCount = (n: number) => n.toLocaleString('pl-PL');
export const formatPct = (n: number) => `${Math.round(n)}%`;

/** "5 minut temu", "wczoraj", "3 dni temu". */
export function formatAgo(d: Date, now = Date.now()) {
  const s = (d.getTime() - now) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return 'przed chwilą';
  if (abs < 3600) return rel.format(Math.round(s / 60), 'minute');
  if (abs < 86_400) return rel.format(Math.round(s / 3600), 'hour');
  return rel.format(Math.round(s / 86_400), 'day');
}

export const FLAG_LABELS: Record<string, string> = {
  'no-baseline': 'tylko cena przekreślona',
  'raised-before-promo': 'cenę podniesiono przed promocją',
  'possible-price-error': 'możliwy błąd cenowy',
  'out-of-stock': 'brak w magazynie',
  'not-a-discount': 'to nie jest obniżka',
};
