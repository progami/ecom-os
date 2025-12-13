import { z } from 'zod'

// Shared constants
export const MAX_PAGINATION_LIMIT = 100
export const DEFAULT_PAGINATION_LIMIT = 50

// Employee schemas
export const EmploymentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'])
export const EmployeeStatusEnum = z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED'])

export const CreateEmployeeSchema = z.object({
  employeeId: z.string().min(1).max(50).trim().optional(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  phone: z.string().max(50).trim().optional().nullable(),
  department: z.string().max(100).trim().optional().default('General'),
  departmentName: z.string().max(100).trim().optional(),
  position: z.string().min(1).max(100).trim(),
  employmentType: EmploymentTypeEnum.default('FULL_TIME'),
  joinDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  status: EmployeeStatusEnum.default('ACTIVE'),
  roles: z.array(z.string().max(100)).max(20).optional(),
})

export const UpdateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  email: z.string().email().max(255).trim().toLowerCase().optional(),
  phone: z.string().max(50).trim().optional().nullable(),
  department: z.string().max(100).trim().optional(),
  departmentName: z.string().max(100).trim().optional(),
  position: z.string().min(1).max(100).trim().optional(),
  employmentType: EmploymentTypeEnum.optional(),
  joinDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  status: EmployeeStatusEnum.optional(),
  roles: z.array(z.string().max(100)).max(20).optional(),
  // Hierarchy
  reportsToId: z.string().max(100).optional().nullable(),
  // Personal info
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional().nullable(),
  gender: z.string().max(50).trim().optional().nullable(),
  maritalStatus: z.string().max(50).trim().optional().nullable(),
  nationality: z.string().max(100).trim().optional().nullable(),
  address: z.string().max(500).trim().optional().nullable(),
  city: z.string().max(100).trim().optional().nullable(),
  country: z.string().max(100).trim().optional().nullable(),
  postalCode: z.string().max(20).trim().optional().nullable(),
  emergencyContact: z.string().max(100).trim().optional().nullable(),
  emergencyPhone: z.string().max(50).trim().optional().nullable(),
  // Salary
  salary: z.number().min(0).optional().nullable(),
  currency: z.string().max(10).trim().optional(),
})

// Resource schemas
export const ResourceCategoryEnum = z.enum(['ACCOUNTING', 'LEGAL', 'DESIGN', 'MARKETING', 'IT', 'HR', 'OTHER'])

export const CreateResourceSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  category: ResourceCategoryEnum,
  subcategory: z.string().max(100).trim().optional().nullable(),
  email: z.string().email().max(255).trim().optional().nullable(),
  phone: z.string().max(50).trim().optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  description: z.string().max(2000).trim().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
})

export const UpdateResourceSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  category: ResourceCategoryEnum.optional(),
  subcategory: z.string().max(100).trim().optional().nullable(),
  email: z.string().email().max(255).trim().optional().nullable(),
  phone: z.string().max(50).trim().optional().nullable(),
  website: z.string().url().max(500).optional().nullable(),
  description: z.string().max(2000).trim().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
})

// Policy schemas
export const PolicyCategoryEnum = z.enum(['LEAVE', 'PERFORMANCE', 'CONDUCT', 'SECURITY', 'COMPENSATION', 'OTHER'])
export const PolicyStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
export const RegionEnum = z.enum(['ALL', 'KANSAS_US', 'PAKISTAN'])

// Version format: major.minor (e.g., "1.0", "2.3")
export const VersionSchema = z.string().regex(/^\d+\.\d+$/, {
  message: 'Version must be in format X.Y (e.g., 1.0, 2.3)',
})

export function bumpVersion(current: string, type: 'major' | 'minor' = 'minor'): string {
  const match = current.match(/^(\d+)\.(\d+)$/)
  if (!match) return '1.0'
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  if (type === 'major') return `${major + 1}.0`
  return `${major}.${minor + 1}`
}

export const CreatePolicySchema = z.object({
  title: z.string().min(1).max(200).trim(),
  category: PolicyCategoryEnum,
  region: RegionEnum,
  summary: z.string().max(1000).trim().optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
  fileUrl: z.string().url().max(500).optional().nullable(),
  version: VersionSchema.default('1.0'),
  effectiveDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional().nullable(),
  status: PolicyStatusEnum.default('ACTIVE'),
})

