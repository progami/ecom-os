import type { SelectOption } from '@/lib/domain/shared/options'

export const EMPLOYMENT_TYPE_VALUES = [
  'FULL_TIME',
  'PART_TIME',
  'CONTRACT',
  'WORKING_PARTNER',
  'INTERN',
] as const

export type EmploymentType = (typeof EMPLOYMENT_TYPE_VALUES)[number]

export const EMPLOYMENT_TYPE_OPTIONS: ReadonlyArray<SelectOption & { value: EmploymentType }> = [
  { value: 'FULL_TIME', label: 'Employee' },
  { value: 'PART_TIME', label: 'Employee (Part-Time)' },
  { value: 'CONTRACT', label: 'Contractor' },
  { value: 'WORKING_PARTNER', label: 'Working Partner' },
  { value: 'INTERN', label: 'Intern' },
]

export const EMPLOYMENT_TYPE_LABELS = Object.fromEntries(
  EMPLOYMENT_TYPE_OPTIONS.map((o) => [o.value, o.label])
) as Record<EmploymentType, string>

export const EMPLOYEE_STATUS_VALUES = [
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
  'RESIGNED',
] as const

export type EmployeeStatus = (typeof EMPLOYEE_STATUS_VALUES)[number]

export const EMPLOYEE_STATUS_OPTIONS: ReadonlyArray<SelectOption & { value: EmployeeStatus }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
]

export const EMPLOYEE_STATUS_LABELS = Object.fromEntries(
  EMPLOYEE_STATUS_OPTIONS.map((o) => [o.value, o.label])
) as Record<EmployeeStatus, string>

export const EMPLOYEE_REGION_VALUES = [
  'PAKISTAN',
  'KANSAS_USA',
] as const

export type EmployeeRegion = (typeof EMPLOYEE_REGION_VALUES)[number]

export const EMPLOYEE_REGION_OPTIONS: ReadonlyArray<SelectOption & { value: EmployeeRegion }> = [
  { value: 'PAKISTAN', label: 'Pakistan' },
  { value: 'KANSAS_USA', label: 'Kansas (USA)' },
]

export const EMPLOYEE_REGION_LABELS = Object.fromEntries(
  EMPLOYEE_REGION_OPTIONS.map((o) => [o.value, o.label])
) as Record<EmployeeRegion, string>

