/**
 * Dynamic Business Rules
 * Fetches business rules from the database instead of hardcoded values
 */

import SystemConfigService from '@/services/database/SystemConfigService'

// Cache for business rules to avoid multiple database calls
let cachedRules: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get business rules from database
 */
export async function getBusinessRules() {
  const now = Date.now()
  
  // Return cached rules if still valid
  if (cachedRules && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedRules
  }
  
  // Fetch fresh rules from database
  const configService = SystemConfigService.getInstance()
  const rules = await configService.getBusinessRules()
  
  // Update cache
  cachedRules = rules
  cacheTimestamp = now
  
  return rules
}

/**
 * Get Amazon fees configuration
 */
export async function getAmazonFees() {
  const rules = await getBusinessRules()
  return {
    referralRate: rules.amazonReferralRate,
    returnAllowance: rules.amazonReturnAllowance
  }
}

/**
 * Get tax rates configuration
 */
export async function getTaxRates() {
  const rules = await getBusinessRules()
  return {
    tariffRate: rules.tariffRate,
    payrollTaxRate: rules.payrollTaxRate
  }
}

/**
 * Get TACoS rates by year
 */
export async function getTacosRates() {
  const rules = await getBusinessRules()
  return rules.tacosRates
}

/**
 * Get growth rates by year
 */
export async function getGrowthRates() {
  const rules = await getBusinessRules()
  return rules.growthRates
}

/**
 * Get business thresholds
 */
export async function getBusinessThresholds() {
  const rules = await getBusinessRules()
  return {
    defaultMarginThreshold: rules.defaultMarginThreshold,
    minimumOrderQuantity: rules.minimumOrderQuantity,
    leadTimeDays: rules.leadTimeDays,
    defaultWholesalePriceRatio: rules.defaultWholesalePriceRatio,
    assetDepreciationMonths: rules.assetDepreciationMonths
  }
}

/**
 * Get payment terms
 */
export async function getPaymentTerms() {
  const rules = await getBusinessRules()
  return {
    accountsPayableRatio: rules.accountsPayableRatio,
    accountsReceivableRatio: rules.accountsReceivableRatio,
    accruedExpensesRatio: rules.accruedExpensesRatio
  }
}

/**
 * Calculate net revenue (async version)
 */
export async function calculateNetRevenue(grossRevenue: number): Promise<number> {
  const amazonFees = await getAmazonFees()
  return grossRevenue * (1 - amazonFees.referralRate - amazonFees.returnAllowance)
}

/**
 * Calculate tariff (async version)
 */
export async function calculateTariff(amount: number): Promise<number> {
  const taxRates = await getTaxRates()
  return amount * taxRates.tariffRate
}

/**
 * Calculate payroll tax (async version)
 */
export async function calculatePayrollTax(payrollAmount: number): Promise<number> {
  const taxRates = await getTaxRates()
  return payrollAmount * taxRates.payrollTaxRate
}