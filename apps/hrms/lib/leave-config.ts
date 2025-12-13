import { LeaveType } from '@prisma/client'

// Default leave allocations per leave type (in days)
export const DEFAULT_LEAVE_ALLOCATIONS: Record<LeaveType, number> = {
  ANNUAL: 20,
  SICK: 10,
  PERSONAL: 3,
  UNPAID: 0,
  MATERNITY: 90,
  PATERNITY: 14,
  BEREAVEMENT: 5,
  COMP_TIME: 0,
}

// Leave types that track balances (some like UNPAID don't need balance tracking)
export const BALANCE_TRACKED_TYPES: LeaveType[] = [
  'ANNUAL',
  'SICK',
  'PERSONAL',
]

// Leave types that require manager approval
export const APPROVAL_REQUIRED_TYPES: LeaveType[] = [
  'ANNUAL',
  'SICK',
  'PERSONAL',
  'UNPAID',
  'MATERNITY',
  'PATERNITY',
  'BEREAVEMENT',
  'COMP_TIME',
]

// Human-readable labels
export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ANNUAL: 'Annual Leave',
  SICK: 'Sick Leave',
  PERSONAL: 'Personal Leave',
  UNPAID: 'Unpaid Leave',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  BEREAVEMENT: 'Bereavement Leave',
  COMP_TIME: 'Compensatory Time',
}
