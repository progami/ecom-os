import { z } from 'zod'

// Shared constants
export const MAX_PAGINATION_LIMIT = 100
export const DEFAULT_PAGINATION_LIMIT = 50

// Shared enums
export const RegionEnum = z.enum(['KANSAS_US', 'PAKISTAN'])

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
  region: RegionEnum.default('KANSAS_US'),
  managerId: z.string().cuid().optional().nullable(),
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
  region: RegionEnum.optional(),
  managerId: z.string().cuid().optional().nullable(),
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

// Leave Policy schemas
export const LeavePolicyStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])
export const LeaveTypeEnum = z.enum(['PTO', 'PARENTAL', 'BEREAVEMENT_IMMEDIATE', 'BEREAVEMENT_EXTENDED', 'JURY_DUTY'])
export const LeaveRequestStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
export const HalfDayTypeEnum = z.enum(['FIRST_HALF', 'SECOND_HALF'])

export const CreateLeavePolicySchema = z.object({
  region: RegionEnum,
  leaveType: LeaveTypeEnum,
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional().nullable(),
  entitledDays: z.number().int().min(0).max(365),
  isPaid: z.boolean().default(true),
  carryoverMax: z.number().int().min(0).optional().nullable(),
  minNoticeDays: z.number().int().min(0).default(0),
  maxConsecutive: z.number().int().min(1).optional().nullable(),
  rules: z.record(z.unknown()).optional().nullable(),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  status: LeavePolicyStatusEnum.default('ACTIVE'),
})

export const UpdateLeavePolicySchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional().nullable(),
  entitledDays: z.number().int().min(0).max(365).optional(),
  isPaid: z.boolean().optional(),
  carryoverMax: z.number().int().min(0).optional().nullable(),
  minNoticeDays: z.number().int().min(0).optional(),
  maxConsecutive: z.number().int().min(1).optional().nullable(),
  rules: z.record(z.unknown()).optional().nullable(),
  effectiveFrom: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }).optional(),
  status: LeavePolicyStatusEnum.optional(),
})

// Leave Request schemas
export const CreateLeaveRequestSchema = z.object({
  leaveType: LeaveTypeEnum,
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  isHalfDay: z.boolean().default(false),
  halfDayType: HalfDayTypeEnum.optional().nullable(),
  reason: z.string().max(1000).trim().optional().nullable(),
})

export const UpdateLeaveRequestSchema = z.object({
  status: LeaveRequestStatusEnum.optional(),
  comments: z.string().max(1000).trim().optional().nullable(),
})

// Leave Balance schemas
export const UpdateLeaveBalanceSchema = z.object({
  adjustment: z.number().int(),
  reason: z.string().max(500).trim().optional(),
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
export type CreateLeavePolicyInput = z.infer<typeof CreateLeavePolicySchema>
export type UpdateLeavePolicyInput = z.infer<typeof UpdateLeavePolicySchema>
export type CreateLeaveRequestInput = z.infer<typeof CreateLeaveRequestSchema>
export type UpdateLeaveRequestInput = z.infer<typeof UpdateLeaveRequestSchema>
export type UpdateLeaveBalanceInput = z.infer<typeof UpdateLeaveBalanceSchema>
export type CreateCalendarEventInput = z.infer<typeof CreateCalendarEventSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>
