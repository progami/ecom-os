-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bankTransactionId" TEXT,
ADD COLUMN     "isActual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalForecast" DECIMAL(10,2),
ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Revenue" ADD COLUMN     "bankTransactionId" TEXT,
ADD COLUMN     "isActual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalForecast" DECIMAL(10,2),
ADD COLUMN     "reconciledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReconciliationStatus" (
    "id" TEXT NOT NULL,
    "lastReconciledDate" TIMESTAMP(3) NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "bankName" TEXT,
    "fileName" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "transactionCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastDefinition" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "sku" TEXT,
    "description" TEXT NOT NULL,
    "baseAmount" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION,
    "frequency" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationStatus_isActive_idx" ON "ReconciliationStatus"("isActive");

-- CreateIndex
CREATE INDEX "ForecastDefinition_type_category_idx" ON "ForecastDefinition"("type", "category");

-- CreateIndex
CREATE INDEX "ForecastDefinition_isActive_startDate_idx" ON "ForecastDefinition"("isActive", "startDate");

-- CreateIndex
CREATE INDEX "Expense_isActual_idx" ON "Expense"("isActual");

-- CreateIndex
CREATE INDEX "Expense_bankTransactionId_idx" ON "Expense"("bankTransactionId");

-- CreateIndex
CREATE INDEX "Revenue_isActual_idx" ON "Revenue"("isActual");

-- CreateIndex
CREATE INDEX "Revenue_bankTransactionId_idx" ON "Revenue"("bankTransactionId");
