import { connection } from 'next/server';
import { formatAgo, formatDateTime } from '@/lib/format';
import { sourceHealth } from '@/lib/queries';

export const metadata = { title: 'Źródła · Blacker' };

/** Adapter health: when each source last worked, so a shop changing its HTML shows up quickly. */
export default async function SourcesPage() {
  await connection();
  const sources = await sourceHealth();
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold">Źródła</h1>
        <p className="mt-1 text-sm text-ink-2">
          GitHub zbiera co godzinę (z ok. 25 min opóźnienia), Komputronik i x-kom zbiera domowy komputer, gdy jest włączony.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="tabular w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-ink-2">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-normal">Źródło</th>
              <th className="px-4 py-2 font-normal">Stan</th>
              <th className="px-4 py-2 font-normal">Ostatni udany</th>
              <th className="px-4 py-2 text-right font-normal">Ofert</th>
              <th className="px-4 py-2 text-right font-normal">Udane w 24 h</th>
              <th className="px-4 py-2 font-normal">Ostatni błąd</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const stale = !s.lastOk || now - s.lastOk.getTime() > 3 * 3_600_000;
              const state = !s.ok ? 'critical' : stale ? 'warning' : 'good';
              return (
                <tr key={s.sourceId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-medium">{s.sourceId}</td>
                  <td className="px-4 py-2">
                    <State state={state} />
                  </td>
                  <td className="px-4 py-2" title={s.lastOk ? formatDateTime(s.lastOk) : undefined}>
                    {s.lastOk ? formatAgo(s.lastOk, now) : 'nigdy'}
                  </td>
                  <td className="px-4 py-2 text-right">{s.ok ? s.offers : '–'}</td>
                  <td className="px-4 py-2 text-right">
                    {s.ok24h}/{s.runs24h}
                  </td>
                  <td className="max-w-80 truncate px-4 py-2 text-ink-2" title={s.error ?? undefined}>
                    {s.ok ? '' : s.error}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const STATES = {
  good: { label: 'Działa', icon: '✓', color: 'bg-good text-white' },
  warning: { label: 'Dawno bez danych', icon: '!', color: 'bg-warning text-black' },
  critical: { label: 'Błąd', icon: '×', color: 'bg-critical text-white' },
} as const;

function State({ state }: { state: keyof typeof STATES }) {
  const s = STATES[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span aria-hidden className={`grid size-4 place-items-center rounded-full text-[10px] font-bold ${s.color}`}>
        {s.icon}
      </span>
      {s.label}
    </span>
  );
}
