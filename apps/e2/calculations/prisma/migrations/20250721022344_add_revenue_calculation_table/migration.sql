-- CreateTable
CREATE TABLE "RevenueCalculation" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "grossRevenue" DOUBLE PRECISION NOT NULL,
    "manufacturingCost" DOUBLE PRECISION NOT NULL,
    "freightCost" DOUBLE PRECISION NOT NULL,
    "tariffCost" DOUBLE PRECISION NOT NULL,
    "warehouseCost" DOUBLE PRECISION NOT NULL,
    "fbaFee" DOUBLE PRECISION NOT NULL,
    "amazonReferralFee" DOUBLE PRECISION NOT NULL,
    "returnAllowance" DOUBLE PRECISION NOT NULL,
    "totalCOGS" DOUBLE PRECISION NOT NULL,
    "netRevenue" DOUBLE PRECISION NOT NULL,
    "marginPercent" DOUBLE PRECISION NOT NULL,
    "sourceType" TEXT NOT NULL,
    "batchId" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevenueCalculation_date_idx" ON "RevenueCalculation"("date");

-- CreateIndex
CREATE INDEX "RevenueCalculation_sku_idx" ON "RevenueCalculation"("sku");

-- CreateIndex
CREATE INDEX "RevenueCalculation_sourceType_idx" ON "RevenueCalculation"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueCalculation_date_sku_key" ON "RevenueCalculation"("date", "sku");
