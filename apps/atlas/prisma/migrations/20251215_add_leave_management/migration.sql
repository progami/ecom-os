-- CreateEnum
CREATE TYPE "EmployeeRegion" AS ENUM ('PAKISTAN', 'KANSAS_USA');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('PTO', 'MATERNITY', 'PATERNITY', 'PARENTAL', 'BEREAVEMENT_IMMEDIATE', 'BEREAVEMENT_EXTENDED', 'JURY_DUTY', 'UNPAID');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable: Add region to Employee
ALTER TABLE "Employee" ADD COLUMN "region" "EmployeeRegion" NOT NULL DEFAULT 'PAKISTAN';

-- CreateTable: LeavePolicy
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "region" "EmployeeRegion" NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "daysPerYear" INTEGER NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxCarryover" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeaveBalance
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "year" INTEGER NOT NULL,
    "allocated" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "carriedOver" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeaveRequest
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeavePolicy_region_idx" ON "LeavePolicy"("region");
CREATE UNIQUE INDEX "LeavePolicy_region_leaveType_key" ON "LeavePolicy"("region", "leaveType");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveType_year_key" ON "LeaveBalance"("employeeId", "leaveType", "year");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed Leave Policies for Pakistan
INSERT INTO "LeavePolicy" ("id", "region", "leaveType", "daysPerYear", "isPaid", "requiresApproval", "maxCarryover", "description", "createdAt", "updatedAt") VALUES
('lp_pk_pto', 'PAKISTAN', 'PTO', 15, true, true, 5, 'Paid Time Off - Vacation, Sick, Personal combined', NOW(), NOW()),
('lp_pk_maternity', 'PAKISTAN', 'MATERNITY', 90, true, true, 0, 'Maternity leave (statutory)', NOW(), NOW()),
('lp_pk_paternity', 'PAKISTAN', 'PATERNITY', 14, true, true, 0, 'Paternity leave (2 weeks)', NOW(), NOW()),
('lp_pk_bereavement_imm', 'PAKISTAN', 'BEREAVEMENT_IMMEDIATE', 5, true, true, 0, 'Bereavement - Immediate family (spouse, children, parents, siblings)', NOW(), NOW()),
('lp_pk_bereavement_ext', 'PAKISTAN', 'BEREAVEMENT_EXTENDED', 2, true, true, 0, 'Bereavement - Extended family', NOW(), NOW()),
('lp_pk_unpaid', 'PAKISTAN', 'UNPAID', 365, false, true, 0, 'Unpaid leave', NOW(), NOW());

-- Seed Leave Policies for Kansas (USA)
INSERT INTO "LeavePolicy" ("id", "region", "leaveType", "daysPerYear", "isPaid", "requiresApproval", "maxCarryover", "description", "createdAt", "updatedAt") VALUES
('lp_ks_pto', 'KANSAS_USA', 'PTO', 15, true, true, 5, 'Paid Time Off - Vacation, Sick, Personal combined', NOW(), NOW()),
('lp_ks_parental', 'KANSAS_USA', 'PARENTAL', 20, true, true, 0, 'Parental leave (4 weeks)', NOW(), NOW()),
('lp_ks_bereavement_imm', 'KANSAS_USA', 'BEREAVEMENT_IMMEDIATE', 5, true, true, 0, 'Bereavement - Immediate family (spouse, children, parents, siblings, grandparents)', NOW(), NOW()),
('lp_ks_bereavement_ext', 'KANSAS_USA', 'BEREAVEMENT_EXTENDED', 2, true, true, 0, 'Bereavement - Extended family', NOW(), NOW()),
('lp_ks_jury', 'KANSAS_USA', 'JURY_DUTY', 30, false, true, 0, 'Jury duty (unpaid, as needed)', NOW(), NOW()),
('lp_ks_unpaid', 'KANSAS_USA', 'UNPAID', 365, false, true, 0, 'Unpaid leave', NOW(), NOW());
