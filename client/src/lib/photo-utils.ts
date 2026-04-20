import type { TokenUsage } from 'shared';
import { computeCost, MODEL_PRICING } from 'shared';

export function estimateGenerateCost(n: number, model: string): string | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;
  if (pricing.input === 0 && pricing.output === 0) return 'Free';
  const cost = (n * (600 * pricing.input + 80 * pricing.output)) / 1_000_000;
  if (cost < 0.001) return '<$0.001';
  return `~$${cost.toFixed(3)}`;
}

export function formatCost(usage: TokenUsage): string {
  const cost = computeCost(usage);
  if (cost === 0) return '';
  if (cost < 0.001) return '<$0.001';
  return `$${cost.toFixed(3)}`;
}
