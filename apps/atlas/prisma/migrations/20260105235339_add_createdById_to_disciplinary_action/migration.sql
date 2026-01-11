-- AlterTable
ALTER TABLE "DisciplinaryAction" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "DisciplinaryAction_createdById_idx" ON "DisciplinaryAction"("createdById");

-- AddForeignKey
ALTER TABLE "DisciplinaryAction" ADD CONSTRAINT "DisciplinaryAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
