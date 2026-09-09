import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts and brightens on hover; for tiles that summarise something. */
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-card shadow-mac',
        interactive &&
          'hover:bg-card-hover hover:border-line-strong transition-[background-color,border-color,transform,box-shadow] duration-300 ease-[var(--ease-mac)] hover:-translate-y-0.5 hover:shadow-mac-lg',
        className
      )}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, icon, badge, actions, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-muted shrink-0">{icon}</span> : null}
        <h3 className="text-ink truncate text-[14.5px] font-semibold">{title}</h3>
        {badge ? (
          <span className="text-muted shrink-0 text-[12.5px]" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-1 pb-5', className)} {...props} />;
}
