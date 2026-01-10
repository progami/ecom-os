-- Document vault metadata (S3 key stored in fileUrl) + visibility controls.

-- EmployeeFile visibility
CREATE TYPE "EmployeeFileVisibility" AS ENUM ('HR_ONLY', 'EMPLOYEE_AND_HR');

ALTER TABLE "EmployeeFile"
ADD COLUMN "fileName" TEXT,
ADD COLUMN "contentType" TEXT,
ADD COLUMN "size" INTEGER,
ADD COLUMN "visibility" "EmployeeFileVisibility" NOT NULL DEFAULT 'HR_ONLY',
ADD COLUMN "uploadedById" TEXT;

CREATE INDEX "EmployeeFile_uploadedById_idx" ON "EmployeeFile"("uploadedById");

ALTER TABLE "EmployeeFile"
ADD CONSTRAINT "EmployeeFile_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "Employee"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- CaseAttachment metadata + visibility
ALTER TABLE "CaseAttachment"
ADD COLUMN "fileName" TEXT,
ADD COLUMN "contentType" TEXT,
ADD COLUMN "size" INTEGER,
ADD COLUMN "visibility" "CaseNoteVisibility" NOT NULL DEFAULT 'INTERNAL_HR';

CREATE INDEX "CaseAttachment_visibility_idx" ON "CaseAttachment"("visibility");

