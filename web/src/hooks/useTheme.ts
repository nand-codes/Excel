import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'light' | 'dark';

const STORAGE_KEY = 'excelDS_theme';
const LEGACY_STORAGE_KEY = 'exelDS_theme';

function readStoredAppearance(): Appearance {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* storage can be blocked; the default below still applies */
  }
  // Dark is the designed appearance, so it wins over the system preference.
  return 'dark';
}

/** Keeps the `dark` class on <html> in step with the saved preference. */
export function useTheme() {
  const [appearance, setAppearance] = useState<Appearance>(readStoredAppearance);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', appearance === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, appearance);
    } catch {
      /* preference simply will not persist */
    }
  }, [appearance]);

  const toggle = useCallback(() => {
    setAppearance((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { appearance, setAppearance, toggle };
}
