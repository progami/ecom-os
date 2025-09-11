/**
 * System Configuration Service
 * Manages all system configuration stored in the database
 * Replaces hardcoded configuration files
 */

import { prisma } from '@/utils/database'
// SystemConfig model was removed from schema
// import { SystemConfig } from '@prisma/client'
import logger from '@/utils/logger'

// Define SystemConfig type locally since it's not in Prisma schema
type SystemConfig = {
  id: string
  key: string
  value: any
  category: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

// Ensure this runs only on the server
if (typeof window !== 'undefined') {
  throw new Error('SystemConfigService should only be used on the server side')
}

interface ConfigCache {
  [key: string]: any
  lastRefresh: Date
}

class SystemConfigService {
  private static instance: SystemConfigService
  private cache: ConfigCache = { lastRefresh: new Date(0) }
  private cacheLifetime = 5 * 60 * 1000 // 5 minutes
  
  private constructor() {}
  
  static getInstance(): SystemConfigService {
    if (!SystemConfigService.instance) {
      SystemConfigService.instance = new SystemConfigService()
    }
    return SystemConfigService.instance
  }
  
  /**
   * Get a configuration value by key
   */
  async getConfig(key: string): Promise<any> {
    await this.refreshCacheIfNeeded()
    return this.cache[key]
  }
  
  /**
   * Get multiple configuration values by category
   */
  async getConfigsByCategory(category: string): Promise<Record<string, any>> {
    await this.refreshCacheIfNeeded()
    
    const configs: Record<string, any> = {}
    Object.entries(this.cache).forEach(([key, value]) => {
      if (key.startsWith(`${category}_`)) {
        configs[key] = value
      }
    })
    
    return configs
  }
  
  /**
   * Get business rules configuration
   */
  async getBusinessRules(): Promise<{
    amazonReferralRate: number
    amazonReturnAllowance: number
    tariffRate: number
    payrollTaxRate: number
    defaultMarginThreshold: number
    minimumOrderQuantity: number
    leadTimeDays: number
    defaultWholesalePriceRatio: number
    assetDepreciationMonths: number
    accountsPayableRatio: number
    accountsReceivableRatio: number
    accruedExpensesRatio: number
    tacosRates: Record<string, number>
    growthRates: Record<string, number>
  }> {
    await this.refreshCacheIfNeeded()
    
    const tacosRates: Record<string, number> = {}
    const growthRates: Record<string, number> = {}
    
    // Extract year-specific rates
    Object.entries(this.cache).forEach(([key, value]) => {
      if (key.startsWith('tacos_rate_')) {
        const year = key.replace('tacos_rate_', '')
        tacosRates[year] = value
      } else if (key.startsWith('growth_rate_')) {
        const year = key.replace('growth_rate_', '')
        growthRates[year] = value
      }
    })
    
    return {
      amazonReferralRate: this.cache.amazon_referral_rate || 0.15,
      amazonReturnAllowance: this.cache.amazon_return_allowance || 0.01,
      tariffRate: this.cache.tariff_rate || 0.35,
      payrollTaxRate: this.cache.payroll_tax_rate || 0.153,
      defaultMarginThreshold: this.cache.default_margin_threshold || 0.20,
      minimumOrderQuantity: this.cache.minimum_order_quantity || 100,
      leadTimeDays: this.cache.lead_time_days || 90,
      defaultWholesalePriceRatio: this.cache.default_wholesale_price_ratio || 0.5,
      assetDepreciationMonths: this.cache.asset_depreciation_months || 60,
      accountsPayableRatio: this.cache.accounts_payable_ratio || 0.3,
      accountsReceivableRatio: this.cache.accounts_receivable_ratio || 0.5,
      accruedExpensesRatio: this.cache.accrued_expenses_ratio || 0.1,
      tacosRates,
      growthRates
    }
  }
  
  /**
   * Get GL account codes
   */
  async getGLAccountCodes(): Promise<Record<string, {
    code: string
    name: string
    type: string
  }>> {
    await this.refreshCacheIfNeeded()
    
    const accounts: Record<string, any> = {}
    Object.entries(this.cache).forEach(([key, value]) => {
      if (key.startsWith('gl_account_')) {
        const accountKey = key.replace('gl_account_', '').toUpperCase()
        accounts[accountKey] = value
      }
    })
    
    return accounts
  }
  
  /**
   * Get expense categories
   */
  async getExpenseCategories(): Promise<Record<string, {
    id: string
    name: string
    type: string
    description?: string
    glAccountCode?: string
    subCategories?: string[]
  }>> {
    await this.refreshCacheIfNeeded()
    
    const categories: Record<string, any> = {}
    Object.entries(this.cache).forEach(([key, value]) => {
      if (key.startsWith('expense_category_')) {
        const categoryKey = key.replace('expense_category_', '').toUpperCase()
        categories[categoryKey] = value
      }
    })
    
    return categories
  }
  
  /**
   * Get revenue categories
   */
  async getRevenueCategories(): Promise<Record<string, {
    id: string
    name: string
    type: string
    description?: string
    glAccountCode?: string
    subCategories?: string[]
  }>> {
    await this.refreshCacheIfNeeded()
    
    const categories: Record<string, any> = {}
    Object.entries(this.cache).forEach(([key, value]) => {
      if (key.startsWith('revenue_category_')) {
        const categoryKey = key.replace('revenue_category_', '').toUpperCase()
        categories[categoryKey] = value
      }
    })
    
    return categories
  }
  
  /**
   * Get default assumptions
   */
  async getDefaultAssumptions(): Promise<{
    initialInvestment: number
    inventoryInvestment: number
    setupInvestment: number
    marketingInvestment: number
    ownerSalary: number
    managerSalaryFT: number
    associateSalaryPT: number
    officeRentMonthly: number
    utilitiesMonthly: number
    insuranceAnnual: number
    accountingFeesMonthly: number
    officeSuppliesMonthly: number
  }> {
    await this.refreshCacheIfNeeded()
    
    return {
      initialInvestment: this.cache.default_initial_investment || 80000,
      inventoryInvestment: this.cache.default_inventory_investment || 60000,
      setupInvestment: this.cache.default_setup_investment || 15000,
      marketingInvestment: this.cache.default_marketing_investment || 5000,
      ownerSalary: this.cache.default_owner_salary || 48000,
      managerSalaryFT: this.cache.default_manager_salary_ft || 40000,
      associateSalaryPT: this.cache.default_associate_salary_pt || 15000,
      officeRentMonthly: this.cache.default_office_rent_monthly || 400,
      utilitiesMonthly: this.cache.default_utilities_monthly || 150,
      insuranceAnnual: this.cache.default_insurance_annual || 2400,
      accountingFeesMonthly: this.cache.default_accounting_fees_monthly || 500,
      officeSuppliesMonthly: this.cache.default_office_supplies_monthly || 125
    }
  }
  
  /**
   * Get system dates configuration
   */
  async getSystemDates(): Promise<{
    historicalDataStart: string
    cutoffDate: string
    lastReconciledDate: string
    currentWeekStart: string
    currentWeekEnd: string
  }> {
    await this.refreshCacheIfNeeded()
    
    return {
      historicalDataStart: this.cache.historical_data_start || '2023-01-01',
      cutoffDate: this.cache.cutoff_date || '2024-06-30',
      lastReconciledDate: this.cache.last_reconciled_date || '2024-06-30',
      currentWeekStart: this.cache.current_week_start || '2024-07-01',
      currentWeekEnd: this.cache.current_week_end || '2024-07-07'
    }
  }
  
  /**
   * Update a configuration value
   */
  async updateConfig(key: string, value: any, description?: string): Promise<void> {
    // SystemConfig table doesn't exist yet, just update cache
    /*
    await prisma.systemConfig.upsert({
      where: { key },
      update: { 
        value: value as any,
        ...(description && { description })
      },
      create: {
        key,
        value: value as any,
        description: description || `Configuration: ${key}`,
        category: this.getCategoryFromKey(key)
      }
    })
    */
    
    // Update cache only for now
    this.cache[key] = value
    logger.info(`Updated config ${key} in cache (SystemConfig table not yet implemented)`)
  }
  
  /**
   * Bulk update configurations
   */
  async updateConfigs(configs: Array<{
    key: string
    value: any
    description?: string
  }>): Promise<void> {
    // SystemConfig table doesn't exist yet, just update cache
    /*
    const operations = configs.map(config => 
      prisma.systemConfig.upsert({
        where: { key: config.key },
        update: { 
          value: config.value as any,
          ...(config.description && { description: config.description })
        },
        create: {
          key: config.key,
          value: config.value as any,
          description: config.description || `Configuration: ${config.key}`,
          category: this.getCategoryFromKey(config.key)
        }
      })
    )
    
    await prisma.$transaction(operations)
    */
    
    // Update cache only for now
    configs.forEach(config => {
      this.cache[config.key] = config.value
    })
    logger.info(`Updated ${configs.length} configs in cache (SystemConfig table not yet implemented)`)
  }
  
  /**
   * Refresh cache if needed
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = new Date()
    const timeSinceRefresh = now.getTime() - this.cache.lastRefresh.getTime()
    
    if (timeSinceRefresh > this.cacheLifetime) {
      await this.refreshCache()
    }
  }
  
  /**
   * Refresh the cache from database
   */
  async refreshCache(): Promise<void> {
    try {
      // SystemConfig table doesn't exist yet, use default values
      // const configs = await prisma.systemConfig.findMany()
      
      this.cache = { 
        lastRefresh: new Date(),
        // Default configurations
        historical_data_start: '2025-01-01',
        cutoff_date: '2025-10-01',
        last_reconciled_date: '2025-10-01',
        current_week_start: '2025-10-05',
        current_week_end: '2025-10-11'
      }
      
      logger.info('Using default system config (SystemConfig table not yet implemented)')
    } catch (error) {
      logger.error('Failed to refresh system config cache:', error)
      // Use defaults if there's an error
      this.cache = { lastRefresh: new Date() }
    }
  }
  
  /**
   * Determine category from key
   */
  private getCategoryFromKey(key: string): string {
    if (key.startsWith('gl_account_')) return 'gl_accounts'
    if (key.startsWith('expense_category_')) return 'expense_categories'
    if (key.startsWith('revenue_category_')) return 'revenue_categories'
    if (key.includes('rate') || key.includes('ratio') || key.includes('threshold')) return 'business_rules'
    if (key.startsWith('default_')) return 'assumptions'
    return 'general'
  }
}

export default SystemConfigService