import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

/**
 * The large in-content title Apple's apps use instead of a small toolbar label.
 * Each page owns exactly one of these, so the toolbar carries only controls.
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-ink text-[32px] leading-[1.08] font-bold sm:text-[38px]">{title}</h1>
        {subtitle ? <p className="text-muted mt-2 text-[14px]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
