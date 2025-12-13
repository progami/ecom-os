-- AlterTable
ALTER TABLE "sourcing_profiles" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shippingCostPerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tariffPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "generated_combinations" ADD CONSTRAINT "generated_combinations_materialProfileId_fkey" FOREIGN KEY ("materialProfileId") REFERENCES "material_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_combinations" ADD CONSTRAINT "generated_combinations_sourcingProfileId_fkey" FOREIGN KEY ("sourcingProfileId") REFERENCES "sourcing_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_combinations" ADD CONSTRAINT "generated_combinations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "generation_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
