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
    <div className="border-line flex flex-wrap items-end justify-between gap-4 border-b pt-2 pb-7">
      <div className="min-w-0">
        <h1 className="text-ink text-[32px] leading-[1.15] font-semibold break-words">{title}</h1>
        {subtitle ? <p className="text-muted mt-2 text-[14px]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
