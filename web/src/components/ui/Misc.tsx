import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { getInitial } from '@/lib/format';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const AVATAR_SIZES = {
  sm: 'h-7 w-7 text-[12px]',
  md: 'h-8 w-8 text-[13px]',
  lg: 'h-13 w-13 text-[22px]',
};

/** Circular and flat, like Contacts — the gradient rounded square read as a web app. */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-accent-light text-accent flex shrink-0 items-center justify-center rounded-full font-semibold',
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
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-ink text-[15px] font-semibold">{title}</p>
      {hint ? <p className="text-muted max-w-[46ch] text-[13px] leading-relaxed">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
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
      className={cn('bg-hover rounded-[9px] flex gap-0.5 p-0.5', className)}
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
              'rounded-[7px] px-3 py-1 text-[12.5px] font-medium transition-colors duration-150',
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
