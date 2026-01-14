import type { WeekStartsOn } from '@/lib/calculations/week-utils';

export const STRATEGY_REGIONS = ['US', 'UK'] as const;
export type StrategyRegion = (typeof STRATEGY_REGIONS)[number];

export function parseStrategyRegion(value: unknown): StrategyRegion | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return STRATEGY_REGIONS.includes(normalized as StrategyRegion)
    ? (normalized as StrategyRegion)
    : null;
}

export function weekStartsOnForRegion(region: StrategyRegion | null | undefined): WeekStartsOn {
  // All regions use Monday as week start to align with Sellerboard
  return 1;
}
