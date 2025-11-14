export const OPS_STAGE_DEFAULT_LABELS = {
  production: 'Production Stage Default (weeks)',
  source: 'Source Stage Default (weeks)',
  ocean: 'Ocean Stage Default (weeks)',
  final: 'Final Stage Default (weeks)',
} as const

export type OpsStageDefaultLabel = (typeof OPS_STAGE_DEFAULT_LABELS)[keyof typeof OPS_STAGE_DEFAULT_LABELS]

export function normalizeLabel(label: string | null | undefined): string {
  return label?.trim().toLowerCase() ?? ''
}

export function matchesStageDefaultLabel(label: string | null | undefined, target: string): boolean {
  return normalizeLabel(label) === normalizeLabel(target)
}
