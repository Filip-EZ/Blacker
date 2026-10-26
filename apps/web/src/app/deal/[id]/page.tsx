import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { PriceChart } from '@/components/price-chart';
import { StatusButtons } from '@/components/status-buttons';
import { Verdict } from '@/components/verdict';
import { FLAG_LABELS, formatAgo, formatDateTime, formatPct, formatPrice } from '@/lib/format';
import { getDeal } from '@/lib/queries';

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await getDeal(id) : undefined;
  if (!data) notFound();
  const { deal, product, shop, history } = data;
  const now = Date.now();
  const points = history.map((h) => ({ t: h.fetchedAt.getTime(), price: h.price, omnibus: h.omnibusLow30d, inStock: h.inStock }));

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-ink-2 hover:text-ink">
        ← Wszystkie okazje
      </Link>

      <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:p-6">
        <div className="grid size-40 shrink-0 place-items-center self-center overflow-hidden rounded-lg bg-wash sm:self-start">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="max-h-full max-w-full bg-white object-contain" />
          ) : (
            <span className="text-xs text-muted">brak zdjęcia</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-ink-2">
            {shop}
            {product.category && <> · {product.category}</>}
          </p>
          <h1 className="text-xl leading-7 font-semibold">{product.title}</h1>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-semibold">{formatPrice(deal.price)}</span>
            {deal.realDiscountPct != null && deal.realDiscountPct > 0 && (
              <span className="text-lg font-semibold text-good-text">−{formatPct(deal.realDiscountPct)} realnie</span>
            )}
            {deal.referencePrice != null && <span className="text-sm text-ink-2">od ceny odniesienia {formatPrice(deal.referencePrice)}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Verdict verdict={deal.aiVerdict} />
            {deal.aiCategory && <span className="text-sm text-ink-2">{deal.aiCategory}</span>}
            <span className="text-sm text-muted">wynik {deal.score}/100</span>
            {deal.temperature != null && <span className="text-sm text-muted">{deal.temperature}° na Pepper</span>}
          </div>
          {deal.aiSummary && <p className="text-sm leading-6">{deal.aiSummary}</p>}
          {deal.aiReason && <p className="text-sm leading-6 text-ink-2">{deal.aiReason}</p>}
          {deal.flags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {deal.flags.map((f) => (
                <li key={f} className="rounded border border-line px-2 py-0.5 text-xs text-ink-2">
                  ⚠ {FLAG_LABELS[f] ?? f}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Otwórz w sklepie ↗
            </a>
            <StatusButtons id={deal.id} status={deal.status} />
            <span className="text-xs text-muted">wykryto {formatAgo(deal.detectedAt)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="text-base font-semibold">Historia ceny</h2>
        <p className="mt-1 text-sm text-ink-2">
          Od {formatDateTime(new Date(points[0]?.t ?? now))}, {history.length} {history.length === 1 ? 'pomiar' : 'pomiarów'}. Cena trwa do kolejnej zmiany.
        </p>
        <div className="mt-4">
          {points.length >= 2 ? (
            <PriceChart points={points} reference={deal.referencePrice} now={now} />
          ) : (
            <p className="rounded-lg bg-wash p-4 text-sm text-ink-2">
              Mamy dopiero jeden pomiar, więc wykres pojawi się po następnej zmianie ceny.
            </p>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-ink-2 hover:text-ink">Tabela pomiarów</summary>
          <table className="tabular mt-3 w-full text-left text-sm">
            <thead className="text-xs text-ink-2">
              <tr className="border-b border-line">
                <th className="py-2 font-normal">Kiedy</th>
                <th className="py-2 text-right font-normal">Cena</th>
                <th className="py-2 text-right font-normal">Przekreślona</th>
                <th className="py-2 text-right font-normal">Omnibus 30 dni</th>
                <th className="py-2 text-right font-normal">Dostępność</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((h) => (
                <tr key={h.fetchedAt.toISOString()} className="border-b border-line last:border-0">
                  <td className="py-1.5">{formatDateTime(h.fetchedAt)}</td>
                  <td className="py-1.5 text-right">{formatPrice(h.price)}</td>
                  <td className="py-1.5 text-right text-ink-2">{h.regularPrice != null ? formatPrice(h.regularPrice) : '–'}</td>
                  <td className="py-1.5 text-right text-ink-2">{h.omnibusLow30d != null ? formatPrice(h.omnibusLow30d) : '–'}</td>
                  <td className="py-1.5 text-right text-ink-2">{h.inStock == null ? '–' : h.inStock ? 'jest' : 'brak'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
