import type { Prisma as PrismaNamespace } from '@ecom-os/prisma-hrms'

// Re-export all Prisma types from the generated package
export {
  PrismaClient,
  Prisma,
  EmploymentType,
  EmployeeStatus,
  ResourceCategory,
  PolicyCategory,
  PolicyStatus,
  Region,
  ReviewType,
  ReviewStatus,
  ViolationType,
  ViolationReason,
  ViolationSeverity,
  DisciplinaryActionType,
  DisciplinaryStatus,
  HREventType,
  NotificationType,
  TaskStatus,
  TaskCategory,
  CaseType,
  CaseStatus,
  CaseSeverity,
  CaseParticipantRole,
  CaseNoteVisibility,
  AuditAction,
  AuditEntityType,
} from '@ecom-os/prisma-hrms'

// Transaction client type for $transaction callbacks
export type TransactionClient = PrismaNamespace.TransactionClient
