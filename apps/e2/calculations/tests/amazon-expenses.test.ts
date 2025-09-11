/**
 * Amazon Expenses Tests
 * Tests refunds, AWD, referral fees, FBA fees, and advertising costs
 */

import { describe, it, expect, beforeAll } from 'vitest'

const API_BASE = 'http://localhost:4321/api'

// Product definitions from strategy
const PRODUCTS = {
  '6PK - 7M': {
    price: 6.99,
    awd: 0.12,
    tacos: 0.15,
    refundRate: 0.015,
    fbaFee: 3.24 // Standard FBA fee for this size/weight
  },
  '12PK - 7M': {
    price: 14.99,
    awd: 0.24,
    tacos: 0.07,
    refundRate: 0.015,
    fbaFee: 3.89 // Standard FBA fee for this size/weight
  },
  '1PK - 32M': {
    price: 7.99,
    awd: 0.09,
    tacos: 0.07,
    refundRate: 0.01,
    fbaFee: 3.24 // Standard FBA fee for this size/weight
  },
  '3PK - 32M': {
    price: 14.99,
    awd: 0.27,
    tacos: 0.07,
    refundRate: 0.01,
    fbaFee: 3.89 // Standard FBA fee for this size/weight
  }
}

// Amazon constants
const AMAZON_REFERRAL_RATE = 0.15 // 15% referral fee
const AMAZON_RETURN_ALLOWANCE = 0.005 // 0.5% return allowance

