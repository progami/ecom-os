// Shared constants for HRMS

export const employmentTypeOptions = [
  { value: 'FULL_TIME', label: 'Employee' },
  { value: 'PART_TIME', label: 'Employee (Part-Time)' },
  { value: 'CONTRACT', label: 'Contractor' },
  { value: 'WORKING_PARTNER', label: 'Working Partner' },
  { value: 'INTERN', label: 'Intern' },
]

export const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
]

// Map employment type value to label
export const employmentTypeLabels: Record<string, string> = {
  FULL_TIME: 'Employee',
  PART_TIME: 'Employee (Part-Time)',
  CONTRACT: 'Contractor',
  WORKING_PARTNER: 'Working Partner',
  INTERN: 'Intern',
}

// Map status value to label
export const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  ON_LEAVE: 'On Leave',
  TERMINATED: 'Terminated',
  RESIGNED: 'Resigned',
}
