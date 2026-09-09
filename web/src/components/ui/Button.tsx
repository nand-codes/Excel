import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

// Apple's buttons are flat, fully rounded and change only in brightness on press —
// no lift, no travel, no border on the filled ones.
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:brightness-95 disabled:hover:bg-accent',
  secondary: 'bg-elevated text-ink border border-line hover:bg-hover active:brightness-97',
  ghost: 'text-ink-soft hover:bg-hover hover:text-ink',
  danger: 'bg-sys-red text-white hover:brightness-110 active:brightness-95',
};

const SIZES: Record<Size, string> = {
  sm: 'h-[30px] px-3 text-[12.5px] gap-1.5',
  md: 'h-9 px-4 text-[13px] gap-1.5',
};

/** Shared styling so router links can look exactly like buttons. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap',
    'transition-[background-color,filter,opacity] duration-150 ease-[var(--ease-mac)]',
    'disabled:cursor-not-allowed disabled:opacity-40',
    VARIANTS[variant],
    SIZES[size],
    extra
  );
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'neutral' | 'accent' | 'danger';
}

const TONES: Record<NonNullable<IconButtonProps['tone']>, string> = {
  neutral: 'text-ink-soft hover:bg-hover hover:text-ink',
  accent: 'text-accent hover:bg-accent-light',
  danger: 'text-sys-red hover:bg-sys-red/12',
};

export function IconButton({ label, tone = 'neutral', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
