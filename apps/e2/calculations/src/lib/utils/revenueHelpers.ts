/**
 * Revenue data transformation helpers
 */

export interface DashboardRevenueData {
  [yearWeek: string]: {
    [sku: string]: {
      grossRevenue: number
      units: number
    }
  }
}

/**
 * Calculate ISO week number for a given date
 */
export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Transform revenue data from API format to dashboard format
 */
export const transformRevenueToDashboardFormat = (apiRevenue: any[]): DashboardRevenueData => {
  const result: DashboardRevenueData = {}
  
  if (!Array.isArray(apiRevenue)) {
    return result
  }
  
  apiRevenue.forEach((item) => {
    const weekDate = new Date(item.weekStarting)
    const year = weekDate.getFullYear()
    const weekOfYear = getWeekNumber(weekDate)
    const yearWeek = `${year}-W${weekOfYear.toString().padStart(2, '0')}`
    
    if (!result[yearWeek]) {
      result[yearWeek] = {}
    }
    
    const sku = item.subcategory || item.category || 'unknown'
    result[yearWeek][sku] = {
      grossRevenue: item.amount || 0,
      units: item.units || 0
    }
  })
  
  return result
}