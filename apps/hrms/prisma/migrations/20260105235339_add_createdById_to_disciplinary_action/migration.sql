-- AlterTable
ALTER TABLE "hrms"."DisciplinaryAction" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "DisciplinaryAction_createdById_idx" ON "hrms"."DisciplinaryAction"("createdById");

-- AddForeignKey
ALTER TABLE "hrms"."DisciplinaryAction" ADD CONSTRAINT "DisciplinaryAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "hrms"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
