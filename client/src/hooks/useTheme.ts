import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_STORAGE_KEY } from '@/lib/storage-keys';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Pre-read to avoid flash of wrong theme
const _persisted = (() => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw) return JSON.parse(raw)?.state?.theme as Theme | undefined;
  } catch {
    /* empty */
  }
  return undefined;
})();

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: _persisted ?? 'system',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    { name: THEME_STORAGE_KEY }
  )
);

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && getSystemDark());
  document.documentElement.classList.toggle('dark', isDark);
}

// Apply on load (before first paint)
applyTheme(_persisted ?? 'system');

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = useTheme.getState().theme;
    if (current === 'system') applyTheme('system');
  });
}
