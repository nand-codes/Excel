import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-card border-line rounded-card shadow-mac border', className)}
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
        'border-divider flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-muted shrink-0">{icon}</span> : null}
        <h3 className="font-display text-ink truncate text-[15px] font-bold">{title}</h3>
        {badge ? (
          <span className="pill pill-accent shrink-0" aria-hidden="true">
            {badge}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}
