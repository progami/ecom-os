/**
 * E2 Conservative Strategy - Business Logic Configuration
 * 
 * Centralized configuration for all business rules, constants, and parameters
 * used throughout the E2 Conservative strategy implementation.
 */

// ============================================
// API CONFIGURATION
// ============================================

export const API_BASE = 'http://localhost:4321/api'

// ============================================
// TIMELINE CONFIGURATION
// ============================================

export const TIMELINE = {
  // Business timeline
  START_YEAR: 2025,
  END_YEAR: 2030,
  BUSINESS_START_WEEK: 40, // W40 2025 - actual business operations start
  PREPARATION_START_WEEK: 35, // W35 2025 - preparation phase (August 27, 2025)
  
  // Key dates
  OPENING_BALANCE_DATE: '2025-08-15', // Initial cash contribution
  OPENING_BALANCE_REFERENCE: 'OPENING-2025',
  
  // Fiscal periods
  getYearRange: () => {
    const years = []
    for (let year = TIMELINE.START_YEAR; year <= TIMELINE.END_YEAR; year++) {
      years.push(year)
    }
    return years
  }
}

// ============================================
// FINANCIAL CONFIGURATION
// ============================================

export const FINANCIAL = {
  // Opening balance
  OPENING_CASH_BALANCE: 81102, // $81,102 initial cash
  
  // Cashback configuration
  CASHBACK_RATE: 0.015, // 1.5% credit card cashback
  CASHBACK_ELIGIBLE_EXCLUDES: ['4010', '5025', '5050', '5100', '5110', '5720'], // Exclude refunds, inventory adjustments, referral fees (paid by Amazon), payroll, payroll taxes, depreciation
  FULFILLMENT_CREDIT_CARD_PERCENTAGE: 0.061, // 6.1% of fulfillment fees are through 3PL that accepts credit cards
  
  // Refund rates
  DEFAULT_REFUND_RATE: 0.015, // 1.5% refund rate for products
  
  // Depreciation
  DEPRECIATION_RATE: 0.20, // 20% annual depreciation on equipment
  
  // Inventory adjustments - start from when business operations begin
  INVENTORY_ADJUSTMENT_START_DATE: (year: number) => 
    year === 2025 ? '2025-09-01' : `${year}-01-01` // September 1st to capture W36 orders
}

// ============================================
// INITIAL ORDERS CONFIGURATION
// ============================================

export const INITIAL_ORDERS = {
  // W36 2025 - First shipment (moved from W43)
  WEEK_36_ORDERS: [
    { week: 36, year: 2025, quarter: 3, sku: '6PK - 7M', quantity: 29440 },
    { week: 36, year: 2025, quarter: 3, sku: '12PK - 7M', quantity: 9696 },
    { week: 36, year: 2025, quarter: 3, sku: '1PK - 32M', quantity: 4032 },
    { week: 36, year: 2025, quarter: 3, sku: '3PK - 32M', quantity: 1950 }
  ],
  
  // W2 2026 - Second shipment (moved from W43 2025)
  WEEK_2_2026_ORDERS: [
    { week: 2, year: 2026, quarter: 1, sku: '6PK - 7M', quantity: 12544 },
    { week: 2, year: 2026, quarter: 1, sku: '12PK - 7M', quantity: 4096 },
    { week: 2, year: 2026, quarter: 1, sku: '1PK - 32M', quantity: 1680 },
    { week: 2, year: 2026, quarter: 1, sku: '3PK - 32M', quantity: 840 }
  ],
  
  // Combined initial orders
  getAllInitialOrders: () => [
    ...INITIAL_ORDERS.WEEK_36_ORDERS,
    ...INITIAL_ORDERS.WEEK_2_2026_ORDERS
  ]
}

// ============================================
// ORDERING RULES
// ============================================

export const ORDERING_RULES = {
  MIN_STOCK_WEEKS: 4, // Order when stock falls below 4 weeks
  ORDER_HORIZON_WEEKS: 14, // Order quantity covers next 14 weeks of demand
  LEAD_TIME_WEEKS: 0 // Immediate delivery (for simplicity)
}

// ============================================
// EXPENSE RULES CONFIGURATION
// ============================================

