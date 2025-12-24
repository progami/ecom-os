-- Add roleTitle to PerformanceReview and backfill from Employee.position.

ALTER TABLE "PerformanceReview" ADD COLUMN "roleTitle" TEXT;

UPDATE "PerformanceReview" pr
SET "roleTitle" = e."position"
FROM "Employee" e
WHERE pr."employeeId" = e."id" AND pr."roleTitle" IS NULL;

-- Safety fallback (should not happen, but guarantees NOT NULL enforcement).
UPDATE "PerformanceReview"
SET "roleTitle" = 'Unknown'
WHERE "roleTitle" IS NULL;

ALTER TABLE "PerformanceReview" ALTER COLUMN "roleTitle" SET NOT NULL;

CREATE INDEX "PerformanceReview_roleTitle_idx" ON "PerformanceReview"("roleTitle");
CREATE INDEX "PerformanceReview_employeeId_roleTitle_periodType_periodYear_idx"
  ON "PerformanceReview"("employeeId", "roleTitle", "periodType", "periodYear");
