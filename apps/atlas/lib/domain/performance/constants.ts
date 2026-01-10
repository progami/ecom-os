import type { SelectOption } from '@/lib/domain/shared/options'

// Review types currently supported in ATLAS UI (intentionally simplified).
export const REVIEW_TYPE_VALUES = [
  'PROBATION',
  'QUARTERLY',
  'ANNUAL',
] as const

export type ReviewType = (typeof REVIEW_TYPE_VALUES)[number]

export const REVIEW_TYPE_OPTIONS: ReadonlyArray<SelectOption & { value: ReviewType }> = [
  { value: 'PROBATION', label: 'Probation' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annual' },
]

export const REVIEW_TYPE_LABELS = Object.fromEntries(
  REVIEW_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ReviewType, string>

// Keep in sync with Prisma `ReviewStatus`.
export const REVIEW_STATUS_VALUES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'DRAFT',
  'PENDING_REVIEW',
  'PENDING_HR_REVIEW',
  'PENDING_SUPER_ADMIN',
  'PENDING_ACKNOWLEDGMENT',
  'ACKNOWLEDGED',
  'COMPLETED',
] as const

export type ReviewStatus = (typeof REVIEW_STATUS_VALUES)[number]

export const REVIEW_STATUS_OPTIONS: ReadonlyArray<SelectOption & { value: ReviewStatus }> = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DRAFT', label: 'Draft (Legacy)' },
  { value: 'PENDING_REVIEW', label: 'Pending (Legacy)' },
  { value: 'PENDING_HR_REVIEW', label: 'Pending HR' },
  { value: 'PENDING_SUPER_ADMIN', label: 'Pending Admin' },
  { value: 'PENDING_ACKNOWLEDGMENT', label: 'Pending Ack' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'COMPLETED', label: 'Completed' },
]

export const REVIEW_STATUS_LABELS = Object.fromEntries(
  REVIEW_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<ReviewStatus, string>

