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
export const RegionEnum = z.enum(['KANSAS_US', 'PAKISTAN'])

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

// Calendar event schema
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
