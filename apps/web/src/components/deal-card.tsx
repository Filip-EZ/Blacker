import Link from 'next/link';
import { FLAG_LABELS, formatAgo, formatPct, formatPrice } from '@/lib/format';
import type { DealRow } from '@/lib/queries';
import { StatusButtons } from './status-buttons';
import { Verdict } from './verdict';

export function DealCard({ deal }: { deal: DealRow }) {
  const discount = deal.realDiscountPct;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <Link href={`/deal/${deal.id}`} className="flex gap-3 p-3 hover:bg-wash">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-wash">
          {deal.image ? (
            // Shop CDNs vary per shop; a plain img avoids configuring every host for next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={deal.image} alt="" loading="lazy" className="max-h-full max-w-full bg-white object-contain" />
          ) : (
            <span className="text-xs text-muted">brak zdjęcia</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-2">
            {deal.shop}
            {deal.tier === 'aggregator' && deal.temperature != null && <> · {deal.temperature}° na Pepper</>}
          </p>
          <h2 className="mt-0.5 line-clamp-2 text-sm leading-5 font-medium">{deal.title}</h2>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-lg font-semibold">{formatPrice(deal.price)}</span>
            {discount != null && discount > 0 && <span className="text-sm font-semibold text-good-text">−{formatPct(discount)}</span>}
            {deal.referencePrice != null && (
              <span className="text-xs text-ink-2" title="Cena odniesienia: najniższa z 30 dni (Omnibus albo nasza historia)">
                z {formatPrice(deal.referencePrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 border-t border-line px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Verdict verdict={deal.aiVerdict} />
          {deal.aiCategory && <span className="text-xs text-ink-2">{deal.aiCategory}</span>}
          <span className="ml-auto text-xs text-muted" title="Wynik reguł 0–100">
            wynik {deal.score}
          </span>
        </div>
        {deal.aiSummary && <p className="text-xs leading-5 text-ink-2">{deal.aiSummary}</p>}
        {deal.flags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {deal.flags.map((f) => (
              <li key={f} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-2">
                ⚠ {FLAG_LABELS[f] ?? f}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-end gap-1 pt-1">
          <span className="mr-auto text-xs text-muted">wykryto {formatAgo(deal.detectedAt)}</span>
          <a href={deal.url} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-accent hover:bg-accent-wash">
            Do sklepu ↗
          </a>
          <StatusButtons id={deal.id} status={deal.status} />
        </div>
      </div>
    </article>
  );
}
