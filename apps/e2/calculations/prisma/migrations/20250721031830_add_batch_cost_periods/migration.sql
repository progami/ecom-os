-- CreateTable
CREATE TABLE "BatchCostPeriod" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "manufacturingCost" DOUBLE PRECISION NOT NULL,
    "freightCost" DOUBLE PRECISION NOT NULL,
    "tariffCost" DOUBLE PRECISION NOT NULL,
    "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitLandedCost" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchCostPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BatchCostPeriod_sku_startDate_idx" ON "BatchCostPeriod"("sku", "startDate");

-- CreateIndex
CREATE INDEX "BatchCostPeriod_sku_endDate_idx" ON "BatchCostPeriod"("sku", "endDate");

-- CreateIndex
CREATE INDEX "BatchCostPeriod_isActive_idx" ON "BatchCostPeriod"("isActive");
