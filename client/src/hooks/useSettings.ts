import { create } from 'zustand';
import type { Settings, AIProvider } from 'shared';
import { DEFAULT_SETTINGS } from 'shared';

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  setProvider: (provider: AIProvider) => void;
  setDefaultDeck: (deck: string) => void;
  setDefaultModel: (model: string) => void;
  loadSettings: (settings: Settings) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  setSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  setProvider: (provider) =>
    set((state) => ({
      settings: { ...state.settings, aiProvider: provider },
    })),

  setDefaultDeck: (deck) =>
    set((state) => ({
      settings: { ...state.settings, defaultDeck: deck },
    })),

  setDefaultModel: (model) =>
    set((state) => ({
      settings: { ...state.settings, defaultModel: model },
    })),

  loadSettings: (settings) =>
    set({
      settings,
      isLoaded: true,
    }),
}));
