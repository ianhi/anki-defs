import { create } from 'zustand';
import type { TokenUsage } from 'shared';
import { computeCost } from 'shared';
import { sessionApi } from '@/lib/api';

interface TokenUsageState {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  loaded: boolean;
  addUsage: (usage: TokenUsage) => void;
  reset: () => void;
  fetchUsage: () => Promise<void>;
}

export const useTokenUsage = create<TokenUsageState>()((set) => ({
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCost: 0,
  requestCount: 0,
  loaded: false,

  addUsage: (usage) =>
    set((state) => ({
      totalInputTokens: state.totalInputTokens + usage.inputTokens,
      totalOutputTokens: state.totalOutputTokens + usage.outputTokens,
      totalCost: state.totalCost + computeCost(usage),
      requestCount: state.requestCount + 1,
    })),

  reset: () => {
    set({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, requestCount: 0 });
    sessionApi.resetUsage().catch((err) => {
      console.error('[Usage] Failed to reset server usage:', err);
    });
  },

  fetchUsage: async () => {
    try {
      const totals = await sessionApi.getUsage();
      set({ ...totals, loaded: true });
    } catch (err) {
      console.error('[Usage] Failed to fetch usage from server:', err);
      set({ loaded: true });
    }
  },
}));

// Fetch server-side usage on startup
useTokenUsage.getState().fetchUsage();
