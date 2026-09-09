import { cn } from '@/lib/cn';

/** Five-colour cycle, matching the original chart palette. */
const BAR_COLORS = [
  'var(--app-accent)',
  'var(--app-teal)',
  'var(--app-purple)',
  'var(--app-green)',
  'var(--app-hero-mid)',
];

export interface BarDatum {
  label: string;
  count: number;
}

/** Sorted horizontal bars, widths relative to the largest value. */
export function BarList({ data }: { data: BarDatum[] }) {
  if (!data.length) return <p className="text-muted py-6 text-[13px]">No data yet.</p>;

  const max = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((entry, index) => (
        <div key={entry.label} className="flex items-center gap-3">
          <span
            className="text-ink-soft w-[104px] shrink-0 truncate text-right text-[12px] font-semibold"
            title={entry.label}
          >
            {entry.label}
          </span>
          <div className="bg-field h-[9px] min-w-0 flex-1 overflow-hidden rounded-full">
            <div
              className="h-full origin-left rounded-full"
              style={{
                width: `${Math.max(2, Math.round((entry.count / max) * 100))}%`,
                background: BAR_COLORS[index % BAR_COLORS.length],
                animation: 'growBar 420ms var(--ease-mac)',
              }}
            />
          </div>
          <span className="text-ink w-8 shrink-0 text-[12.5px] font-bold tabular-nums">
            {entry.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export interface MonthDatum {
  label: string;
  count: number;
}

/** Vertical bars for the last six months. */
export function MonthlyBars({ data }: { data: MonthDatum[] }) {
  if (!data.length) return <p className="text-muted py-6 text-[13px]">No data yet.</p>;

  const max = Math.max(...data.map((entry) => entry.count), 1);

  return (
    <div className="flex items-end justify-between gap-2 pt-2">
      {data.map((entry) => (
        <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-ink text-[12px] font-bold tabular-nums">{entry.count}</span>
          <div className="flex h-[124px] w-full items-end justify-center">
            <div
              className={cn('w-full max-w-[38px] rounded-t-[6px]')}
              style={{
                height: `${Math.max(4, Math.round((entry.count / max) * 118))}px`,
                background: 'linear-gradient(180deg, var(--app-accent), var(--app-hero-mid))',
              }}
            />
          </div>
          <span className="text-muted text-[11.5px] font-semibold">{entry.label}</span>
        </div>
      ))}
    </div>
  );
}
