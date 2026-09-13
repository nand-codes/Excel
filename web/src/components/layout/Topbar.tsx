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
        'bg-sidebar border-line sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b px-4 backdrop-blur-[20px] backdrop-saturate-150',
        'lg:px-8'
      )}
    >
      <IconButton label="Toggle sidebar" onClick={onToggleSidebar} className="lg:hidden">
        <IconMenu size={18} />
      </IconButton>

      {/* Each page carries its own large title, so the toolbar only names the section on
          small screens where the sidebar is hidden. */}
      <p className="text-ink min-w-0 flex-1 truncate text-[13px] font-semibold lg:hidden">{title}</p>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {showSearch ? (
          <div className="bg-field border-line focus-within:border-accent focus-within:ring-accent-ring flex h-[30px] items-center gap-1.5 rounded-full border px-3 transition-[border-color,box-shadow] focus-within:ring-3">
            <IconSearch size={14} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search clients"
              className="text-ink placeholder:text-placeholder w-[64px] bg-transparent text-[13px] outline-none focus-visible:shadow-none sm:w-[200px]"
            />
          </div>
        ) : null}

        <IconButton
          label={appearance === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'}
          onClick={onToggleAppearance}
        >
          {appearance === 'dark' ? <IconMoon size={16} /> : <IconSun size={16} />}
        </IconButton>

        <span className="text-muted hidden text-[12px] xl:inline">{today}</span>

        <span className="text-ink-soft ml-1.5 hidden max-w-[140px] truncate text-[12.5px] font-medium sm:inline">
          {user.displayName}
        </span>
        <IconButton label="Sign out" onClick={onSignOut}>
          <IconLogout size={16} />
        </IconButton>
      </div>
    </header>
  );
}
