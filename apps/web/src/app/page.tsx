import { connection } from 'next/server';
import { AutoRefresh } from '@/components/auto-refresh';
import { DealCard } from '@/components/deal-card';
import { Filters } from '@/components/filters';
import { parseFilters } from '@/lib/filters';
import { formatAgo, formatCount } from '@/lib/format';
import { filterOptions, listDeals, summary } from '@/lib/queries';

const LIMIT = 120;

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const filters = parseFilters(await searchParams);
  const [deals, stats, options] = await Promise.all([listDeals(filters, LIMIT), summary(), filterOptions()]);
  const live = filters.period === 'live';

  return (
    <div className="space-y-6">
      {live && <AutoRefresh seconds={60} />}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Podsumowanie">
        <Tile label="Aktywne okazje" value={formatCount(stats.active)} />
        <Tile label="„Super” według AI" value={formatCount(stats.superCount)} />
        <Tile label="Nowe w 24 h" value={formatCount(stats.newToday)} />
        <Tile
          label="Ostatnie dane"
          value={stats.lastRun ? formatAgo(stats.lastRun) : 'brak'}
          hint={stats.lastRun && Date.now() - stats.lastRun.getTime() > 3 * 3_600_000 ? 'Ponad 3 h bez nowych danych, sprawdź Źródła.' : undefined}
        />
      </section>

      <Filters filters={filters} categories={options.categories} shops={options.shops} />

      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold">
          {live ? 'Black Week LIVE: ostatnie 2 h' : 'Okazje'}
          <span className="ml-2 text-sm font-normal text-ink-2">
            {deals.length === LIMIT ? `pierwsze ${LIMIT}` : formatCount(deals.length)}
          </span>
        </h1>
        {live && <span className="text-xs text-muted">odświeża się co minutę</span>}
      </div>

      {deals.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((d) => (
            <DealCard key={d.id} deal={d} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-ink-2">
          Nic nie pasuje do tych filtrów. Spróbuj poluzować rabat albo okres.
        </p>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-ink-2">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && (
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-2">
          <span aria-hidden className="grid size-3.5 place-items-center rounded-full bg-warning text-[9px] font-bold text-black">
            !
          </span>
          {hint}
        </p>
      )}
    </div>
  );
}
