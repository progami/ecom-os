-- AlterTable
ALTER TABLE "atlas"."DisciplinaryAction" ADD COLUMN "createdById" TEXT;

-- CreateIndex
CREATE INDEX "DisciplinaryAction_createdById_idx" ON "atlas"."DisciplinaryAction"("createdById");

-- AddForeignKey
ALTER TABLE "atlas"."DisciplinaryAction" ADD CONSTRAINT "DisciplinaryAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "atlas"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
