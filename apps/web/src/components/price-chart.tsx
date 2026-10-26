'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateTime, formatPrice, formatShortDate } from '@/lib/format';

export interface PricePoint {
  t: number;
  price: number;
  omnibus: number | null;
  inStock: boolean | null;
}

interface Props {
  points: PricePoint[];
  /** Trusted reference (30-day low), drawn as a labelled horizontal line. */
  reference: number | null;
  now: number;
}

const HEIGHT = 260;
const M = { top: 20, right: 16, bottom: 28, left: 64 };

/** Round tick step: 1, 2, 2.5 or 5 times a power of ten. */
function niceTicks(lo: number, hi: number, count = 4) {
  const raw = (hi - lo) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

/**
 * Price history as a step line: a price holds until the next snapshot, then extends to "now".
 * Single series, so no legend; the reference line carries its own label.
 */
export function PriceChart({ points, reference, now }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const t0 = points[0].t;
    const t1 = Math.max(now, points[points.length - 1].t);
    const span = t1 - t0 || 86_400_000;
    const values = [...points.map((p) => p.price), ...(reference != null ? [reference] : [])];
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const pad = (hi - lo || hi * 0.2 || 1) * 0.12;
    lo = Math.max(0, lo - pad);
    hi += pad;
    const ticks = niceTicks(lo, hi);
    lo = Math.min(lo, ticks[0]);
    hi = Math.max(hi, ticks[ticks.length - 1]);

    const iw = width - M.left - M.right;
    const ih = HEIGHT - M.top - M.bottom;
    const x = (t: number) => M.left + ((t - t0) / span) * iw;
    const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * ih;

    let d = `M${x(points[0].t)},${y(points[0].price)}`;
    for (let i = 1; i < points.length; i++) d += `H${x(points[i].t)}V${y(points[i].price)}`;
    d += `H${x(t1)}`;

    const tickCount = Math.min(5, Math.max(2, Math.floor(iw / 120)));
    const xTicks = Array.from({ length: tickCount }, (_, i) => t0 + (span * i) / (tickCount - 1));
    return { x, y, d, ticks, xTicks, t1, iw, ih };
  }, [points, reference, now, width]);

  const last = points[points.length - 1];
  const hovered = active != null ? points[active] : null;

  function nearest(clientX: number) {
    const rect = wrap.current!.getBoundingClientRect();
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.x(points[i].t) - px) < Math.abs(geo.x(points[best].t) - px)) best = i;
    return best;
  }

  return (
    <div ref={wrap} className="relative select-none">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Historia ceny: ${points.length} pomiarów, teraz ${formatPrice(last.price)}${reference != null ? `, cena odniesienia ${formatPrice(reference)}` : ''}. Strzałki w lewo i w prawo przechodzą między pomiarami.`}
        tabIndex={0}
        onPointerMove={(e) => setActive(nearest(e.clientX))}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          const step = e.key === 'ArrowLeft' ? -1 : 1;
          setActive((a) => Math.min(points.length - 1, Math.max(0, (a ?? points.length - 1) + (a == null ? 0 : step))));
        }}
        className="block touch-none outline-none"
      >
        {geo.ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--grid)" strokeWidth={1} />
            <text x={M.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
              {formatPrice(v)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={width - M.right} y1={M.top + geo.ih} y2={M.top + geo.ih} stroke="var(--axis)" strokeWidth={1} />
        {geo.xTicks.map((t, i) => (
          <text
            key={t}
            x={geo.x(t)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill="var(--muted)"
            className="tabular"
          >
            {formatShortDate(new Date(t))}
          </text>
        ))}

        {reference != null && (
          <g>
            <line x1={M.left} x2={width - M.right} y1={geo.y(reference)} y2={geo.y(reference)} stroke="var(--ink-2)" strokeWidth={1} />
            <text x={M.left + 6} y={geo.y(reference) - 6} fontSize={11} fill="var(--ink-2)">
              najniższa z 30 dni · {formatPrice(reference)}
            </text>
          </g>
        )}

        <path d={geo.d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={geo.x(geo.t1)} cy={geo.y(last.price)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        {hovered == null && (
          <text x={geo.x(geo.t1) - 8} y={geo.y(last.price) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--ink)">
            {formatPrice(last.price)}
          </text>
        )}

        {hovered && (
          <g pointerEvents="none">
            <line x1={geo.x(hovered.t)} x2={geo.x(hovered.t)} y1={M.top} y2={M.top + geo.ih} stroke="var(--axis)" strokeWidth={1} />
            <circle cx={geo.x(hovered.t)} cy={geo.y(hovered.price)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-raised px-3 py-2 text-xs shadow-sm"
          style={geo.x(hovered.t) > width / 2 ? { right: width - geo.x(hovered.t) + 12 } : { left: geo.x(hovered.t) + 12 }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-accent" />
            <span className="text-sm font-semibold text-ink">{formatPrice(hovered.price)}</span>
          </div>
          <div className="mt-0.5 text-ink-2">{formatDateTime(new Date(hovered.t))}</div>
          {hovered.omnibus != null && <div className="text-ink-2">Omnibus (30 dni): {formatPrice(hovered.omnibus)}</div>}
          {hovered.inStock === false && <div className="text-ink-2">brak w magazynie</div>}
        </div>
      )}
    </div>
  );
}