export const UpdatePolicySchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  category: PolicyCategoryEnum.optional(),
  region: RegionEnum.optional(),
  summary: z.string().max(1000).trim().optional().nullable(),
  content: z.string().max(50000).optional().nullable(),
  fileUrl: z.string().url().max(500).optional().nullable(),
  version: VersionSchema.optional(),
  bumpVersion: z.enum(['major', 'minor']).optional(),
  effectiveDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional().nullable(),
  status: PolicyStatusEnum.optional(),
})

// Calendar event schema (Google Calendar format)
export const CreateCalendarEventSchema = z.object({
  summary: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  location: z.string().max(500).trim().optional(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string().optional(),
  }),
})

// ============ PERFORMANCE REVIEW SCHEMAS ============
export const ReviewTypeEnum = z.enum(['PROBATION', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'PROMOTION', 'PIP'])
export const ReviewStatusEnum = z.enum(['DRAFT', 'PENDING_REVIEW', 'COMPLETED', 'ACKNOWLEDGED'])

const RatingSchema = z.coerce.number().int().min(1).max(5)

export const CreatePerformanceReviewSchema = z.object({
  employeeId: z.string().min(1).max(100),
  reviewType: ReviewTypeEnum,
  reviewPeriod: z.string().min(1).max(50).trim(),
  reviewDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  reviewerName: z.string().min(1).max(100).trim(),
  overallRating: RatingSchema,
  qualityOfWork: RatingSchema.optional().nullable(),
  productivity: RatingSchema.optional().nullable(),
  communication: RatingSchema.optional().nullable(),
  teamwork: RatingSchema.optional().nullable(),
  initiative: RatingSchema.optional().nullable(),
  attendance: RatingSchema.optional().nullable(),
  strengths: z.string().max(2000).trim().optional().nullable(),
  areasToImprove: z.string().max(2000).trim().optional().nullable(),
  goals: z.string().max(2000).trim().optional().nullable(),
  comments: z.string().max(5000).trim().optional().nullable(),
  status: ReviewStatusEnum.default('DRAFT'),
})

export const UpdatePerformanceReviewSchema = z.object({
  reviewType: ReviewTypeEnum.optional(),
  reviewPeriod: z.string().min(1).max(50).trim().optional(),
  reviewDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  reviewerName: z.string().min(1).max(100).trim().optional(),
  overallRating: RatingSchema.optional(),
  qualityOfWork: RatingSchema.optional().nullable(),
  productivity: RatingSchema.optional().nullable(),
  communication: RatingSchema.optional().nullable(),
  teamwork: RatingSchema.optional().nullable(),
  initiative: RatingSchema.optional().nullable(),
  attendance: RatingSchema.optional().nullable(),
  strengths: z.string().max(2000).trim().optional().nullable(),
  areasToImprove: z.string().max(2000).trim().optional().nullable(),
  goals: z.string().max(2000).trim().optional().nullable(),
  comments: z.string().max(5000).trim().optional().nullable(),
  status: ReviewStatusEnum.optional(),
})

// ============ DISCIPLINARY ACTION SCHEMAS ============
export const ViolationTypeEnum = z.enum([
  'ATTENDANCE', 'CONDUCT', 'PERFORMANCE', 'POLICY_VIOLATION', 'SAFETY',
  'HARASSMENT', 'INSUBORDINATION', 'THEFT_FRAUD', 'SUBSTANCE_ABUSE', 'OTHER'
])

export const ViolationReasonEnum = z.enum([
  'EXCESSIVE_ABSENCES', 'TARDINESS', 'UNAUTHORIZED_LEAVE', 'NO_CALL_NO_SHOW',
  'UNPROFESSIONAL_BEHAVIOR', 'DISRUPTIVE_CONDUCT', 'INAPPROPRIATE_LANGUAGE', 'DRESS_CODE_VIOLATION',
  'POOR_QUALITY_WORK', 'MISSED_DEADLINES', 'FAILURE_TO_FOLLOW_INSTRUCTIONS', 'NEGLIGENCE',
  'CONFIDENTIALITY_BREACH', 'DATA_SECURITY_VIOLATION', 'EXPENSE_POLICY_VIOLATION', 'IT_POLICY_VIOLATION',
  'SAFETY_PROTOCOL_VIOLATION', 'EQUIPMENT_MISUSE',
  'HARASSMENT_DISCRIMINATION', 'WORKPLACE_VIOLENCE', 'THEFT', 'FRAUD', 'FALSIFICATION', 'SUBSTANCE_USE_AT_WORK',
  'OTHER'
])

