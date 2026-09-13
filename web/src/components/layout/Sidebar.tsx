import { NavLink } from 'react-router-dom';

import {
  IconChart,
  IconGrid,
  IconPlusCircle,
  IconSettings,
  IconUsers,
} from '@/components/icons';
import { cn } from '@/lib/cn';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconGrid, end: true },
  { to: '/clients', label: 'Clients', icon: IconUsers, end: false },
  { to: '/clients/new', label: 'Add client', icon: IconPlusCircle, end: true },
  { to: '/reports', label: 'Reports', icon: IconChart, end: true },
  { to: '/settings', label: 'Settings', icon: IconSettings, end: true },
];

interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

/** Translucent macOS source list. Slides over the content on small screens. */
export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <aside
      className={cn(
        'bg-sidebar border-line fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r backdrop-blur-[20px] backdrop-saturate-150',
        'transition-transform duration-250 ease-[var(--ease-mac)]',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex items-center gap-3 px-5 pt-8 pb-9">
        <img src="/icon.png" alt="" width={36} height={36} className="shrink-0 rounded-[8px]" />
        <div className="min-w-0 leading-tight">
          <div className="text-ink text-[17px] font-semibold">Excel</div>
          <div className="text-muted mt-1 text-[11px]">Driving School</div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'rounded-ctl flex min-h-10 items-center gap-3 px-3 py-2.5 text-[13px] transition-colors duration-200',
                // A tinted row with accent text, the way Finder and Mail mark selection —
                // not a saturated blue slab with a shadow.
                isActive
                  ? 'bg-accent-light text-accent font-semibold'
                  : 'text-ink-soft hover:bg-hover hover:text-ink font-medium'
              )
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="text-muted px-5 py-4 text-[11px]">Version 1.0</div>
    </aside>
  );
}