export const EXPENSE_RULES = {
  // Contract salaries progression
  CONTRACT_SALARIES: {
    BASE_MONTHLY: 1692, // Base team monthly cost
    CONTRACTOR_MONTHLY: 1080, // Additional contractor monthly cost
    START_YEAR_CONTRACTORS: 2027, // Year when contractors start
    MAX_CONTRACTORS: 4, // Maximum number of additional contractors
    
    getMonthlyAmount: (year: number) => {
      const baseAmount = EXPENSE_RULES.CONTRACT_SALARIES.BASE_MONTHLY
      if (year < EXPENSE_RULES.CONTRACT_SALARIES.START_YEAR_CONTRACTORS) {
        return baseAmount
      }
      const additionalContractors = Math.min(
        year - (EXPENSE_RULES.CONTRACT_SALARIES.START_YEAR_CONTRACTORS - 1), 
        EXPENSE_RULES.CONTRACT_SALARIES.MAX_CONTRACTORS
      )
      return baseAmount + (additionalContractors * EXPENSE_RULES.CONTRACT_SALARIES.CONTRACTOR_MONTHLY)
    }
  },
  
  // Office equipment purchases
  EQUIPMENT: {
    ANNUAL_STANDARD: 1000, // Annual equipment purchase 2025-2028
    ANNUAL_EXPANSION: 100000, // Expansion equipment purchase 2029-2030
    EXPANSION_START_YEAR: 2029,
    
    getAnnualAmount: (year: number) => {
      return year >= EXPENSE_RULES.EQUIPMENT.EXPANSION_START_YEAR 
        ? EXPENSE_RULES.EQUIPMENT.ANNUAL_EXPANSION 
        : EXPENSE_RULES.EQUIPMENT.ANNUAL_STANDARD
    }
  },
  
  // Travel expenses
  TRAVEL: {
    QUARTERLY_AMOUNT: 5000,
    FREQUENCY: 'quarterly' as const
  },
  
  // Marketing expenses
  MARKETING: {
    MONTHLY_BASE: 2000,
    FREQUENCY: 'monthly' as const
  },
  
  // Insurance
  INSURANCE: {
    MONTHLY_AMOUNT: 500,
    FREQUENCY: 'monthly' as const
  },
  
  // Rent
  RENT: {
    MONTHLY_AMOUNT: 500,
    FREQUENCY: 'monthly' as const
  },
  
  // Utilities
  UTILITIES: {
    MONTHLY_AMOUNT: 100,
    FREQUENCY: 'monthly' as const
  },
  
  // Internet
  INTERNET: {
    MONTHLY_AMOUNT: 100,
    FREQUENCY: 'monthly' as const
  },
  
  // Office supplies
  OFFICE_SUPPLIES: {
    MONTHLY_AMOUNT: 200,
    FREQUENCY: 'monthly' as const
  },
  
  // Legal & Compliance
  LEGAL_COMPLIANCE: {
    MONTHLY_AMOUNT: 1000,
    QUARTERLY_AMOUNT: 3000,
    MONTHLY_FREQUENCY: 'monthly' as const,
    QUARTERLY_FREQUENCY: 'quarterly' as const
  },
  
  // Accounting
  ACCOUNTING: {
    MONTHLY_AMOUNT: 2500,
    FREQUENCY: 'monthly' as const
  },
  
  // Bank fees
  BANK_FEES: {
    MONTHLY_AMOUNT: 100,
    FREQUENCY: 'monthly' as const
  }
}

// ============================================
// SALES CONFIGURATION
// ============================================

