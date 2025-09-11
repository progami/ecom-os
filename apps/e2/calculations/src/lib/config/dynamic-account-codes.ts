/**
 * Dynamic GL Account Codes
 * Fetches GL account codes from the database instead of hardcoded values
 */

import SystemConfigService from '@/services/database/SystemConfigService'

// Cache for account codes
let cachedAccountCodes: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get all GL account codes from database
 */
export async function getGLAccountCodes() {
  const now = Date.now()
  
  // Return cached codes if still valid
  if (cachedAccountCodes && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedAccountCodes
  }
  
  // Fetch fresh codes from database
  const configService = SystemConfigService.getInstance()
  const codes = await configService.getGLAccountCodes()
  
  // Update cache
  cachedAccountCodes = codes
  cacheTimestamp = now
  
  return codes
}

/**
 * Get a specific account by key
 */
export async function getAccountByKey(key: string) {
  const codes = await getGLAccountCodes()
  return codes[key.toUpperCase()]
}

/**
 * Get account by code
 */
export async function getAccountByCode(code: string) {
  const codes = await getGLAccountCodes()
  return Object.values(codes).find((account: any) => account.code === code)
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense') {
  const codes = await getGLAccountCodes()
  return Object.values(codes).filter((account: any) => account.type === type)
}

/**
 * Common account getters for convenience
 */
export async function getCashAccount() {
  return getAccountByKey('CASH')
}

export async function getBankAccount() {
  return getAccountByKey('BANK_ACCOUNT')
}

export async function getAccountsReceivableAccount() {
  return getAccountByKey('ACCOUNTS_RECEIVABLE')
}

export async function getInventoryAccount() {
  return getAccountByKey('INVENTORY')
}

export async function getAccountsPayableAccount() {
  return getAccountByKey('ACCOUNTS_PAYABLE')
}

export async function getSalesRevenueAccount() {
  return getAccountByKey('SALES_REVENUE')
}

export async function getCostOfGoodsSoldAccount() {
  return getAccountByKey('COST_OF_GOODS_SOLD')
}

export async function getPayrollAccount() {
  return getAccountByKey('PAYROLL')
}

export async function getRentAccount() {
  return getAccountByKey('RENT')
}