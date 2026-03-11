import { create } from 'zustand';
import type { Settings } from 'shared';
import { DEFAULT_SETTINGS } from 'shared';
import { settingsApi } from '@/lib/api';

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  setDefaultDeck: (deck: string) => void;
  setDefaultModel: (model: string) => void;
  loadSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  setDefaultDeck: (deck) => {
    set((state) => ({
      settings: { ...state.settings, defaultDeck: deck },
    }));
    settingsApi.update({ defaultDeck: deck }).catch((err) => {
      console.error('[Settings] Failed to persist deck selection:', err);
    });
  },

  setDefaultModel: (model) => {
    set((state) => ({
      settings: { ...state.settings, defaultModel: model },
    }));
    settingsApi.update({ defaultModel: model }).catch((err) => {
      console.error('[Settings] Failed to persist model selection:', err);
    });
  },

  loadSettings: (settings) =>
    set({
      settings,
      isLoaded: true,
    }),

  updateSettings: async (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
    try {
      await settingsApi.update(updates);
    } catch (error) {
      console.error('[Settings] Failed to save settings:', error);
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await settingsApi.get();
      set({ settings, isLoaded: true });
    } catch (error) {
      console.error('[Settings] Failed to fetch settings:', error);
      set({ isLoaded: true });
    }
  },
}));

// Fetch settings from server on startup
useSettingsStore.getState().fetchSettings();