export const ViolationSeverityEnum = z.enum(['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'])

export const DisciplinaryActionTypeEnum = z.enum([
  'VERBAL_WARNING', 'WRITTEN_WARNING', 'FINAL_WARNING', 'SUSPENSION',
  'DEMOTION', 'TERMINATION', 'PIP', 'TRAINING_REQUIRED', 'NO_ACTION'
])

export const DisciplinaryStatusEnum = z.enum([
  'OPEN', 'UNDER_INVESTIGATION', 'ACTION_TAKEN', 'APPEALED', 'CLOSED', 'DISMISSED'
])

export const CreateDisciplinaryActionSchema = z.object({
  employeeId: z.string().min(1).max(100),
  violationType: ViolationTypeEnum,
  violationReason: ViolationReasonEnum,
  severity: ViolationSeverityEnum,
  incidentDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  reportedBy: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(5000).trim(),
  witnesses: z.string().max(1000).trim().optional().nullable(),
  evidence: z.string().max(2000).trim().optional().nullable(),
  actionTaken: DisciplinaryActionTypeEnum,
  actionDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  actionDetails: z.string().max(2000).trim().optional().nullable(),
  followUpDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  followUpNotes: z.string().max(2000).trim().optional().nullable(),
  status: DisciplinaryStatusEnum.default('OPEN'),
  resolution: z.string().max(2000).trim().optional().nullable(),
})

export const UpdateDisciplinaryActionSchema = z.object({
  violationType: ViolationTypeEnum.optional(),
  violationReason: ViolationReasonEnum.optional(),
  severity: ViolationSeverityEnum.optional(),
  incidentDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  reportedBy: z.string().min(1).max(100).trim().optional(),
  description: z.string().min(1).max(5000).trim().optional(),
  witnesses: z.string().max(1000).trim().optional().nullable(),
  evidence: z.string().max(2000).trim().optional().nullable(),
  actionTaken: DisciplinaryActionTypeEnum.optional(),
  actionDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  actionDetails: z.string().max(2000).trim().optional().nullable(),
  followUpDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  followUpNotes: z.string().max(2000).trim().optional().nullable(),
  status: DisciplinaryStatusEnum.optional(),
  resolution: z.string().max(2000).trim().optional().nullable(),
})

// ============ HR CALENDAR EVENT SCHEMAS ============
export const HREventTypeEnum = z.enum([
  'PERFORMANCE_REVIEW', 'PROBATION_END', 'PIP_REVIEW', 'DISCIPLINARY_HEARING',
  'INTERVIEW', 'ONBOARDING', 'TRAINING', 'COMPANY_EVENT', 'HOLIDAY', 'OTHER'
])

export const CreateHRCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
  eventType: HREventTypeEnum,
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  allDay: z.boolean().default(true),
  employeeId: z.string().max(100).optional().nullable(),
  relatedRecordId: z.string().max(100).optional().nullable(),
  relatedRecordType: z.string().max(50).optional().nullable(),
})

export const UpdateHRCalendarEventSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().optional().nullable(),
  eventType: HREventTypeEnum.optional(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional(),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  allDay: z.boolean().optional(),
  employeeId: z.string().max(100).optional().nullable(),
  relatedRecordId: z.string().max(100).optional().nullable(),
  relatedRecordType: z.string().max(50).optional().nullable(),
})

// Pagination schema
export const PaginationSchema = z.object({
  take: z.coerce.number().int().min(1).max(MAX_PAGINATION_LIMIT).default(DEFAULT_PAGINATION_LIMIT),
  skip: z.coerce.number().int().min(0).default(0),
  q: z.string().max(200).optional(),
})

// Type exports
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>
export type CreateResourceInput = z.infer<typeof CreateResourceSchema>
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>
export type CreatePolicyInput = z.infer<typeof CreatePolicySchema>
export type UpdatePolicyInput = z.infer<typeof UpdatePolicySchema>
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>
