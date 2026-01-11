import 'server-only';

import { z } from 'zod';

export type ProphetSeasonalityToggle = 'auto' | 'on' | 'off';

export type ProphetRunConfig = {
  intervalWidth?: number;
  uncertaintySamples?: number;
  seasonalityMode?: 'additive' | 'multiplicative';
  yearlySeasonality?: ProphetSeasonalityToggle;
  weeklySeasonality?: ProphetSeasonalityToggle;
  dailySeasonality?: ProphetSeasonalityToggle;
};

export type EtsRunConfig = {
  seasonLength?: number;
  spec?: string;
  intervalLevel?: number | null;
};

const seasonalityToggleSchema = z.enum(['auto', 'on', 'off']);

export const prophetConfigSchema = z
  .object({
    intervalWidth: z.coerce.number().min(0.5).max(0.99).optional(),
    uncertaintySamples: z.coerce.number().int().min(0).max(2000).optional(),
    seasonalityMode: z.enum(['additive', 'multiplicative']).optional(),
    yearlySeasonality: seasonalityToggleSchema.optional(),
    weeklySeasonality: seasonalityToggleSchema.optional(),
    dailySeasonality: seasonalityToggleSchema.optional(),
  })
  .strict();

export const etsConfigSchema = z
  .object({
    seasonLength: z.coerce.number().int().min(1).max(365).optional(),
    spec: z.string().trim().min(1).optional(),
    intervalLevel: z.coerce.number().min(0.5).max(0.99).nullable().optional(),
  })
  .strict();

export function parseProphetConfig(value: unknown): ProphetRunConfig | undefined {
  if (value === undefined || value === null) return undefined;
  const parsed = prophetConfigSchema.parse(value) as ProphetRunConfig;

  const normalizeSeasonality = (toggle: ProphetSeasonalityToggle | undefined): ProphetSeasonalityToggle | undefined =>
    toggle === undefined ? undefined : toggle;

  return {
    ...parsed,
    yearlySeasonality: normalizeSeasonality(parsed.yearlySeasonality),
    weeklySeasonality: normalizeSeasonality(parsed.weeklySeasonality),
    dailySeasonality: normalizeSeasonality(parsed.dailySeasonality),
  };
}

export function parseEtsConfig(value: unknown): EtsRunConfig | undefined {
  if (value === undefined || value === null) return undefined;
  return etsConfigSchema.parse(value) as EtsRunConfig;
}
