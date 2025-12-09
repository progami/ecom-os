import type { PrismaClient, Prisma } from '@prisma/client'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN'
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED' | 'RESIGNED'

type ModelNames = 'employee' | 'resource' | 'policy'

export type HRMSPrismaClient = PrismaClient & Record<ModelNames, unknown>

export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>
