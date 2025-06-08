-- CreateTable
CREATE TABLE "CategorizationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "matchType" TEXT NOT NULL,
    "matchField" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorizationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CategorizationRule_isActive_priority_idx" ON "CategorizationRule"("isActive", "priority");