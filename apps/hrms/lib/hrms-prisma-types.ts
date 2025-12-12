export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED'
export type Region = 'KANSAS_US' | 'PAKISTAN'
export type LeaveType = 'PTO' | 'PARENTAL' | 'BEREAVEMENT_IMMEDIATE' | 'BEREAVEMENT_EXTENDED' | 'JURY_DUTY'
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
export type LeavePolicyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
export type HalfDayType = 'FIRST_HALF' | 'SECOND_HALF'
export type AttendanceType = 'AUTO_PRESENT' | 'LEAVE' | 'HOLIDAY' | 'WEEKEND' | 'WFH' | 'HALF_DAY' | 'ABSENT'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HRMSPrismaClient = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TransactionClient = any
