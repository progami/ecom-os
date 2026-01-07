import type { SelectOption } from '@/lib/domain/shared/options'

// Leave types currently supported in HRMS UI (intentionally simplified).
export const LEAVE_TYPE_VALUES = [
  'PTO',
  'PARENTAL',
  'BEREAVEMENT_IMMEDIATE',
  'UNPAID',
] as const

export type LeaveType = (typeof LEAVE_TYPE_VALUES)[number]

export const LEAVE_TYPE_OPTIONS: ReadonlyArray<SelectOption & { value: LeaveType }> = [
  { value: 'PTO', label: 'PTO (Paid Time Off)' },
  { value: 'PARENTAL', label: 'Parental Leave' },
  { value: 'BEREAVEMENT_IMMEDIATE', label: 'Bereavement' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
]

export const LEAVE_TYPE_LABELS = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<LeaveType, string>

// Keep in sync with Prisma `LeaveStatus`.
export const LEAVE_STATUS_VALUES = [
  'PENDING_MANAGER',
  'PENDING_HR',
  'PENDING_SUPER_ADMIN',
  'PENDING', // Legacy
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const

export type LeaveStatus = (typeof LEAVE_STATUS_VALUES)[number]

export const LEAVE_STATUS_OPTIONS: ReadonlyArray<SelectOption & { value: LeaveStatus }> = [
  { value: 'PENDING_MANAGER', label: 'Pending Manager' },
  { value: 'PENDING_HR', label: 'Pending HR' },
  { value: 'PENDING_SUPER_ADMIN', label: 'Pending Final' },
  { value: 'PENDING', label: 'Pending (Legacy)' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const LEAVE_STATUS_LABELS = Object.fromEntries(
  LEAVE_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<LeaveStatus, string>

