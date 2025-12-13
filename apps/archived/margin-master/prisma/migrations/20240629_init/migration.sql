-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryOfOrigin" CHAR(2),
    "costPerArea" DECIMAL(10,4) NOT NULL,
    "densityGCm3" DECIMAL(10,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sourcing_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryOfOrigin" CHAR(2),
    "tariffRatePercent" DECIMAL(5,2) NOT NULL,
    "freightAssumptionCost" DECIMAL(10,2),
    "freightUnit" VARCHAR(50),
    "costBufferPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sourcing_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketplace" VARCHAR(10) NOT NULL,
    "targetSalePrice" DECIMAL(10,2) NOT NULL,
    "estimatedAcosPercent" DECIMAL(5,2) NOT NULL,
    "refundProvisionPercent" DECIMAL(5,2) NOT NULL,
    "sourcingProfileId" TEXT NOT NULL,
    "components" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_fees" (
    "id" SERIAL NOT NULL,
    "sizeTierName" VARCHAR(100) NOT NULL,
    "lengthLimitCm" DECIMAL(10,2) NOT NULL,
    "widthLimitCm" DECIMAL(10,2) NOT NULL,
    "heightLimitCm" DECIMAL(10,2) NOT NULL,
    "tierUnitWeightLimitKg" DECIMAL(10,2),
    "tierDimWeightLimitKg" DECIMAL(10,2),
    "rateWeightLowerBoundKg" DECIMAL(10,2) NOT NULL,
    "rateWeightUpperBoundKg" DECIMAL(10,2) NOT NULL,
    "marketplace" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fee" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standard_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "low_price_fees" (
    "id" SERIAL NOT NULL,
    "programName" VARCHAR(100) NOT NULL,
    "sizeTierName" VARCHAR(100) NOT NULL,
    "lengthLimitCm" DECIMAL(10,2) NOT NULL,
    "widthLimitCm" DECIMAL(10,2) NOT NULL,
    "heightLimitCm" DECIMAL(10,2) NOT NULL,
    "rateWeightLowerBoundKg" DECIMAL(10,2) NOT NULL,
    "rateWeightUpperBoundKg" DECIMAL(10,2) NOT NULL,
    "marketplace" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fee" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "low_price_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sipp_discounts" (
    "id" SERIAL NOT NULL,
    "programName" VARCHAR(100) NOT NULL,
    "sizeTierName" VARCHAR(100) NOT NULL,
    "rateWeightLowerBoundKg" DECIMAL(10,2) NOT NULL,
    "rateWeightUpperBoundKg" DECIMAL(10,2) NOT NULL,
    "marketplace" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "discount" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sipp_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_fees" (
    "id" TEXT NOT NULL,
    "marketplaceGroup" VARCHAR(100) NOT NULL,
    "productSize" VARCHAR(50) NOT NULL,
    "productCategory" VARCHAR(200) NOT NULL,
    "period" VARCHAR(50) NOT NULL,
    "unitOfMeasure" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fee" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_fees" (
    "id" TEXT NOT NULL,
    "marketplaceGroup" VARCHAR(100) NOT NULL,
    "productCategory" VARCHAR(500) NOT NULL,
    "subCategory" VARCHAR(200),
    "condition" VARCHAR(100),
    "feeType" VARCHAR(50) NOT NULL,
    "priceLowerBound" DECIMAL(10,2) NOT NULL,
    "priceUpperBound" DECIMAL(10,2) NOT NULL,
    "feePercentage" DECIMAL(5,2) NOT NULL,
    "maxFee" DECIMAL(10,2),
    "minReferralFee" DECIMAL(10,2) NOT NULL,
    "mediaClosingFee" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "low_inventory_fees" (
    "id" SERIAL NOT NULL,
    "tierGroup" VARCHAR(200) NOT NULL,
    "tierWeightLimitKg" DECIMAL(10,2) NOT NULL,
    "daysOfSupplyLowerBound" INTEGER NOT NULL,
    "daysOfSupplyUpperBound" INTEGER NOT NULL,
    "marketplaceGroup" VARCHAR(100) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "fee" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "low_inventory_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_sourcingProfileId_fkey" FOREIGN KEY ("sourcingProfileId") REFERENCES "sourcing_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

