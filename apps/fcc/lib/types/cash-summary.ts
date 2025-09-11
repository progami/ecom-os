// Cash Summary Report TypeScript Interfaces

export interface CashSummaryLineItem {
  account: string
  amounts: {
    [period: string]: number // e.g., "May 2025": 110960.42
  }
}

export interface CashSummarySection {
  title: string
  items: CashSummaryLineItem[]
  total: CashSummaryLineItem
}

export interface CashSummaryReport {
  // Header Information
  title: string // "Cash Summary"
  companyName: string // "TRADEMAN ENTERPRISE LTD"
  periodEnded: string // "For the month ended 31 May 2025"
  periods: string[] // ["May 2025", "Apr 2025", "Mar 2025", "Feb 2025", "Jan 2025"]
  
  // Main Sections
  income: {
    title: "Income"
    items: {
      amazonFBAInventoryReimbursement: CashSummaryLineItem
      amazonRefunds: CashSummaryLineItem
      amazonSalesLMB: CashSummaryLineItem
      wiseCashback: CashSummaryLineItem
    }
    totalIncome: CashSummaryLineItem
  }
  
  expenses: {
    title: "Less Expenses"
    items: {
      accounting: CashSummaryLineItem
      accountsPayable: CashSummaryLineItem
      amazonAdvertisingCosts: CashSummaryLineItem
      amazonFBAFees: CashSummaryLineItem
      amazonReservedBalances: CashSummaryLineItem
      amazonSellerFees: CashSummaryLineItem
      amazonSplitMonthRollovers: CashSummaryLineItem
      amazonStorageFees: CashSummaryLineItem
      bankFees: CashSummaryLineItem
      contractSalaries: CashSummaryLineItem
      directorsLoanAccount: CashSummaryLineItem
      directorsRemuneration: CashSummaryLineItem
      generalOperatingExpenses: CashSummaryLineItem
      interestPaid: CashSummaryLineItem
      itSoftware: CashSummaryLineItem
      landFreight: CashSummaryLineItem
      legalAndCompliance: CashSummaryLineItem
      lmbCostOfGoodsSold: CashSummaryLineItem
      lmbInventory: CashSummaryLineItem
      manufacturing: CashSummaryLineItem
      officeSupplies: CashSummaryLineItem
      overseasVAT: CashSummaryLineItem
      payeAndNicPayable: CashSummaryLineItem
      prepayments: CashSummaryLineItem
      researchAndDevelopment: CashSummaryLineItem
      rounding: CashSummaryLineItem
      storage3PL: CashSummaryLineItem
      targonLLC: CashSummaryLineItem
      telephoneAndInternet: CashSummaryLineItem
      travel: CashSummaryLineItem
    }
    totalExpenses: CashSummaryLineItem
  }
  
  surplusDeficit: CashSummaryLineItem // Income - Expenses
  
  otherCashMovements: {
    title: "Plus Other Cash Movements"
    items: {
      fixedAssets: CashSummaryLineItem
    }
    totalOtherCashMovements: CashSummaryLineItem
  }
  
  vatMovements: {
    title: "Plus VAT Movements"
    items: {
      vatCollected: CashSummaryLineItem
      vatPaid: CashSummaryLineItem
    }
    netVatMovements: CashSummaryLineItem
  }
  
  foreignCurrency: {
    title: "Plus Foreign Currency Gains and Losses"
    items: {
      realisedCurrencyGains: CashSummaryLineItem
    }
    totalForeignCurrencyGainsAndLosses: CashSummaryLineItem
  }
  
  netCashMovement: CashSummaryLineItem
  
  summary: {
    title: "Summary"
    openingBalance: CashSummaryLineItem
    plusNetCashMovement: CashSummaryLineItem
    currencyAdjustment: CashSummaryLineItem
    cashBalance: CashSummaryLineItem
  }
  
  // Exchange rates section (optional metadata)
  exchangeRates?: {
    [date: string]: {
      EUR: number
      PKR: number
      SEK: number
      USD: number
    }
  }
}

// Alternative simplified structure for API responses
export interface CashSummaryData {
  reportTitle: string
  companyName: string
  reportPeriod: string
  periods: string[]
  
  sections: {
    income: CashSummarySection
    expenses: CashSummarySection
    otherCashMovements: CashSummarySection
    vatMovements: CashSummarySection
    foreignCurrency: CashSummarySection
  }
  
  summary: {
    surplusDeficit: CashSummaryLineItem
    netCashMovement: CashSummaryLineItem
    openingBalance: CashSummaryLineItem
    currencyAdjustment: CashSummaryLineItem
    closingBalance: CashSummaryLineItem
  }
  
  metadata: {
    generatedAt: Date
    exchangeRates?: Record<string, Record<string, number>>
  }
}

// Enum for account categories to ensure consistency
export enum CashSummaryAccountCategory {
  // Income
  AMAZON_FBA_INVENTORY_REIMBURSEMENT = "Amazon FBA Inventory Reimbursement",
  AMAZON_REFUNDS = "Amazon Refunds",
  AMAZON_SALES_LMB = "Amazon Sales (LMB)",
  WISE_CASHBACK = "Wise Cashback",
  
  // Expenses
  ACCOUNTING = "Accounting",
  ACCOUNTS_PAYABLE = "Accounts Payable",
  AMAZON_ADVERTISING_COSTS = "Amazon Advertising Costs",
  AMAZON_FBA_FEES = "Amazon FBA Fees",
  AMAZON_RESERVED_BALANCES = "Amazon Reserved Balances",
  AMAZON_SELLER_FEES = "Amazon Seller Fees",
  AMAZON_SPLIT_MONTH_ROLLOVERS = "Amazon Split Month Rollovers",
  AMAZON_STORAGE_FEES = "Amazon Storage Fees",
  BANK_FEES = "Bank Fees",
  CONTRACT_SALARIES = "Contract Salaries",
  DIRECTORS_LOAN_ACCOUNT = "Directors' Loan Account",
  DIRECTORS_REMUNERATION = "Directors' Remuneration",
  GENERAL_OPERATING_EXPENSES = "General Operating Expenses",
  INTEREST_PAID = "Interest Paid",
  IT_SOFTWARE = "IT Software",
  LAND_FREIGHT = "Land Freight",
  LEGAL_AND_COMPLIANCE = "Legal and Compliance",
  LMB_COST_OF_GOODS_SOLD = "LMB Cost of Goods Sold",
  LMB_INVENTORY = "LMB Inventory",
  MANUFACTURING = "Manufacturing",
  OFFICE_SUPPLIES = "Office Supplies",
  OVERSEAS_VAT = "Overseas VAT",
  PAYE_NIC_PAYABLE = "PAYE & NIC Payable",
  PREPAYMENTS = "Prepayments",
  RESEARCH_DEVELOPMENT = "Research & Development",
  ROUNDING = "Rounding",
  STORAGE_3PL = "Storage 3PL",
  TARGON_LLC = "Targon LLC",
  TELEPHONE_INTERNET = "Telephone & Internet",
  TRAVEL = "Travel",
  
  // Other Cash Movements
  FIXED_ASSETS = "Fixed Assets",
  
  // VAT
  VAT_COLLECTED = "VAT Collected",
  VAT_PAID = "VAT Paid",
  
  // Foreign Currency
  REALISED_CURRENCY_GAINS = "Realised Currency Gains"
}