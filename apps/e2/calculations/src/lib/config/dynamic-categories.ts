/**
 * Dynamic Categories
 * Fetches expense and revenue categories from the database instead of hardcoded values
 */

import SystemConfigService from '@/services/database/SystemConfigService'

// Cache for categories
let cachedExpenseCategories: any = null
let cachedRevenueCategories: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get all expense categories from database
 */
export async function getExpenseCategories() {
  const now = Date.now()
  
  // Return cached categories if still valid
  if (cachedExpenseCategories && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedExpenseCategories
  }
  
  // Fetch fresh categories from database
  const configService = SystemConfigService.getInstance()
  const categories = await configService.getExpenseCategories()
  
  // Update cache
  cachedExpenseCategories = categories
  cacheTimestamp = now
  
  return categories
}

/**
 * Get all revenue categories from database
 */
export async function getRevenueCategories() {
  const now = Date.now()
  
  // Return cached categories if still valid
  if (cachedRevenueCategories && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedRevenueCategories
  }
  
  // Fetch fresh categories from database
  const configService = SystemConfigService.getInstance()
  const categories = await configService.getRevenueCategories()
  
  // Update cache
  cachedRevenueCategories = categories
  
  return categories
}

/**
 * Get expense category by ID
 */
export async function getExpenseCategoryById(id: string) {
  const categories = await getExpenseCategories()
  return categories[id.toUpperCase()]
}

/**
 * Get revenue category by ID
 */
export async function getRevenueCategoryById(id: string) {
  const categories = await getRevenueCategories()
  return categories[id.toUpperCase()]
}

/**
 * Get all expense categories as array
 */
export async function getAllExpenseCategories() {
  const categories = await getExpenseCategories()
  return Object.values(categories)
}

/**
 * Get all revenue categories as array
 */
export async function getAllRevenueCategories() {
  const categories = await getRevenueCategories()
  return Object.values(categories)
}

/**
 * Get expense category options for dropdowns
 */
export async function getExpenseCategoryOptions() {
  const categories = await getAllExpenseCategories()
  return categories.map((cat: any) => ({
    value: cat.id,
    label: cat.name,
    description: cat.description
  }))
}

/**
 * Get revenue category options for dropdowns
 */
export async function getRevenueCategoryOptions() {
  const categories = await getAllRevenueCategories()
  return categories.map((cat: any) => ({
    value: cat.id,
    label: cat.name,
    description: cat.description
  }))
}