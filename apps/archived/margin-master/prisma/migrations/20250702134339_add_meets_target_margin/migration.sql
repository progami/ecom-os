/*
  Warnings:

  - Made the column `costPerUnit` on table `material_profiles` required. This step will fail if there are existing NULL values in that column.
  - Made the column `costUnit` on table `material_profiles` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "generated_combinations" ADD COLUMN     "meetsTargetMargin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "material_profiles" ALTER COLUMN "costPerUnit" SET NOT NULL,
ALTER COLUMN "costUnit" SET NOT NULL;
