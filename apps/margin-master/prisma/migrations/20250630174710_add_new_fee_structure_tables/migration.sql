-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" CHAR(2) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "region" VARCHAR(50),
    "currency" VARCHAR(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "size_tiers" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "maxLengthCm" DECIMAL(10,2),
    "maxWidthCm" DECIMAL(10,2),
    "maxHeightCm" DECIMAL(10,2),
    "maxDimensionsCm" DECIMAL(10,2),
    "maxWeightG" DECIMAL(10,2),
    "isOversized" BOOLEAN NOT NULL DEFAULT false,
    "isApparel" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_bands" (
    "id" TEXT NOT NULL,
    "minWeightG" DECIMAL(10,2) NOT NULL,
    "maxWeightG" DECIMAL(10,2),
    "unit" VARCHAR(10) NOT NULL DEFAULT 'g',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fulfilment_fees" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sizeTierId" TEXT NOT NULL,
    "weightBandId" TEXT,
    "baseFee" DECIMAL(10,4) NOT NULL,
    "perUnitFee" DECIMAL(10,4),
    "perUnitWeight" DECIMAL(10,4),
    "currency" VARCHAR(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isApparel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fulfilment_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_fees_new" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "periodType" VARCHAR(50) NOT NULL,
    "monthStart" INTEGER,
    "monthEnd" INTEGER,
    "periodLabel" VARCHAR(100) NOT NULL,
    "standardSizeFee" DECIMAL(10,4) NOT NULL,
    "oversizeFee" DECIMAL(10,4) NOT NULL,
    "feeUnit" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_fees_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_fees_new" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "category" VARCHAR(500) NOT NULL,
    "subcategory" VARCHAR(200),
    "feePercentage" DECIMAL(5,2) NOT NULL,
    "minimumFee" DECIMAL(10,2),
    "perItemMinimum" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_fees_new_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "optional_services" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "serviceCode" VARCHAR(50) NOT NULL,
    "serviceName" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "feeAmount" DECIMAL(10,4) NOT NULL,
    "feeType" VARCHAR(50) NOT NULL,
    "feeUnit" VARCHAR(50),
    "currency" VARCHAR(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "optional_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surcharges" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "surchargeType" VARCHAR(100) NOT NULL,
    "surchargeName" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "condition" VARCHAR(500),
    "feeAmount" DECIMAL(10,4) NOT NULL,
    "feePercentage" DECIMAL(5,2),
    "feeType" VARCHAR(50) NOT NULL,
    "feeUnit" VARCHAR(50),
    "currency" VARCHAR(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surcharges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE INDEX "countries_code_idx" ON "countries"("code");

-- CreateIndex
CREATE INDEX "countries_region_idx" ON "countries"("region");

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "programs_code_idx" ON "programs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "size_tiers_code_key" ON "size_tiers"("code");

-- CreateIndex
CREATE INDEX "size_tiers_code_idx" ON "size_tiers"("code");

-- CreateIndex
CREATE INDEX "weight_bands_minWeightG_maxWeightG_idx" ON "weight_bands"("minWeightG", "maxWeightG");

-- CreateIndex
CREATE INDEX "fulfilment_fees_countryId_programId_sizeTierId_weightBandId_idx" ON "fulfilment_fees"("countryId", "programId", "sizeTierId", "weightBandId");

-- CreateIndex
CREATE INDEX "fulfilment_fees_effectiveDate_endDate_idx" ON "fulfilment_fees"("effectiveDate", "endDate");

-- CreateIndex
CREATE INDEX "storage_fees_new_countryId_programId_idx" ON "storage_fees_new"("countryId", "programId");

-- CreateIndex
CREATE INDEX "storage_fees_new_effectiveDate_endDate_idx" ON "storage_fees_new"("effectiveDate", "endDate");

-- CreateIndex
CREATE INDEX "referral_fees_new_countryId_programId_category_idx" ON "referral_fees_new"("countryId", "programId", "category");

-- CreateIndex
CREATE INDEX "referral_fees_new_effectiveDate_endDate_idx" ON "referral_fees_new"("effectiveDate", "endDate");

-- CreateIndex
CREATE INDEX "optional_services_countryId_programId_serviceCode_idx" ON "optional_services"("countryId", "programId", "serviceCode");

-- CreateIndex
CREATE INDEX "optional_services_effectiveDate_endDate_idx" ON "optional_services"("effectiveDate", "endDate");

-- CreateIndex
CREATE INDEX "surcharges_countryId_programId_surchargeType_idx" ON "surcharges"("countryId", "programId", "surchargeType");

-- CreateIndex
CREATE INDEX "surcharges_effectiveDate_endDate_idx" ON "surcharges"("effectiveDate", "endDate");

-- AddForeignKey
ALTER TABLE "fulfilment_fees" ADD CONSTRAINT "fulfilment_fees_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfilment_fees" ADD CONSTRAINT "fulfilment_fees_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfilment_fees" ADD CONSTRAINT "fulfilment_fees_sizeTierId_fkey" FOREIGN KEY ("sizeTierId") REFERENCES "size_tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fulfilment_fees" ADD CONSTRAINT "fulfilment_fees_weightBandId_fkey" FOREIGN KEY ("weightBandId") REFERENCES "weight_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_fees_new" ADD CONSTRAINT "storage_fees_new_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_fees_new" ADD CONSTRAINT "storage_fees_new_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_fees_new" ADD CONSTRAINT "referral_fees_new_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_fees_new" ADD CONSTRAINT "referral_fees_new_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "optional_services" ADD CONSTRAINT "optional_services_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surcharges" ADD CONSTRAINT "surcharges_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surcharges" ADD CONSTRAINT "surcharges_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
