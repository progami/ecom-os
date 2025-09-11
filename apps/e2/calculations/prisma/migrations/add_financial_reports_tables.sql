-- CreateTable
CREATE TABLE "IncomeStatement" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    
    -- Revenue
    "amazonSales" DECIMAL(12,2) DEFAULT 0,
    "amazonFbaInventoryReimbursement" DECIMAL(12,2) DEFAULT 0,
    "cashbackRewards" DECIMAL(12,2) DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) DEFAULT 0,
    
    -- Cost of Goods Sold
    "costOfGoodsSold" DECIMAL(12,2) DEFAULT 0,
    "manufacturing" DECIMAL(12,2) DEFAULT 0,
    "freightCustomDuty" DECIMAL(12,2) DEFAULT 0,
    "landFreight" DECIMAL(12,2) DEFAULT 0,
    "storage3pl" DECIMAL(12,2) DEFAULT 0,
    "vatTariffs" DECIMAL(12,2) DEFAULT 0,
    "totalCOGS" DECIMAL(12,2) DEFAULT 0,
    "grossProfit" DECIMAL(12,2) DEFAULT 0,
    
    -- Amazon/Marketplace Expenses
    "amazonSellerFees" DECIMAL(12,2) DEFAULT 0,
    "amazonFbaFees" DECIMAL(12,2) DEFAULT 0,
    "amazonStorageFees" DECIMAL(12,2) DEFAULT 0,
    "inventoryAdjustments" DECIMAL(12,2) DEFAULT 0,
    "refunds" DECIMAL(12,2) DEFAULT 0,
    "referralFees" DECIMAL(12,2) DEFAULT 0,
    "totalAmazonExpenses" DECIMAL(12,2) DEFAULT 0,
    
    -- Operating Expenses
    "payroll" DECIMAL(12,2) DEFAULT 0,
    "payrollTax" DECIMAL(12,2) DEFAULT 0,
    "contractSalaries" DECIMAL(12,2) DEFAULT 0,
    "freelanceServices" DECIMAL(12,2) DEFAULT 0,
    "membersRemuneration" DECIMAL(12,2) DEFAULT 0,
    "rent" DECIMAL(12,2) DEFAULT 0,
    "utilities" DECIMAL(12,2) DEFAULT 0,
    "telephoneInternet" DECIMAL(12,2) DEFAULT 0,
    "officeSupplies" DECIMAL(12,2) DEFAULT 0,
    "insurance" DECIMAL(12,2) DEFAULT 0,
    "advertising" DECIMAL(12,2) DEFAULT 0,
    "professionalFees" DECIMAL(12,2) DEFAULT 0,
    "legalCompliance" DECIMAL(12,2) DEFAULT 0,
    "accounting" DECIMAL(12,2) DEFAULT 0,
    "itSoftware" DECIMAL(12,2) DEFAULT 0,
    "researchDevelopment" DECIMAL(12,2) DEFAULT 0,
    "bankFees" DECIMAL(12,2) DEFAULT 0,
    "interestPaid" DECIMAL(12,2) DEFAULT 0,
    "bankRevaluations" DECIMAL(12,2) DEFAULT 0,
    "unrealisedCurrencyGains" DECIMAL(12,2) DEFAULT 0,
    "realisedCurrencyGains" DECIMAL(12,2) DEFAULT 0,
    "travel" DECIMAL(12,2) DEFAULT 0,
    "mealsEntertainment" DECIMAL(12,2) DEFAULT 0,
    "depreciationExpense" DECIMAL(12,2) DEFAULT 0,
    "generalOperatingExpenses" DECIMAL(12,2) DEFAULT 0,
    "otherExpenses" DECIMAL(12,2) DEFAULT 0,
    "totalOperatingExpenses" DECIMAL(12,2) DEFAULT 0,
    
    -- Totals
    "totalExpenses" DECIMAL(12,2) DEFAULT 0,
    "netIncome" DECIMAL(12,2) DEFAULT 0,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable  
