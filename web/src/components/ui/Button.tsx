import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-mac hover:bg-accent-hover active:scale-[0.98] disabled:hover:bg-accent',
  secondary:
    'bg-elevated text-ink border border-line shadow-mac hover:bg-hover active:scale-[0.98]',
  ghost: 'text-ink-soft hover:bg-hover hover:text-ink',
  danger: 'bg-sys-red text-white shadow-mac hover:brightness-110 active:scale-[0.98]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5',
  md: 'h-10 px-4 text-[13.5px] gap-2',
};

/** Shared styling so router links can look exactly like buttons. */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cn(
    'rounded-ctl inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap',
    'transition-[background-color,transform,filter,opacity] duration-150 ease-[var(--ease-mac)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
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
        'rounded-ctl inline-flex h-8 w-8 items-center justify-center transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
