-- Remove checklists/offboarding artifacts and legacy enum values.

UPDATE "Task"
SET "category" = 'GENERAL'
WHERE "category" IN ('ONBOARDING', 'OFFBOARDING');

UPDATE "HRCalendarEvent"
SET "eventType" = 'OTHER'
WHERE "eventType" = 'ONBOARDING';

DELETE FROM "AuditLog"
WHERE "entityType" IN ('CHECKLIST_TEMPLATE', 'CHECKLIST_INSTANCE', 'CHECKLIST_ITEM_INSTANCE');

DROP TABLE IF EXISTS "ChecklistItemInstance";
DROP TABLE IF EXISTS "ChecklistInstance";
DROP TABLE IF EXISTS "ChecklistTemplateItem";
DROP TABLE IF EXISTS "ChecklistTemplate";
DROP TABLE IF EXISTS "AtlasSettings";

DROP TYPE IF EXISTS "ChecklistItemStatus";
DROP TYPE IF EXISTS "ChecklistOwnerType";
DROP TYPE IF EXISTS "ChecklistLifecycleType";

ALTER TYPE "TaskCategory" RENAME TO "TaskCategory_old";
CREATE TYPE "TaskCategory" AS ENUM ('GENERAL', 'CASE', 'POLICY');
ALTER TABLE "Task" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "category" TYPE "TaskCategory" USING ("category"::text::"TaskCategory");
ALTER TABLE "Task" ALTER COLUMN "category" SET DEFAULT 'GENERAL';
DROP TYPE "TaskCategory_old";

ALTER TYPE "HREventType" RENAME TO "HREventType_old";
CREATE TYPE "HREventType" AS ENUM (
  'PERFORMANCE_REVIEW',
  'PROBATION_END',
  'PIP_REVIEW',
  'DISCIPLINARY_HEARING',
  'INTERVIEW',
  'TRAINING',
  'COMPANY_EVENT',
  'HOLIDAY',
  'OTHER'
);
ALTER TABLE "HRCalendarEvent" ALTER COLUMN "eventType" TYPE "HREventType" USING ("eventType"::text::"HREventType");
DROP TYPE "HREventType_old";

ALTER TYPE "AuditEntityType" RENAME TO "AuditEntityType_old";
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
  'EMPLOYEE_FILE',
  'TASK',
  'NOTIFICATION',
  'EXPORT'
);
ALTER TABLE "AuditLog" ALTER COLUMN "entityType" TYPE "AuditEntityType" USING ("entityType"::text::"AuditEntityType");
DROP TYPE "AuditEntityType_old";
