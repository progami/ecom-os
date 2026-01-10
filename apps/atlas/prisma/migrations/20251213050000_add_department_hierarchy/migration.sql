-- Add department hierarchy fields
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "kpi" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headId" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- Add foreign key for department head
ALTER TABLE "Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add self-referential foreign key for department hierarchy
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "Department_headId_idx" ON "Department"("headId");
CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");
