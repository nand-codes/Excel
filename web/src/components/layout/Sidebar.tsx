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
  { to: '/clients/new', label: 'Add Client', icon: IconPlusCircle, end: true },
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
        'bg-sidebar border-line fixed inset-y-0 left-0 z-30 flex w-[232px] flex-col border-r backdrop-blur-2xl',
        'transition-transform duration-250 ease-[var(--ease-mac)]',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <img src="/icon.png" alt="" width={40} height={40} className="rounded-ctl shrink-0" />
        <div className="min-w-0 leading-tight">
          <div className="font-display text-ink truncate text-[15px] font-extrabold">Excel</div>
          <div className="text-muted truncate text-[11.5px] font-medium">Driving School</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2.5 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'rounded-ctl flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] font-semibold transition-colors duration-150',
                isActive ? 'bg-accent text-white shadow-mac' : 'text-ink-soft hover:bg-hover hover:text-ink'
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-divider text-muted border-t px-4 py-3 text-[11px] font-medium">
        v1.0 · Excel DS
      </div>
    </aside>
  );
}