CREATE TABLE "BalanceSheet" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    
    -- Assets
    "businessBankAccount" DECIMAL(12,2) DEFAULT 0,
    "inventory" DECIMAL(12,2) DEFAULT 0,
    "prepayments" DECIMAL(12,2) DEFAULT 0,
    "amazonReceivable" DECIMAL(12,2) DEFAULT 0,
    "amazonReservedBalances" DECIMAL(12,2) DEFAULT 0,
    "amazonSplitMonthRollovers" DECIMAL(12,2) DEFAULT 0,
    "otherDebtors" DECIMAL(12,2) DEFAULT 0,
    "officeEquipment" DECIMAL(12,2) DEFAULT 0,
    "accumulatedDepreciation" DECIMAL(12,2) DEFAULT 0,
    "totalAssets" DECIMAL(12,2) DEFAULT 0,
    
    -- Liabilities
    "salesTaxPayable" DECIMAL(12,2) DEFAULT 0,
    "payrollTaxPayable" DECIMAL(12,2) DEFAULT 0,
    "membersLoanAccount" DECIMAL(12,2) DEFAULT 0,
    "rounding" DECIMAL(12,2) DEFAULT 0,
    "totalLiabilities" DECIMAL(12,2) DEFAULT 0,
    
    -- Equity
    "memberInvestmentJarrar" DECIMAL(12,2) DEFAULT 0,
    "memberInvestmentAbdul" DECIMAL(12,2) DEFAULT 0,
    "memberInvestmentAmjad" DECIMAL(12,2) DEFAULT 0,
    "capitalMemberUnits" DECIMAL(12,2) DEFAULT 0,
    "retainedEarnings" DECIMAL(12,2) DEFAULT 0,
    "memberDistributions" DECIMAL(12,2) DEFAULT 0,
    "totalEquity" DECIMAL(12,2) DEFAULT 0,
    
    "totalLiabilitiesEquity" DECIMAL(12,2) DEFAULT 0,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashFlowStatement" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    
    -- Operating Activities
    "netIncome" DECIMAL(12,2) DEFAULT 0,
    "depreciationAmortization" DECIMAL(12,2) DEFAULT 0,
    "changeInInventory" DECIMAL(12,2) DEFAULT 0,
    "changeInAmazonReceivable" DECIMAL(12,2) DEFAULT 0,
    "changeInPrepayments" DECIMAL(12,2) DEFAULT 0,
    "changeInOtherDebtors" DECIMAL(12,2) DEFAULT 0,
    "changeInSalesTaxPayable" DECIMAL(12,2) DEFAULT 0,
    "changeInPayrollTaxPayable" DECIMAL(12,2) DEFAULT 0,
    "changeInMembersLoanAccount" DECIMAL(12,2) DEFAULT 0,
    "netCashFromOperating" DECIMAL(12,2) DEFAULT 0,
    
    -- Investing Activities
    "purchaseOfficeEquipment" DECIMAL(12,2) DEFAULT 0,
    "netCashFromInvesting" DECIMAL(12,2) DEFAULT 0,
    
    -- Financing Activities
    "memberInvestments" DECIMAL(12,2) DEFAULT 0,
    "memberDistributions" DECIMAL(12,2) DEFAULT 0,
    "netCashFromFinancing" DECIMAL(12,2) DEFAULT 0,
    
    -- Cash Flow Summary
    "netChangeInCash" DECIMAL(12,2) DEFAULT 0,
    "beginningCashBalance" DECIMAL(12,2) DEFAULT 0,
    "endingCashBalance" DECIMAL(12,2) DEFAULT 0,
    
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashFlowStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IncomeStatement_strategyId_idx" ON "IncomeStatement"("strategyId");
CREATE INDEX "IncomeStatement_period_idx" ON "IncomeStatement"("period");
CREATE UNIQUE INDEX "IncomeStatement_strategyId_period_key" ON "IncomeStatement"("strategyId", "period");

CREATE INDEX "BalanceSheet_strategyId_idx" ON "BalanceSheet"("strategyId");
CREATE INDEX "BalanceSheet_period_idx" ON "BalanceSheet"("period");
CREATE UNIQUE INDEX "BalanceSheet_strategyId_period_key" ON "BalanceSheet"("strategyId", "period");

CREATE INDEX "CashFlowStatement_strategyId_idx" ON "CashFlowStatement"("strategyId");
CREATE INDEX "CashFlowStatement_period_idx" ON "CashFlowStatement"("period");
CREATE UNIQUE INDEX "CashFlowStatement_strategyId_period_key" ON "CashFlowStatement"("strategyId", "period");

