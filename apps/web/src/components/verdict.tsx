const VERDICTS = {
  super: { label: 'Super', icon: '✓', color: 'bg-good text-white' },
  ok: { label: 'OK', icon: '•', color: 'bg-accent text-white' },
  słabe: { label: 'Słabe', icon: '–', color: 'bg-axis text-black' },
  podejrzane: { label: 'Podejrzane', icon: '!', color: 'bg-critical text-white' },
} as const;

/** AI verdict as icon + label; status color is never the only signal. */
export function Verdict({ verdict }: { verdict: string | null }) {
  if (!verdict || !(verdict in VERDICTS)) {
    return <span className="text-xs text-muted">bez oceny AI</span>;
  }
  const v = VERDICTS[verdict as keyof typeof VERDICTS];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs font-medium text-ink">
      <span aria-hidden className={`grid size-4 place-items-center rounded-full text-[10px] font-bold ${v.color}`}>
        {v.icon}
      </span>
      {v.label}
    </span>
  );
}
