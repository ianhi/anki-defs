import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TokenUsage } from 'shared';
import { MODEL_PRICING } from 'shared';

function calculateCost(usage: TokenUsage): number {
  const pricing = usage.model ? MODEL_PRICING[usage.model] : undefined;
  if (!pricing) return 0;
  return (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
}

interface TokenUsageState {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
  addUsage: (usage: TokenUsage) => void;
  reset: () => void;
}

export const useTokenUsage = create<TokenUsageState>()(
  persist(
    (set) => ({
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      requestCount: 0,

      addUsage: (usage) =>
        set((state) => ({
          totalInputTokens: state.totalInputTokens + usage.inputTokens,
          totalOutputTokens: state.totalOutputTokens + usage.outputTokens,
          totalCost: state.totalCost + calculateCost(usage),
          requestCount: state.requestCount + 1,
        })),

      reset: () =>
        set({ totalInputTokens: 0, totalOutputTokens: 0, totalCost: 0, requestCount: 0 }),
    }),
    {
      name: 'bangla-token-usage',
      partialize: (state) => ({
        totalInputTokens: state.totalInputTokens,
        totalOutputTokens: state.totalOutputTokens,
        totalCost: state.totalCost,
        requestCount: state.requestCount,
      }),
    }
  )
);
