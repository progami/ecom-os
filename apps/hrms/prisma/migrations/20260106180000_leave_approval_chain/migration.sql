-- Add new LeaveStatus values for approval chain
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'PENDING_MANAGER';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'PENDING_HR';
ALTER TYPE "LeaveStatus" ADD VALUE IF NOT EXISTS 'PENDING_SUPER_ADMIN';

-- Add new NotificationType values for leave approval chain
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_PENDING_HR';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LEAVE_PENDING_SUPER_ADMIN';

-- Add approval tracking columns to LeaveRequest
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerApprovedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerApprovedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "managerNotes" TEXT;

ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrApprovedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrApprovedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "hrNotes" TEXT;

ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "superAdminApprovedById" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "superAdminApprovedAt" TIMESTAMP(3);
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "superAdminNotes" TEXT;

-- Migrate existing PENDING requests to PENDING_MANAGER
UPDATE "LeaveRequest" SET "status" = 'PENDING_MANAGER' WHERE "status" = 'PENDING';