export const SALES_CONFIG = {
  // Growth configuration
  QUARTERLY_GROWTH_RATE: 0.10, // 10% quarterly growth
  
  // Amazon payment terms
  AMAZON_PAYMENT_DELAY_WEEKS: 2, // Payment received 2 weeks after sale
  
  // Multi-channel expansion timeline
  WALMART_START: { year: 2026, quarter: 2 }, // Q2 2026
  RETAIL_START: { year: 2027, quarter: 1 }, // Q1 2027
  
  // Channel revenue percentages (of Amazon revenue)
  WALMART_PERCENTAGE: 0.25, // 25% of Amazon revenue
  RETAIL_PERCENTAGE: 0.15, // 15% of Amazon revenue
  
  // Advertising rates (TACoS - Total Advertising Cost of Sales)
  // Amazon TACoS by product
  AMAZON_TACOS: {
    '6PK': 0.15,   // 15% TACoS for 6PK
    '12PK': 0.07,  // 7% TACoS for 12PK
    '1PK': 0.07,   // 7% TACoS for 1PK
    '3PK': 0.07,   // 7% TACoS for 3PK
    // Helper function to get TACoS by SKU
    getBySku: (sku: string) => {
      if (sku.includes('6PK')) return SALES_CONFIG.AMAZON_TACOS['6PK']
      if (sku.includes('12PK')) return SALES_CONFIG.AMAZON_TACOS['12PK']
      if (sku.includes('1PK')) return SALES_CONFIG.AMAZON_TACOS['1PK']
      if (sku.includes('3PK')) return SALES_CONFIG.AMAZON_TACOS['3PK']
      return 0.10 // Default 10% if unknown
    }
  },
  WALMART_ADVERTISING_RATE: 0.10, // 10% of Walmart revenue
  RETAIL_ADVERTISING_RATE: 0.05, // 5% of Retail revenue
  
  // Referral/Marketplace fees
  WALMART_REFERRAL_FEE: 0.08, // 8% of Walmart revenue
  RETAIL_BROKER_FEE: 0.20, // 20% of Retail revenue
  
  // Fulfillment fees
  WALMART_FULFILLMENT_FEE: 3.45, // $3.45 base fee for items under 1 lb
  
  // Refund configuration
  AMAZON_REFUND_RATE: 0.01, // 1% of Amazon revenue
  WALMART_REFUND_RATE: 0.01, // 1% of Walmart revenue
  RETAIL_REFUND_RATE: 0.005, // 0.5% of Retail revenue (lower for retail)
  
  // Special year configuration
  YEAR_WITH_53_WEEKS: 2026, // 2026 has 53 weeks
}


// ============================================
// BATCH PROCESSING CONFIGURATION
// ============================================

export const BATCH_CONFIG = {
  GL_BATCH_SIZE: 500, // Number of GL entries per batch
  GL_PARALLEL_LIMIT: 5, // Number of parallel GL batch requests
  DEFAULT_BATCH_SIZE: 100, // Default batch size for other operations
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const HELPERS = {
  // Check if a week is before business start
  isBeforeBusinessStart: (year: number, week: number) => {
    return year === TIMELINE.START_YEAR && week < TIMELINE.BUSINESS_START_WEEK
  },
  
  // Check if a week is before preparation start
  isBeforePreparationStart: (year: number, week: number) => {
    return year === TIMELINE.START_YEAR && week < TIMELINE.PREPARATION_START_WEEK
  },
  
  // Get quarter from week number
  getQuarterFromWeek: (week: number) => {
    if (week <= 13) return 1
    if (week <= 26) return 2
    if (week <= 39) return 3
    return 4
  },
  
  // Get week date range
  getWeekDateRange: (year: number, week: number) => {
    const firstDayOfYear = new Date(year, 0, 1)
    const dayOfWeek = firstDayOfYear.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
    const firstMonday = new Date(year, 0, 1 + daysToMonday)
    const weekStart = new Date(firstMonday)
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    return { start: weekStart, end: weekEnd }
  },
  
  // Format currency
  formatCurrency: (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }
}

// ============================================
// EXPENSE FREQUENCY HELPERS
// ============================================

export const FREQUENCY = {
  // Weekly weeks (all weeks)
  isWeeklyWeek: (week: number) => true,
  
  // Monthly weeks (approximately first week of each month)
  MONTHLY_WEEKS: [1, 5, 9, 14, 18, 22, 27, 31, 35, 40, 44, 48],
  isMonthlyWeek: (week: number) => FREQUENCY.MONTHLY_WEEKS.includes(week),
  
  // Quarterly weeks
  QUARTERLY_WEEKS: [1, 14, 27, 40],
  isQuarterlyWeek: (week: number) => FREQUENCY.QUARTERLY_WEEKS.includes(week),
  
  // Annual weeks
  ANNUAL_WEEKS: [1],
  isAnnualWeek: (week: number) => FREQUENCY.ANNUAL_WEEKS.includes(week)
}

// Export everything as a single config object as well
export const E2_CONFIG = {
  API_BASE,
  TIMELINE,
  FINANCIAL,
  INITIAL_ORDERS,
  ORDERING_RULES,
  EXPENSE_RULES,
  SALES_CONFIG,
  BATCH_CONFIG,
  HELPERS,
  FREQUENCY
}

export default E2_CONFIG