-- CreateEnum
CREATE TYPE "TenantCode" AS ENUM ('US', 'UK');

-- AlterEnum (remove finance from UserRole)
-- Note: This requires no data with 'finance' role exists
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('admin', 'staff');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
DROP TYPE "UserRole_old";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "region" "TenantCode" NOT NULL DEFAULT 'US';
