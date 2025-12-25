-- Checklist engine (templates + instances) and singleton HRMS settings.

-- Enums
CREATE TYPE "ChecklistLifecycleType" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "ChecklistOwnerType" AS ENUM ('HR', 'MANAGER', 'IT', 'EMPLOYEE');
CREATE TYPE "ChecklistItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'CANCELLED');

-- Templates
CREATE TABLE "ChecklistTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "lifecycleType" "ChecklistLifecycleType" NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistTemplate_lifecycleType_isActive_idx" ON "ChecklistTemplate"("lifecycleType", "isActive");

CREATE TABLE "ChecklistTemplateItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL,
  "ownerType" "ChecklistOwnerType" NOT NULL,
  "dueOffsetDays" INTEGER NOT NULL DEFAULT 0,
  "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
  "dependsOnItemId" TEXT,

  CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistTemplateItem_templateId_sortOrder_idx" ON "ChecklistTemplateItem"("templateId", "sortOrder");
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

ALTER TABLE "ChecklistTemplateItem"
ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Instances
CREATE TABLE "ChecklistInstance" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "lifecycleType" "ChecklistLifecycleType" NOT NULL,
  "anchorDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistInstance_employeeId_lifecycleType_idx" ON "ChecklistInstance"("employeeId", "lifecycleType");
CREATE UNIQUE INDEX "ChecklistInstance_employeeId_lifecycleType_templateId_key" ON "ChecklistInstance"("employeeId", "lifecycleType", "templateId");

ALTER TABLE "ChecklistInstance"
ADD CONSTRAINT "ChecklistInstance_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ChecklistInstance"
ADD CONSTRAINT "ChecklistInstance_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE "ChecklistItemInstance" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "templateItemId" TEXT NOT NULL,
  "status" "ChecklistItemStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "taskId" TEXT,

  CONSTRAINT "ChecklistItemInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChecklistItemInstance_instanceId_idx" ON "ChecklistItemInstance"("instanceId");
CREATE INDEX "ChecklistItemInstance_taskId_idx" ON "ChecklistItemInstance"("taskId");
CREATE INDEX "ChecklistItemInstance_status_idx" ON "ChecklistItemInstance"("status");

ALTER TABLE "ChecklistItemInstance"
ADD CONSTRAINT "ChecklistItemInstance_instanceId_fkey"
FOREIGN KEY ("instanceId") REFERENCES "ChecklistInstance"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "ChecklistItemInstance"
ADD CONSTRAINT "ChecklistItemInstance_templateItemId_fkey"
FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "ChecklistItemInstance"
ADD CONSTRAINT "ChecklistItemInstance_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "Task"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- HRMS settings (singleton row)
CREATE TABLE "HrmsSettings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "defaultHROwnerId" TEXT,
  "defaultITOwnerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrmsSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HrmsSettings_defaultHROwnerId_idx" ON "HrmsSettings"("defaultHROwnerId");
CREATE INDEX "HrmsSettings_defaultITOwnerId_idx" ON "HrmsSettings"("defaultITOwnerId");

ALTER TABLE "HrmsSettings"
ADD CONSTRAINT "HrmsSettings_defaultHROwnerId_fkey"
FOREIGN KEY ("defaultHROwnerId") REFERENCES "Employee"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "HrmsSettings"
ADD CONSTRAINT "HrmsSettings_defaultITOwnerId_fkey"
FOREIGN KEY ("defaultITOwnerId") REFERENCES "Employee"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

