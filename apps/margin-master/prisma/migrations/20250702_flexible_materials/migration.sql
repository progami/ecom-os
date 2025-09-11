-- AlterTable
ALTER TABLE "material_profiles" 
ADD COLUMN "costPerUnit" DECIMAL(10,4) DEFAULT 0,
ADD COLUMN "costUnit" TEXT DEFAULT 'area',
ADD COLUMN "notes" TEXT;

-- Copy existing costPerArea to costPerUnit
UPDATE "material_profiles" SET "costPerUnit" = "costPerArea";

-- Drop the old column
ALTER TABLE "material_profiles" DROP COLUMN "costPerArea";