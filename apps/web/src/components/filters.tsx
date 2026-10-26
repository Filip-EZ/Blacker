'use client';

import { useRouter } from 'next/navigation';
import { DEFAULTS, MIN_DISCOUNTS, PERIODS, SORTS, TIERS, VERDICTS, VIEWS, type DealFilters } from '@/lib/filters';

interface Props {
  filters: DealFilters;
  categories: { name: string; n: number }[];
  shops: { name: string; n: number }[];
}

/** URL for the current form state, leaving defaults out so the plain address means the default view. */
function toUrl(form: HTMLFormElement) {
  const params = new URLSearchParams();
  for (const [k, v] of new FormData(form)) if (typeof v === 'string' && v !== DEFAULTS[k]) params.set(k, v);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/** One row of filters above the list. The URL is the state, so a filtered view can be bookmarked. */
export function Filters({ filters, categories, shops }: Props) {
  const router = useRouter();
  const all = (label: string, list: { name: string; n: number }[]) =>
    Object.fromEntries([['', label], ...list.map((x) => [x.name, `${x.name} (${x.n})`])]);

  return (
    <form
      method="get"
      action="/"
      onChange={(e) => router.push(toUrl(e.currentTarget), { scroll: false })}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(toUrl(e.currentTarget), { scroll: false });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <Select name="okres" label="Okres" value={filters.period} options={PERIODS} />
      <Select name="kategoria" label="Kategoria (AI)" value={filters.category ?? ''} options={all('Wszystkie', categories)} />
      <Select name="sklep" label="Sklep" value={filters.shop ?? ''} options={all('Wszystkie', shops)} />
      <Select name="typ" label="Typ sklepu" value={filters.tier} options={TIERS} />
      <Select
        name="min"
        label="Rabat min."
        value={String(filters.minDiscount)}
        options={Object.fromEntries(MIN_DISCOUNTS.map((d) => [String(d), d ? `${d}%` : 'Dowolny']))}
      />
      <Select name="werdykt" label="Ocena AI" value={filters.verdict} options={VERDICTS} />
      <Select name="widok" label="Widok" value={filters.view} options={VIEWS} />
      <Select name="sort" label="Sortuj" value={filters.sort} options={SORTS} />
      <noscript>
        <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm">
          Pokaż
        </button>
      </noscript>
      <a href="/" className="pb-2 text-sm text-ink-2 hover:text-ink">
        Wyczyść
      </a>
    </form>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Record<string, string> }) {
  const changed = value !== DEFAULTS[name];
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-2">
      {label}
      <select
        name={name}
        defaultValue={value}
        key={value}
        className={`h-9 max-w-52 rounded-md border bg-raised px-2 text-sm text-ink ${changed ? 'border-accent' : 'border-line'}`}
      >
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}
