export const ONBOARDED_STORAGE_KEY = 'anki-defs-onboarded';
export const CHAT_STORAGE_KEY = 'anki-defs-chat';
export const THEME_STORAGE_KEY = 'anki-defs-theme';

/** Migrate localStorage keys from old bangla-* names to anki-defs-*. */
export function migrateStorageKeys(): void {
  const migrations: [string, string][] = [['bangla-chat', CHAT_STORAGE_KEY]];
  for (const [oldKey, newKey] of migrations) {
    const value = localStorage.getItem(oldKey);
    if (value !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  }
}