describe('Amazon Expenses Tests', () => {
  let strategyId: string

  beforeAll(async () => {
    // Get active strategy
    const strategiesRes = await fetch(`${API_BASE}/strategies`)
    const strategies = await strategiesRes.json()
    const activeStrategy = strategies.find((s: any) => s.isActive)
    strategyId = activeStrategy?.id
  })

  describe('Refund Costs', () => {
    it('should calculate refunds based on product refund rates', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate expected refunds per SKU
      const expectedRefunds: Record<string, number> = {}
      const revenueBySkU: Record<string, number> = {}
      
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          const revenue = sale.units * product.price
          if (!revenueBySkU[sale.sku]) {
            revenueBySkU[sale.sku] = 0
          }
          revenueBySkU[sale.sku] += revenue
          
          if (!expectedRefunds[sale.sku]) {
            expectedRefunds[sale.sku] = 0
          }
          expectedRefunds[sale.sku] += revenue * product.refundRate
        }
      }

      // Get actual refunds from expenses
      const expensesRes = await fetch(`${API_BASE}/expenses?year=2025&quarter=4`)
      const expenses = await expensesRes.json()
      
      const refundExpenses = expenses.filter((e: any) => 
        e.category === 'Amazon-Refunds' || e.description?.includes('Refunds')
      )

      // Sum actual refunds by SKU
      const actualRefunds: Record<string, number> = {}
      for (const expense of refundExpenses) {
        if (expense.sku) {
          if (!actualRefunds[expense.sku]) {
            actualRefunds[expense.sku] = 0
          }
          actualRefunds[expense.sku] += expense.amount
        }
      }

      // Compare expected vs actual for each SKU
      for (const sku of Object.keys(expectedRefunds)) {
        console.log(`${sku}: Expected refunds ${expectedRefunds[sku].toFixed(2)}, Actual ${(actualRefunds[sku] || 0).toFixed(2)}`)
        expect(Math.abs((actualRefunds[sku] || 0) - expectedRefunds[sku])).toBeLessThan(1)
      }
    })
  })

  describe('AWD (Amazon Warehouse & Distribution) Costs', () => {
    it('should calculate AWD costs per unit correctly', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate expected AWD costs
      const expectedAWD: Record<string, number> = {}
      
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          if (!expectedAWD[sale.sku]) {
            expectedAWD[sale.sku] = 0
          }
          expectedAWD[sale.sku] += sale.units * product.awd
        }
      }

      // Get actual AWD from expenses
      const expensesRes = await fetch(`${API_BASE}/expenses?year=2025&quarter=4`)
      const expenses = await expensesRes.json()
      
      const awdExpenses = expenses.filter((e: any) => 
        e.category === 'Amazon-AWD' || e.description?.includes('AWD')
      )

      // Sum actual AWD by SKU
      const actualAWD: Record<string, number> = {}
      for (const expense of awdExpenses) {
        if (expense.sku) {
          if (!actualAWD[expense.sku]) {
            actualAWD[expense.sku] = 0
          }
          actualAWD[expense.sku] += expense.amount
        }
      }

      // Compare
      for (const sku of Object.keys(expectedAWD)) {
        console.log(`${sku}: Expected AWD ${expectedAWD[sku].toFixed(2)}, Actual ${(actualAWD[sku] || 0).toFixed(2)}`)
        expect(Math.abs((actualAWD[sku] || 0) - expectedAWD[sku])).toBeLessThan(1)
      }
    })

    it('should calculate AWD for all years correctly', async () => {
      for (let year = 2025; year <= 2030; year++) {
        let yearTotalExpected = 0
        
        for (let quarter = 1; quarter <= 4; quarter++) {
          const salesRes = await fetch(`${API_BASE}/unit-sales?year=${year}&quarter=${quarter}`)
          const salesData = await salesRes.json()
          const sales = salesData.sales || []

          for (const sale of sales) {
            const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
            if (product) {
              yearTotalExpected += sale.units * product.awd
            }
          }
        }

        // Get actual AWD expenses for the year
        const expensesRes = await fetch(`${API_BASE}/expenses/annual-summary?year=${year}`)
        const expenseSummary = await expensesRes.json()
        const awdExpenses = expenseSummary.categories?.['Amazon-AWD'] || 0

        console.log(`Year ${year}: Expected AWD ${yearTotalExpected.toFixed(2)}, Actual ${awdExpenses.toFixed(2)}`)
        if (yearTotalExpected > 0) {
          expect(Math.abs(awdExpenses - yearTotalExpected)).toBeLessThan(10) // Allow $10 rounding across whole year
        }
      }
    })
  })

  describe('Referral Fees', () => {
    it('should calculate referral fees as 15% of revenue', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate total revenue and expected referral fees
      let totalRevenue = 0
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          totalRevenue += sale.units * product.price
        }
      }
      
      const expectedReferralFees = totalRevenue * AMAZON_REFERRAL_RATE

      // Get actual referral fees from GL (account 6040)
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualReferralFees = glData.accounts['6040'] || 0

      console.log(`Q4 2025: Revenue ${totalRevenue.toFixed(2)}, Expected Referral ${expectedReferralFees.toFixed(2)}, Actual ${actualReferralFees.toFixed(2)}`)
      expect(Math.abs(actualReferralFees - expectedReferralFees)).toBeLessThan(1)
    })

    it('should track referral fees at SKU level for accuracy', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate expected referral fees per SKU
      const expectedBySkU: Record<string, number> = {}
      
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          const revenue = sale.units * product.price
          if (!expectedBySkU[sale.sku]) {
            expectedBySkU[sale.sku] = 0
          }
          expectedBySkU[sale.sku] += revenue * AMAZON_REFERRAL_RATE
        }
      }

      // Get actual from expenses
      const expensesRes = await fetch(`${API_BASE}/expenses?year=2025&quarter=4`)
      const expenses = await expensesRes.json()
      
      const referralExpenses = expenses.filter((e: any) => 
        e.category === 'Amazon-Referral' || e.description?.includes('Referral fee')
      )

      // Sum by SKU
      const actualBySkU: Record<string, number> = {}
      for (const expense of referralExpenses) {
        if (expense.sku) {
          if (!actualBySkU[expense.sku]) {
            actualBySkU[expense.sku] = 0
          }
          actualBySkU[expense.sku] += expense.amount
        }
      }

      // Verify each SKU
      for (const sku of Object.keys(expectedBySkU)) {
        console.log(`${sku}: Expected referral ${expectedBySkU[sku].toFixed(2)}, Actual ${(actualBySkU[sku] || 0).toFixed(2)}`)
        expect(Math.abs((actualBySkU[sku] || 0) - expectedBySkU[sku])).toBeLessThan(1)
      }
    })
  })

  describe('FBA Fees', () => {
    it('should calculate FBA fees per SKU correctly', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate expected FBA fees
      const expectedFBA: Record<string, number> = {}
      
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          if (!expectedFBA[sale.sku]) {
            expectedFBA[sale.sku] = 0
          }
          expectedFBA[sale.sku] += sale.units * product.fbaFee
        }
      }

      // Get actual FBA fees from GL (account 6030)
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualFBATotal = glData.accounts['6030'] || 0

      const totalExpectedFBA = Object.values(expectedFBA).reduce((sum, val) => sum + val, 0)
      
      console.log(`Q4 2025 FBA: Expected ${totalExpectedFBA.toFixed(2)}, Actual ${actualFBATotal.toFixed(2)}`)
      expect(Math.abs(actualFBATotal - totalExpectedFBA)).toBeLessThan(10) // Allow $10 difference for rounding
    })
  })

  describe('Advertising Costs (TACoS)', () => {
    it('should calculate advertising as TACoS × Revenue', async () => {
      // Get unit sales for Q4 2025
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Calculate revenue and expected advertising by SKU
      const revenueBySkU: Record<string, number> = {}
      const expectedAdBySkU: Record<string, number> = {}
      
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          const revenue = sale.units * product.price
          if (!revenueBySkU[sale.sku]) {
            revenueBySkU[sale.sku] = 0
          }
          revenueBySkU[sale.sku] += revenue
          
          if (!expectedAdBySkU[sale.sku]) {
            expectedAdBySkU[sale.sku] = 0
          }
          expectedAdBySkU[sale.sku] += revenue * product.tacos
        }
      }

      // Get actual advertising from GL (account 7010)
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualAdvertising = glData.accounts['7010'] || 0

      const totalExpectedAd = Object.values(expectedAdBySkU).reduce((sum, val) => sum + val, 0)
      
      console.log(`Q4 2025 Advertising: Expected ${totalExpectedAd.toFixed(2)}, Actual ${actualAdvertising.toFixed(2)}`)
      expect(Math.abs(actualAdvertising - totalExpectedAd)).toBeLessThan(10)
    })

    it('should apply different TACoS rates per product', async () => {
      // 6PK-7M has 15% TACoS, others have 7%
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      // Group sales by SKU
      const salesBySkU: Record<string, any[]> = {}
      for (const sale of sales) {
        if (!salesBySkU[sale.sku]) {
          salesBySkU[sale.sku] = []
        }
        salesBySkU[sale.sku].push(sale)
      }

      // Verify TACoS rates
      for (const [sku, skuSales] of Object.entries(salesBySkU)) {
        const product = PRODUCTS[sku as keyof typeof PRODUCTS]
        if (product) {
          const totalRevenue = skuSales.reduce((sum, s) => sum + (s.units * product.price), 0)
          const expectedAd = totalRevenue * product.tacos
          
          // Get actual advertising for this SKU
          const expensesRes = await fetch(`${API_BASE}/expenses?year=2025&quarter=4`)
          const expenses = await expensesRes.json()
          
          const adExpenses = expenses.filter((e: any) => 
            (e.category === 'Advertising' || e.description?.includes('Ad spend')) && 
            e.sku === sku
          )
          
          const actualAd = adExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
          
          const actualTacos = totalRevenue > 0 ? actualAd / totalRevenue : 0
          console.log(`${sku}: TACoS should be ${(product.tacos * 100).toFixed(1)}%, actual is ${(actualTacos * 100).toFixed(1)}%`)
          
          expect(Math.abs(actualTacos - product.tacos)).toBeLessThan(0.01) // Within 1% tolerance
        }
      }
    })

    it('should calculate advertising correctly for all years', async () => {
      for (let year = 2025; year <= 2030; year++) {
        let yearRevenue = 0
        let yearExpectedAd = 0
        
        for (let quarter = 1; quarter <= 4; quarter++) {
          const salesRes = await fetch(`${API_BASE}/unit-sales?year=${year}&quarter=${quarter}`)
          const salesData = await salesRes.json()
          const sales = salesData.sales || []

          for (const sale of sales) {
            const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
            if (product) {
              const revenue = sale.units * product.price
              yearRevenue += revenue
              yearExpectedAd += revenue * product.tacos
            }
          }
        }

        // Get actual advertising for the year
        const glRes = await fetch(`${API_BASE}/reports/gl-annual-summary?year=${year}`)
        const glData = await glRes.json()
        const actualAdvertising = glData.accounts?.['7010'] || 0

        const overallTacos = yearRevenue > 0 ? yearExpectedAd / yearRevenue : 0
        console.log(`Year ${year}: Revenue ${yearRevenue.toFixed(0)}, TACoS ${(overallTacos * 100).toFixed(1)}%, Expected Ad ${yearExpectedAd.toFixed(2)}, Actual ${actualAdvertising.toFixed(2)}`)
        
        if (yearExpectedAd > 0) {
          expect(Math.abs(actualAdvertising - yearExpectedAd)).toBeLessThan(100) // Allow $100 difference for full year
        }
      }
    })
  })

  describe('Revenue Accuracy', () => {
    it('should calculate gross revenue accurately', async () => {
      // Revenue accuracy is critical for TACoS and referral fee calculations
      const salesRes = await fetch(`${API_BASE}/unit-sales?year=2025&quarter=4`)
      const salesData = await salesRes.json()
      const sales = salesData.sales || []

      let expectedRevenue = 0
      for (const sale of sales) {
        const product = PRODUCTS[sale.sku as keyof typeof PRODUCTS]
        if (product) {
          expectedRevenue += sale.units * product.price
        }
      }

      // Get actual revenue from GL (account 4010)
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualRevenue = Math.abs(glData.accounts['4010'] || 0) // Revenue is negative in GL

      console.log(`Q4 2025 Revenue: Expected ${expectedRevenue.toFixed(2)}, Actual ${actualRevenue.toFixed(2)}`)
      expect(Math.abs(actualRevenue - expectedRevenue)).toBeLessThan(1)
    })

    it('should track net revenue after fees correctly', async () => {
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      
      const grossRevenue = Math.abs(glData.accounts['4010'] || 0)
      const referralFees = glData.accounts['6040'] || 0
      const returnAllowance = grossRevenue * AMAZON_RETURN_ALLOWANCE
      
      const expectedNetRevenue = grossRevenue - referralFees - returnAllowance
      
      // Net revenue = Gross - Referral (15%) - Return Allowance (0.5%)
      // Which should be roughly 84.5% of gross
      const netRatio = expectedNetRevenue / grossRevenue
      expect(netRatio).toBeCloseTo(0.845, 2)
    })
  })
})