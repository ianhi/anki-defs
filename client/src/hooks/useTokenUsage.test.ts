import { describe, it, expect, beforeEach } from 'vitest';
import { useTokenUsage } from './useTokenUsage';
import type { TokenUsage } from 'shared';

describe('useTokenUsage store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTokenUsage.getState().reset();
  });

  it('starts with zero totals', () => {
    const state = useTokenUsage.getState();
    expect(state.totalInputTokens).toBe(0);
    expect(state.totalOutputTokens).toBe(0);
    expect(state.totalCost).toBe(0);
    expect(state.requestCount).toBe(0);
  });

  it('addUsage accumulates input and output tokens', () => {
    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      provider: 'gemini',
    };

    useTokenUsage.getState().addUsage(usage);
    const state = useTokenUsage.getState();

    expect(state.totalInputTokens).toBe(100);
    expect(state.totalOutputTokens).toBe(50);
    expect(state.requestCount).toBe(1);
  });

  it('addUsage accumulates across multiple calls', () => {
    const { addUsage } = useTokenUsage.getState();

    addUsage({ inputTokens: 100, outputTokens: 50, provider: 'gemini' });
    addUsage({ inputTokens: 200, outputTokens: 75, provider: 'gemini' });
    addUsage({ inputTokens: 50, outputTokens: 25, provider: 'claude' });

    const state = useTokenUsage.getState();
    expect(state.totalInputTokens).toBe(350);
    expect(state.totalOutputTokens).toBe(150);
    expect(state.requestCount).toBe(3);
  });

  it('addUsage calculates cost for known models', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
    };

    useTokenUsage.getState().addUsage(usage);
    const state = useTokenUsage.getState();

    // gemini-2.5-flash-lite: input=$0.1/M, output=$0.4/M
    // Cost = (1M * 0.1 + 1M * 0.4) / 1M = 0.5
    expect(state.totalCost).toBeCloseTo(0.5);
  });

  it('addUsage reports zero cost for unknown models', () => {
    const usage: TokenUsage = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      provider: 'openrouter',
      model: 'unknown-model-xyz',
    };

    useTokenUsage.getState().addUsage(usage);
    expect(useTokenUsage.getState().totalCost).toBe(0);
  });

  it('addUsage reports zero cost when model is undefined', () => {
    const usage: TokenUsage = {
      inputTokens: 500,
      outputTokens: 200,
      provider: 'claude',
    };

    useTokenUsage.getState().addUsage(usage);
    expect(useTokenUsage.getState().totalCost).toBe(0);
  });

  it('reset clears all accumulated state', () => {
    const { addUsage } = useTokenUsage.getState();

    addUsage({ inputTokens: 100, outputTokens: 50, provider: 'gemini', model: 'gemini-2.0-flash' });
    addUsage({ inputTokens: 200, outputTokens: 75, provider: 'claude' });

    useTokenUsage.getState().reset();
    const state = useTokenUsage.getState();

    expect(state.totalInputTokens).toBe(0);
    expect(state.totalOutputTokens).toBe(0);
    expect(state.totalCost).toBe(0);
    expect(state.requestCount).toBe(0);
  });

  it('cost accumulates correctly across multiple requests', () => {
    const { addUsage } = useTokenUsage.getState();

    // gemini-2.0-flash: input=$0.1/M, output=$0.4/M
    addUsage({
      inputTokens: 500_000,
      outputTokens: 500_000,
      provider: 'gemini',
      model: 'gemini-2.0-flash',
    });
    // Cost = (500k * 0.1 + 500k * 0.4) / 1M = 0.25

    // gemini-2.5-flash: input=$0.15/M, output=$0.6/M
    addUsage({
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    // Cost = (1M * 0.15 + 1M * 0.6) / 1M = 0.75

    const state = useTokenUsage.getState();
    expect(state.totalCost).toBeCloseTo(1.0);
  });
});
