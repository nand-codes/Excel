import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

interface SearchContextValue {
  search: string;
  setSearch: (value: string) => void;
  /** Lets the Ctrl+F shortcut focus the field that lives in the toolbar. */
  inputRef: RefObject<HTMLInputElement | null>;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/** Search lives above the router so the toolbar owns the field and the list reads it. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const value = useMemo(() => ({ search, setSearch, inputRef }), [search]);

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) throw new Error('useSearch must be used inside SearchProvider');
  return context;
}
