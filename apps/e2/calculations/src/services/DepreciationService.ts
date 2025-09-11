/**
 * Depreciation Calculation Service
 * Calculates depreciation expense dynamically based on fixed asset balances
 */

import { prisma } from '@/utils/database'

interface DepreciationConfig {
  depreciationMonths: number // Default 60 months (5 years)
  startDate: Date
}

interface AssetDepreciation {
  assetAccount: string
  assetBalance: number
  monthlyDepreciation: number
  accumulatedDepreciation: number
  netBookValue: number
}

export class DepreciationService {
  private config: DepreciationConfig
  
  constructor(config?: Partial<DepreciationConfig>) {
    this.config = {
      depreciationMonths: config?.depreciationMonths || 60, // 5 years default
      startDate: config?.startDate || new Date('2025-10-01')
    }
  }

  /**
   * Calculate depreciation for a specific period
   */
  async calculateDepreciation(
    strategyId: string,
    year: number, 
    quarter?: number,
    month?: number
  ): Promise<{
    monthlyDepreciation: number
    quarterlyDepreciation: number
    yearlyDepreciation: number
    assets: AssetDepreciation[]
  }> {
    // Get all fixed asset purchases from GL entries
    const fixedAssetAccounts = ['1700'] // Office Equipment
    
    // Determine period boundaries
    let startDate: Date
    let endDate: Date
    
    if (month) {
      startDate = new Date(year, month - 1, 1)
      endDate = new Date(year, month, 0) // Last day of month
    } else if (quarter) {
      const startMonth = (quarter - 1) * 3
      startDate = new Date(year, startMonth, 1)
      endDate = new Date(year, startMonth + 3, 0)
    } else {
      startDate = new Date(year, 0, 1)
      endDate = new Date(year, 11, 31)
    }
    
    // Get all asset purchases up to the end date
    const assetEntries = await prisma.gLEntry.findMany({
      where: {
        strategyId,
        account: { in: fixedAssetAccounts },
        date: { lte: endDate },
        debit: { gt: 0 } // Asset purchases are debits
      },
      orderBy: { date: 'asc' }
    })
    
    // Calculate depreciation for each asset
    const assets: AssetDepreciation[] = []
    let totalMonthlyDepreciation = 0
    
    for (const account of fixedAssetAccounts) {
      const accountEntries = assetEntries.filter(e => e.account === account)
      const totalAssetCost = accountEntries.reduce((sum, e) => sum + e.debit.toNumber(), 0)
      
      if (totalAssetCost > 0) {
        // Calculate months since acquisition (use earliest purchase date)
        const acquisitionDate = accountEntries[0]?.date || this.config.startDate
        const monthsOwned = this.getMonthsBetween(acquisitionDate, endDate)
        
        // Straight-line depreciation
        const monthlyDepreciation = totalAssetCost / this.config.depreciationMonths
        const accumulatedDepreciation = Math.min(
          monthlyDepreciation * monthsOwned,
          totalAssetCost // Cannot depreciate more than cost
        )
        
        assets.push({
          assetAccount: account,
          assetBalance: totalAssetCost,
          monthlyDepreciation,
          accumulatedDepreciation,
          netBookValue: totalAssetCost - accumulatedDepreciation
        })
        
        totalMonthlyDepreciation += monthlyDepreciation
      }
    }
    
    // Calculate period depreciation
    let periodMonths = 1
    if (quarter) {
      periodMonths = 3
    } else if (!month) {
      periodMonths = 12
    }
    
    return {
      monthlyDepreciation: totalMonthlyDepreciation,
      quarterlyDepreciation: totalMonthlyDepreciation * 3,
      yearlyDepreciation: totalMonthlyDepreciation * 12,
      assets
    }
  }

  /**
   * Create depreciation GL entries for a period
   */
  async createDepreciationEntries(
    strategyId: string,
    year: number,
    quarter?: number,
    month?: number
  ): Promise<void> {
    const depreciation = await this.calculateDepreciation(strategyId, year, quarter, month)
    
    if (depreciation.monthlyDepreciation === 0) {
      return // No assets to depreciate
    }
    
    // Determine period for GL entries
    let periodMonths = month ? 1 : quarter ? 3 : 12
    let totalDepreciation = depreciation.monthlyDepreciation * periodMonths
    
    // Create date for entries (end of period)
    let entryDate: Date
    if (month) {
      entryDate = new Date(year, month, 0) // Last day of month
    } else if (quarter) {
      const endMonth = quarter * 3
      entryDate = new Date(year, endMonth, 0)
    } else {
      entryDate = new Date(year, 11, 31)
    }
    
    // Check if entries already exist
    const existingEntries = await prisma.gLEntry.findMany({
      where: {
        strategyId,
        date: entryDate,
        account: { in: ['5720', '1750'] },
        source: 'depreciation'
      }
    })
    
    if (existingEntries.length > 0) {
      // Update existing entries
      await prisma.gLEntry.updateMany({
        where: {
          strategyId,
          date: entryDate,
          account: '5720',
          source: 'depreciation'
        },
        data: {
          debit: totalDepreciation
        }
      })
      
      await prisma.gLEntry.updateMany({
        where: {
          strategyId,
          date: entryDate,
          account: '1750',
          source: 'depreciation'
        },
        data: {
          credit: totalDepreciation
        }
      })
    } else {
      // Create new entries
      const pairId = `depreciation-${year}-${quarter || 'year'}-${month || ''}`
      
      await prisma.gLEntry.createMany({
        data: [
          {
            strategyId,
            date: entryDate,
            account: '5720', // Depreciation Expense
            accountCategory: 'Expense',
            description: `Depreciation Expense - ${this.getPeriodDescription(year, quarter, month)}`,
            debit: totalDepreciation,
            credit: 0,
            reference: pairId,
            source: 'depreciation',
            metadata: {
              year,
              quarter,
              month,
              monthlyRate: depreciation.monthlyDepreciation,
              assets: depreciation.assets
            }
          },
          {
            strategyId,
            date: entryDate,
            account: '1750', // Accumulated Depreciation (contra-asset)
            accountCategory: 'Asset',
            description: `Accumulated Depreciation - ${this.getPeriodDescription(year, quarter, month)}`,
            debit: 0,
            credit: totalDepreciation,
            reference: pairId,
            source: 'depreciation',
            metadata: {
              year,
              quarter,
              month,
              monthlyRate: depreciation.monthlyDepreciation,
              assets: depreciation.assets
            }
          }
        ]
      })
    }
  }

  /**
   * Calculate depreciation for all periods in a year
   */
  async calculateYearlyDepreciation(
    strategyId: string,
    year: number
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {}
    
    for (let q = 1; q <= 4; q++) {
      const depreciation = await this.calculateDepreciation(strategyId, year, q)
      result[`Q${q}`] = depreciation.quarterlyDepreciation
    }
    
    result['Total'] = Object.values(result).reduce((sum, val) => sum + val, 0)
    return result
  }

  private getMonthsBetween(startDate: Date, endDate: Date): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                  (end.getMonth() - start.getMonth()) + 1
    
    return Math.max(0, months)
  }

  private getPeriodDescription(year: number, quarter?: number, month?: number): string {
    if (month) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${monthNames[month - 1]} ${year}`
    } else if (quarter) {
      return `Q${quarter} ${year}`
    } else {
      return `Year ${year}`
    }
  }
}

// Export singleton instance
export const depreciationService = new DepreciationService()