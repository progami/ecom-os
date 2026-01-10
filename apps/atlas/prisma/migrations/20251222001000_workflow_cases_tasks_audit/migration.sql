-- Core workflow + compliance primitives:
-- - Policy acknowledgements (versioned)
-- - Tasks (onboarding/offboarding/case/general)
-- - HR case management (cases, participants, notes, attachments)
-- - Audit logs
-- - Cron locks for safe periodic jobs

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('GENERAL', 'ONBOARDING', 'OFFBOARDING', 'CASE', 'POLICY');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('VIOLATION', 'GRIEVANCE', 'INVESTIGATION', 'INCIDENT', 'REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CaseSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseParticipantRole" AS ENUM ('SUBJECT', 'REPORTER', 'WITNESS', 'ASSIGNEE', 'HR', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseNoteVisibility" AS ENUM ('INTERNAL_HR', 'MANAGER_VISIBLE', 'EMPLOYEE_VISIBLE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUBMIT', 'APPROVE', 'REJECT', 'ACKNOWLEDGE', 'ASSIGN', 'COMMENT', 'ATTACH', 'COMPLETE');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM (
  'EMPLOYEE',
  'POLICY',
  'POLICY_ACKNOWLEDGEMENT',
  'LEAVE_REQUEST',
  'PERFORMANCE_REVIEW',
  'DISCIPLINARY_ACTION',
  'CASE',
  'CASE_NOTE',
  'CASE_ATTACHMENT',
  'TASK',
  'NOTIFICATION'
);

-- CreateTable: PolicyAcknowledgement
CREATE TABLE "PolicyAcknowledgement" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Case (with caseNumber sequence)
CREATE SEQUENCE "Case_caseNumber_seq";

CREATE TABLE "Case" (
  "id" TEXT NOT NULL,
  "caseNumber" INTEGER NOT NULL DEFAULT nextval('"Case_caseNumber_seq"'::regclass),
  "caseType" "CaseType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "CaseSeverity" NOT NULL DEFAULT 'MEDIUM',

  "subjectEmployeeId" TEXT,
  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,

  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

ALTER SEQUENCE "Case_caseNumber_seq" OWNED BY "Case"."caseNumber";

-- CreateTable: CaseParticipant
CREATE TABLE "CaseParticipant" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "role" "CaseParticipantRole" NOT NULL DEFAULT 'OTHER',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CaseNote
CREATE TABLE "CaseNote" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "visibility" "CaseNoteVisibility" NOT NULL DEFAULT 'INTERNAL_HR',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CaseAttachment
CREATE TABLE "CaseAttachment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "title" TEXT,
  "fileUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CaseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Task
CREATE TABLE "Task" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "category" "TaskCategory" NOT NULL DEFAULT 'GENERAL',

  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),

  "createdById" TEXT NOT NULL,
  "assignedToId" TEXT,
  "subjectEmployeeId" TEXT,
  "caseId" TEXT,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,

  "action" "AuditAction" NOT NULL,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "summary" TEXT,
  "metadata" JSONB,

  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CronLock
CREATE TABLE "CronLock" (
  "key" TEXT NOT NULL,
  "lockedUntil" TIMESTAMP(3) NOT NULL,
  "lockedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CronLock_pkey" PRIMARY KEY ("key")
);

-- CreateIndex: PolicyAcknowledgement
CREATE UNIQUE INDEX "PolicyAcknowledgement_policyId_employeeId_policyVersion_key"
ON "PolicyAcknowledgement"("policyId", "employeeId", "policyVersion");

CREATE INDEX "PolicyAcknowledgement_employeeId_idx" ON "PolicyAcknowledgement"("employeeId");
CREATE INDEX "PolicyAcknowledgement_policyId_idx" ON "PolicyAcknowledgement"("policyId");

-- CreateIndex: Case
CREATE UNIQUE INDEX "Case_caseNumber_key" ON "Case"("caseNumber");
CREATE INDEX "Case_caseType_idx" ON "Case"("caseType");
CREATE INDEX "Case_status_idx" ON "Case"("status");
CREATE INDEX "Case_severity_idx" ON "Case"("severity");
CREATE INDEX "Case_subjectEmployeeId_idx" ON "Case"("subjectEmployeeId");
CREATE INDEX "Case_createdById_idx" ON "Case"("createdById");
CREATE INDEX "Case_assignedToId_idx" ON "Case"("assignedToId");
CREATE INDEX "Case_openedAt_idx" ON "Case"("openedAt");
CREATE INDEX "Case_closedAt_idx" ON "Case"("closedAt");

-- CreateIndex: CaseParticipant
CREATE UNIQUE INDEX "CaseParticipant_caseId_employeeId_key" ON "CaseParticipant"("caseId", "employeeId");
CREATE INDEX "CaseParticipant_caseId_idx" ON "CaseParticipant"("caseId");
CREATE INDEX "CaseParticipant_employeeId_idx" ON "CaseParticipant"("employeeId");
CREATE INDEX "CaseParticipant_role_idx" ON "CaseParticipant"("role");

-- CreateIndex: CaseNote
CREATE INDEX "CaseNote_caseId_idx" ON "CaseNote"("caseId");
CREATE INDEX "CaseNote_authorId_idx" ON "CaseNote"("authorId");
CREATE INDEX "CaseNote_visibility_idx" ON "CaseNote"("visibility");
CREATE INDEX "CaseNote_createdAt_idx" ON "CaseNote"("createdAt");

-- CreateIndex: CaseAttachment
CREATE INDEX "CaseAttachment_caseId_idx" ON "CaseAttachment"("caseId");
CREATE INDEX "CaseAttachment_uploadedById_idx" ON "CaseAttachment"("uploadedById");
CREATE INDEX "CaseAttachment_createdAt_idx" ON "CaseAttachment"("createdAt");

-- CreateIndex: Task
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_category_idx" ON "Task"("category");
CREATE INDEX "Task_assignedToId_idx" ON "Task"("assignedToId");
CREATE INDEX "Task_subjectEmployeeId_idx" ON "Task"("subjectEmployeeId");
CREATE INDEX "Task_caseId_idx" ON "Task"("caseId");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex: AuditLog
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey: PolicyAcknowledgement
ALTER TABLE "PolicyAcknowledgement"
ADD CONSTRAINT "PolicyAcknowledgement_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "Policy"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PolicyAcknowledgement"
ADD CONSTRAINT "PolicyAcknowledgement_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Case
ALTER TABLE "Case"
ADD CONSTRAINT "Case_subjectEmployeeId_fkey"
FOREIGN KEY ("subjectEmployeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Case"
ADD CONSTRAINT "Case_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Case"
ADD CONSTRAINT "Case_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: CaseParticipant
ALTER TABLE "CaseParticipant"
ADD CONSTRAINT "CaseParticipant_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseParticipant"
ADD CONSTRAINT "CaseParticipant_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: CaseNote
ALTER TABLE "CaseNote"
ADD CONSTRAINT "CaseNote_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseNote"
ADD CONSTRAINT "CaseNote_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CaseAttachment
ALTER TABLE "CaseAttachment"
ADD CONSTRAINT "CaseAttachment_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseAttachment"
ADD CONSTRAINT "CaseAttachment_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Task
ALTER TABLE "Task"
ADD CONSTRAINT "Task_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_subjectEmployeeId_fkey"
FOREIGN KEY ("subjectEmployeeId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: AuditLog
ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "Employee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

