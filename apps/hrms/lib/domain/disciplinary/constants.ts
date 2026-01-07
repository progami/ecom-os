// Disciplinary / Violations constants shared by UI + server validation.
// Keep in sync with Prisma enums in `apps/hrms/prisma/schema.prisma`.

import type { SelectOption, SelectOptionGroup } from '@/lib/domain/shared/options'

export const VIOLATION_TYPE_VALUES = [
  'ATTENDANCE',
  'CONDUCT',
  'PERFORMANCE',
  'POLICY_VIOLATION',
  'SAFETY',
  'HARASSMENT',
  'INSUBORDINATION',
  'THEFT_FRAUD',
  'SUBSTANCE_ABUSE',
  'OTHER',
] as const

export type ViolationType = (typeof VIOLATION_TYPE_VALUES)[number]

export const VIOLATION_TYPE_OPTIONS: ReadonlyArray<SelectOption & { value: ViolationType }> = [
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'CONDUCT', label: 'Conduct' },
  { value: 'PERFORMANCE', label: 'Performance' },
  { value: 'POLICY_VIOLATION', label: 'Policy violation' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'HARASSMENT', label: 'Harassment / Discrimination' },
  { value: 'INSUBORDINATION', label: 'Insubordination' },
  { value: 'THEFT_FRAUD', label: 'Theft / Fraud' },
  { value: 'SUBSTANCE_ABUSE', label: 'Substance abuse' },
  { value: 'OTHER', label: 'Other' },
]

