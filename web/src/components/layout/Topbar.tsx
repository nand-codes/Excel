import { useEffect, useState } from 'react';

import { IconLogout, IconMenu, IconMoon, IconSearch, IconSun } from '@/components/icons';
import { IconButton } from '@/components/ui/Button';
import { useSearch } from '@/hooks/useSearch';
import type { Appearance } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import { formatTopbarDate } from '@/lib/format';
import type { User } from '@/lib/types';

interface TopbarProps {
  title: string;
  showSearch: boolean;
  appearance: Appearance;
  onToggleAppearance: () => void;
  onToggleSidebar: () => void;
  user: User;
  onSignOut: () => void;
}

export function Topbar({
  title,
  showSearch,
  appearance,
  onToggleAppearance,
  onToggleSidebar,
  user,
  onSignOut,
}: TopbarProps) {
  const { search, setSearch, inputRef } = useSearch();
  const [today, setToday] = useState(() => formatTopbarDate());

  useEffect(() => {
    const timer = window.setInterval(() => setToday(formatTopbarDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header
      className={cn(
        'bg-page/70 border-line sticky top-0 z-20 flex h-[58px] items-center gap-3 border-b px-4 backdrop-blur-2xl',
        'lg:px-6'
      )}
    >
      <IconButton label="Toggle sidebar" onClick={onToggleSidebar} className="lg:hidden">
        <IconMenu size={18} />
      </IconButton>

      <h1 className="font-display text-ink truncate text-[17px] font-bold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {showSearch ? (
          <div className="bg-field rounded-ctl border-line focus-within:border-accent focus-within:ring-accent-ring flex h-9 items-center gap-2 border px-2.5 transition-[border-color,box-shadow] focus-within:ring-3">
            <IconSearch size={15} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients…"
              aria-label="Search clients"
              className="text-ink placeholder:text-placeholder w-[130px] bg-transparent text-[13px] outline-none sm:w-[220px]"
            />
          </div>
        ) : null}

        <IconButton
          label={appearance === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'}
          onClick={onToggleAppearance}
        >
          {appearance === 'dark' ? <IconMoon size={17} /> : <IconSun size={17} />}
        </IconButton>

        <span className="text-muted hidden text-[12.5px] font-semibold xl:inline">{today}</span>

        <div className="border-line ml-1 flex items-center gap-2 border-l pl-2.5">
          <span className="text-ink-soft hidden max-w-[140px] truncate text-[12.5px] font-semibold sm:inline">
            {user.displayName}
          </span>
          <IconButton label="Sign out" onClick={onSignOut}>
            <IconLogout size={17} />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
