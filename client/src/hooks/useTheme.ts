import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Pre-read to avoid flash of wrong theme
const _persisted = (() => {
  try {
    const raw = localStorage.getItem('anki-defs-theme');
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
    { name: 'anki-defs-theme' }
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
