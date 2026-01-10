-- Link disciplinary actions to Cases (Cases becomes the parent IA for violations).

ALTER TABLE "DisciplinaryAction"
ADD COLUMN "caseId" TEXT;

CREATE UNIQUE INDEX "DisciplinaryAction_caseId_key" ON "DisciplinaryAction"("caseId");

ALTER TABLE "DisciplinaryAction"
ADD CONSTRAINT "DisciplinaryAction_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "Case"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

