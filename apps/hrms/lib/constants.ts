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

// Region options
export const regionOptions = [
  { value: 'PAKISTAN', label: 'Pakistan' },
  { value: 'KANSAS_USA', label: 'Kansas (USA)' },
]

// Map region value to label
export const regionLabels: Record<string, string> = {
  PAKISTAN: 'Pakistan',
  KANSAS_USA: 'Kansas (USA)',
}

// Leave type labels
export const leaveTypeLabels: Record<string, string> = {
  PTO: 'PTO (Paid Time Off)',
  MATERNITY: 'Maternity Leave',
  PATERNITY: 'Paternity Leave',
  PARENTAL: 'Parental Leave',
  BEREAVEMENT_IMMEDIATE: 'Bereavement (Immediate Family)',
  BEREAVEMENT_EXTENDED: 'Bereavement (Extended Family)',
  JURY_DUTY: 'Jury Duty',
  UNPAID: 'Unpaid Leave',
}

// Leave status labels
export const leaveStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}
