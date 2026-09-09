import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { getInitial } from '@/lib/format';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_SIZES = {
  sm: 'h-8 w-8 rounded-[9px] text-[13px]',
  md: 'h-[34px] w-[34px] rounded-ctl text-[14px]',
  lg: 'h-14 w-14 rounded-card text-[24px]',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'font-display flex shrink-0 items-center justify-center font-extrabold text-white',
        'bg-gradient-to-br from-[var(--app-accent)] to-[var(--app-accent-hover)]',
        AVATAR_SIZES[size],
        className
      )}
    >
      {getInitial(name)}
    </span>
  );
}

export function Pill({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'blood';
}) {
  return <span className={cn('pill', tone === 'blood' ? 'pill-blood' : 'pill-accent')}>{children}</span>;
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-ink text-[14px] font-semibold">{title}</p>
      {hint ? <p className="text-muted max-w-[46ch] text-[12.5px]">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'border-line border-t-accent inline-block h-4 w-4 animate-spin rounded-full border-2',
        className
      )}
    />
  );
}

export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="text-muted flex items-center justify-center gap-2.5 px-6 py-12 text-[13px]">
      <Spinner />
      {label}
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
  className?: string;
}

/** macOS segmented control, used for the report period and appearance switches. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('bg-field rounded-ctl border-line flex gap-0.5 border p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[7px] px-2.5 py-1 text-[12px] font-semibold transition-colors duration-150',
              active ? 'bg-elevated text-ink shadow-mac' : 'text-muted hover:text-ink'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