export const VIOLATION_TYPE_LABELS = Object.fromEntries(
  VIOLATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<ViolationType, string>

export const VIOLATION_REASON_VALUES = [
  // Attendance
  'EXCESSIVE_ABSENCES',
  'TARDINESS',
  'UNAUTHORIZED_LEAVE',
  'NO_CALL_NO_SHOW',

  // Conduct
  'UNPROFESSIONAL_BEHAVIOR',
  'DISRUPTIVE_CONDUCT',
  'INAPPROPRIATE_LANGUAGE',
  'DRESS_CODE_VIOLATION',

  // Performance
  'POOR_QUALITY_WORK',
  'MISSED_DEADLINES',
  'FAILURE_TO_FOLLOW_INSTRUCTIONS',
  'NEGLIGENCE',

  // Policy
  'CONFIDENTIALITY_BREACH',
  'DATA_SECURITY_VIOLATION',
  'EXPENSE_POLICY_VIOLATION',
  'IT_POLICY_VIOLATION',

  // Safety
  'SAFETY_PROTOCOL_VIOLATION',
  'EQUIPMENT_MISUSE',

  // Serious
  'HARASSMENT_DISCRIMINATION',
  'WORKPLACE_VIOLENCE',
  'THEFT',
  'FRAUD',
  'FALSIFICATION',
  'SUBSTANCE_USE_AT_WORK',

  // Other
  'OTHER',
] as const

export type ViolationReason = (typeof VIOLATION_REASON_VALUES)[number]

export const VIOLATION_REASON_GROUPS: ReadonlyArray<SelectOptionGroup & { options: ReadonlyArray<SelectOption & { value: ViolationReason }> }> = [
  {
    label: 'Attendance',
    options: [
      { value: 'EXCESSIVE_ABSENCES', label: 'Excessive absences' },
      { value: 'TARDINESS', label: 'Tardiness' },
      { value: 'UNAUTHORIZED_LEAVE', label: 'Unauthorized leave' },
      { value: 'NO_CALL_NO_SHOW', label: 'No call / no show' },
    ],
  },
  {
    label: 'Conduct',
    options: [
      { value: 'UNPROFESSIONAL_BEHAVIOR', label: 'Unprofessional behavior' },
      { value: 'DISRUPTIVE_CONDUCT', label: 'Disruptive conduct' },
      { value: 'INAPPROPRIATE_LANGUAGE', label: 'Inappropriate language' },
      { value: 'DRESS_CODE_VIOLATION', label: 'Dress code violation' },
    ],
  },
  {
    label: 'Performance',
    options: [
      { value: 'POOR_QUALITY_WORK', label: 'Poor quality work' },
      { value: 'MISSED_DEADLINES', label: 'Missed deadlines' },
      { value: 'FAILURE_TO_FOLLOW_INSTRUCTIONS', label: 'Failure to follow instructions' },
      { value: 'NEGLIGENCE', label: 'Negligence' },
    ],
  },
  {
    label: 'Policy',
    options: [
      { value: 'CONFIDENTIALITY_BREACH', label: 'Confidentiality breach' },
      { value: 'DATA_SECURITY_VIOLATION', label: 'Data security violation' },
      { value: 'EXPENSE_POLICY_VIOLATION', label: 'Expense policy violation' },
      { value: 'IT_POLICY_VIOLATION', label: 'IT policy violation' },
    ],
  },
  {
    label: 'Safety',
    options: [
      { value: 'SAFETY_PROTOCOL_VIOLATION', label: 'Safety protocol violation' },
      { value: 'EQUIPMENT_MISUSE', label: 'Equipment misuse' },
    ],
  },
  {
    label: 'Serious',
    options: [
      { value: 'HARASSMENT_DISCRIMINATION', label: 'Harassment / discrimination' },
      { value: 'WORKPLACE_VIOLENCE', label: 'Workplace violence' },
      { value: 'THEFT', label: 'Theft' },
      { value: 'FRAUD', label: 'Fraud' },
      { value: 'FALSIFICATION', label: 'Falsification' },
      { value: 'SUBSTANCE_USE_AT_WORK', label: 'Substance use at work' },
    ],
  },
  {
    label: 'Other',
    options: [{ value: 'OTHER', label: 'Other' }],
  },
]

export const VIOLATION_REASON_LABELS = Object.fromEntries(
  VIOLATION_REASON_GROUPS.flatMap((g) => g.options.map((r) => [r.value, r.label]))
) as Record<ViolationReason, string>

export const DISCIPLINARY_ACTION_TYPE_VALUES = [
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'FINAL_WARNING',
  'SUSPENSION',
  'DEMOTION',
  'TERMINATION',
  'PIP',
  'TRAINING_REQUIRED',
  'NO_ACTION',
] as const

export type DisciplinaryActionType = (typeof DISCIPLINARY_ACTION_TYPE_VALUES)[number]

export const DISCIPLINARY_ACTION_TYPE_OPTIONS: ReadonlyArray<SelectOption & { value: DisciplinaryActionType }> = [
  { value: 'VERBAL_WARNING', label: 'Verbal warning' },
  { value: 'WRITTEN_WARNING', label: 'Written warning' },
  { value: 'FINAL_WARNING', label: 'Final warning' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'DEMOTION', label: 'Demotion' },
  { value: 'TERMINATION', label: 'Termination' },
  { value: 'PIP', label: 'Performance improvement plan (PIP)' },
  { value: 'TRAINING_REQUIRED', label: 'Training required' },
  { value: 'NO_ACTION', label: 'No action' },
]

export const DISCIPLINARY_ACTION_TYPE_LABELS = Object.fromEntries(
  DISCIPLINARY_ACTION_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<DisciplinaryActionType, string>

export const DISCIPLINARY_STATUS_VALUES = [
  'PENDING_HR_REVIEW',
  'PENDING_SUPER_ADMIN',
  'PENDING_ACKNOWLEDGMENT',
  'OPEN',
  'UNDER_INVESTIGATION',
  'ACTION_TAKEN',
  'ACTIVE',
  'APPEALED',
  'APPEAL_PENDING_HR',
  'APPEAL_PENDING_SUPER_ADMIN',
  'CLOSED',
  'DISMISSED',
] as const

export type DisciplinaryStatus = (typeof DISCIPLINARY_STATUS_VALUES)[number]

export const DISCIPLINARY_STATUS_OPTIONS: ReadonlyArray<SelectOption & { value: DisciplinaryStatus }> = [
  { value: 'PENDING_HR_REVIEW', label: 'Pending HR review' },
  { value: 'PENDING_SUPER_ADMIN', label: 'Pending super admin approval' },
  { value: 'PENDING_ACKNOWLEDGMENT', label: 'Pending acknowledgment' },
  { value: 'OPEN', label: 'Open' },
  { value: 'UNDER_INVESTIGATION', label: 'Under investigation' },
  { value: 'ACTION_TAKEN', label: 'Action taken' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'APPEALED', label: 'Appealed' },
  { value: 'APPEAL_PENDING_HR', label: 'Appeal pending HR' },
  { value: 'APPEAL_PENDING_SUPER_ADMIN', label: 'Appeal pending super admin' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DISMISSED', label: 'Dismissed' },
]

export const DISCIPLINARY_STATUS_LABELS = Object.fromEntries(
  DISCIPLINARY_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<DisciplinaryStatus, string>

export const VALUE_BREACH_VALUES = [
  'BREACH_OF_DETAIL',
  'BREACH_OF_HONESTY',
  'BREACH_OF_INTEGRITY',
  'BREACH_OF_COURAGE',
] as const

export type ValueBreach = (typeof VALUE_BREACH_VALUES)[number]

export const VALUE_BREACH_OPTIONS: ReadonlyArray<SelectOption & { value: ValueBreach; description: string }> = [
  { value: 'BREACH_OF_DETAIL', label: 'Attention to detail', description: 'Recurring mistakes, sloppy work, or missed checks.' },
  { value: 'BREACH_OF_HONESTY', label: 'Honesty', description: 'Misrepresentation, hiding facts, or falsifying records.' },
  { value: 'BREACH_OF_INTEGRITY', label: 'Integrity', description: 'Theft, harassment, toxic behavior, or ethics violations.' },
  { value: 'BREACH_OF_COURAGE', label: 'Courage', description: 'Avoiding ownership, hiding bad news, or not taking initiative.' },
]

export const VALUE_BREACH_LABELS = Object.fromEntries(
  VALUE_BREACH_OPTIONS.map((o) => [o.value, o.label])
) as Record<ValueBreach, string>
