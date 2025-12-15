-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UPHELD', 'OVERTURNED', 'MODIFIED');

-- AlterTable
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealReason" TEXT;
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealedAt" TIMESTAMP(3);
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealStatus" "AppealStatus";
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealResolution" TEXT;
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealResolvedAt" TIMESTAMP(3);
ALTER TABLE "DisciplinaryAction" ADD COLUMN "appealResolvedById" TEXT;
