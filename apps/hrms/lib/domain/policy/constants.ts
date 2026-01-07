import type { SelectOption } from '@/lib/domain/shared/options'

export const POLICY_CATEGORY_VALUES = [
  'LEAVE',
  'PERFORMANCE',
  'CONDUCT',
  'SECURITY',
  'COMPENSATION',
  'OTHER',
] as const

export type PolicyCategory = (typeof POLICY_CATEGORY_VALUES)[number]

export const POLICY_CATEGORY_OPTIONS: ReadonlyArray<SelectOption & { value: PolicyCategory }> = [
  { value: 'LEAVE', label: 'Leave' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'COMPENSATION', label: 'Compensation' },
  { value: 'OTHER', label: 'Other' },
]

export const POLICY_CATEGORY_LABELS = Object.fromEntries(
  POLICY_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<PolicyCategory, string>

export const POLICY_REGION_VALUES = [
  'ALL',
  'KANSAS_US',
  'PAKISTAN',
] as const

export type PolicyRegion = (typeof POLICY_REGION_VALUES)[number]

export const POLICY_REGION_OPTIONS: ReadonlyArray<SelectOption & { value: PolicyRegion }> = [
  { value: 'ALL', label: 'All Regions' },
  { value: 'KANSAS_US', label: 'US (Kansas)' },
  { value: 'PAKISTAN', label: 'Pakistan' },
]

export const POLICY_REGION_LABELS = Object.fromEntries(
  POLICY_REGION_OPTIONS.map((o) => [o.value, o.label])
) as Record<PolicyRegion, string>

export const POLICY_STATUS_VALUES = [
  'DRAFT',
  'ACTIVE',
  'ARCHIVED',
] as const

export type PolicyStatus = (typeof POLICY_STATUS_VALUES)[number]

export const POLICY_STATUS_OPTIONS: ReadonlyArray<SelectOption & { value: PolicyStatus }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export const POLICY_STATUS_LABELS = Object.fromEntries(
  POLICY_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<PolicyStatus, string>

