-- Create Enums
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','INTERN');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE','ON_LEAVE','TERMINATED','RESIGNED');
CREATE TYPE "ResourceCategory" AS ENUM ('ACCOUNTING','LEGAL','DESIGN','MARKETING','IT','HR','OTHER');
CREATE TYPE "PolicyCategory" AS ENUM ('LEAVE','PERFORMANCE','CONDUCT','SECURITY','COMPENSATION','OTHER');
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT','ACTIVE','ARCHIVED');

-- Employee
CREATE TABLE "Employee" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL UNIQUE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT,
  "avatar" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "gender" TEXT,
  "maritalStatus" TEXT,
  "nationality" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "postalCode" TEXT,
  "department" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
  "joinDate" TIMESTAMP(3) NOT NULL,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "reportsTo" TEXT,
  "salary" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "emergencyContact" TEXT,
  "emergencyPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Employee_email_idx" ON "Employee" ("email");
CREATE INDEX "Employee_employeeId_idx" ON "Employee" ("employeeId");
CREATE INDEX "Employee_department_idx" ON "Employee" ("department");
CREATE INDEX "Employee_status_idx" ON "Employee" ("status");

-- Resource (Service Providers)
CREATE TABLE "Resource" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" "ResourceCategory" NOT NULL,
  "description" TEXT,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "address" TEXT,
  "city" TEXT,
  "country" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "rating" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Resource_category_idx" ON "Resource" ("category");
CREATE INDEX "Resource_name_idx" ON "Resource" ("name");

-- Policy
CREATE TABLE "Policy" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "category" "PolicyCategory" NOT NULL,
  "summary" TEXT,
  "content" TEXT,
  "fileUrl" TEXT,
  "version" TEXT,
  "effectiveDate" TIMESTAMP(3),
  "status" "PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "Policy_category_idx" ON "Policy" ("category");
CREATE INDEX "Policy_status_idx" ON "Policy" ("status");

