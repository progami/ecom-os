-- CreateTable
CREATE TABLE "pack_size_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizes" INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_size_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_steps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "startValue" DOUBLE PRECISION NOT NULL,
    "endValue" DOUBLE PRECISION NOT NULL,
    "stepSize" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'cm',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_steps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startWeight" DOUBLE PRECISION NOT NULL,
    "endWeight" DOUBLE PRECISION NOT NULL,
    "stepSize" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'g',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weight_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combination_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "materialProfileId" TEXT,
    "packSizeTemplateId" TEXT,
    "dimensionSteps" JSONB NOT NULL,
    "weightSteps" JSONB NOT NULL,
    "priceRange" JSONB NOT NULL,
    "targetMarginPercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combination_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_combinations" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "materialProfileId" TEXT NOT NULL,
    "sourcingProfileId" TEXT NOT NULL,
    "sizeTier" TEXT NOT NULL,
    "landedCost" DOUBLE PRECISION NOT NULL,
    "fbaFee" DOUBLE PRECISION NOT NULL,
    "referralFee" DOUBLE PRECISION NOT NULL,
    "netMarginPercent" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "profitPerUnit" DOUBLE PRECISION NOT NULL,
    "tierEfficiency" DOUBLE PRECISION NOT NULL,
    "marginRank" INTEGER,
    "opportunity" TEXT,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_combinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCombinations" INTEGER NOT NULL DEFAULT 0,
    "completedCombinations" INTEGER NOT NULL DEFAULT 0,
    "rules" JSONB NOT NULL,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "generation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generated_combinations_batchId_netMarginPercent_idx" ON "generated_combinations"("batchId", "netMarginPercent");

-- CreateIndex
CREATE INDEX "generated_combinations_batchId_roi_idx" ON "generated_combinations"("batchId", "roi");

-- CreateIndex
CREATE INDEX "generated_combinations_batchId_sizeTier_idx" ON "generated_combinations"("batchId", "sizeTier");
