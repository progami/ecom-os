import type { PrismaClient } from '@prisma/client'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED'

type ModelNames = 'employee' | 'resource' | 'policy'

export type HRMSPrismaClient = PrismaClient & Record<ModelNames, any>
