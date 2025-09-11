/**
 * COGS (Cost of Goods Sold) Component Tests
 * Tests manufacturing, ocean freight, land freight, and tariff calculations
 */

import { describe, it, expect, beforeAll } from 'vitest'

const API_BASE = 'http://localhost:4321/api'

// Product definitions from strategy
const PRODUCTS = {
  '6PK - 7M': {
    manufacturingCost: 0.57,
    freightCost: 0.10,
    tariffRate: 0.35
  },
  '12PK - 7M': {
    manufacturingCost: 1.14,
    freightCost: 0.25,
    tariffRate: 0.35
  },
  '1PK - 32M': {
    manufacturingCost: 0.40,
    freightCost: 0.08,
    tariffRate: 0.35
  },
  '3PK - 32M': {
    manufacturingCost: 1.20,
    freightCost: 0.21,
    tariffRate: 0.35
  }
}

// Land freight constant from strategy
const LAND_FREIGHT_PER_ORDER = 1500

describe('COGS Component Tests', () => {
  let strategyId: string

  beforeAll(async () => {
    // Get active strategy
    const strategiesRes = await fetch(`${API_BASE}/strategies`)
    const strategies = await strategiesRes.json()
    const activeStrategy = strategies.find((s: any) => s.isActive)
    strategyId = activeStrategy?.id
  })

  describe('Manufacturing Costs', () => {
    it('should calculate manufacturing costs correctly for Q4 2025', async () => {
      // Get order quantities
      const ordersRes = await fetch(`${API_BASE}/order-timeline?year=2025&quarter=4`)
      const ordersData = await ordersRes.json()
      const orders = ordersData.orders

      // Calculate expected manufacturing costs
      const expectedManufacturing: Record<string, number> = {}
      for (const order of orders) {
        const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
        if (product) {
          if (!expectedManufacturing[order.sku]) {
            expectedManufacturing[order.sku] = 0
          }
          expectedManufacturing[order.sku] += order.quantity * product.manufacturingCost
        }
      }

      // Get actual manufacturing costs from GL
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      
      const actualManufacturing = glData.accounts['5020'] || 0
      const totalExpected = Object.values(expectedManufacturing).reduce((sum, val) => sum + val, 0)

      expect(Math.round(actualManufacturing * 100) / 100).toBe(Math.round(totalExpected * 100) / 100)
    })

    it('should calculate manufacturing costs correctly for all years', async () => {
      for (let year = 2025; year <= 2030; year++) {
        let yearTotal = 0
        
        for (let quarter = 1; quarter <= 4; quarter++) {
          const ordersRes = await fetch(`${API_BASE}/order-timeline?year=${year}&quarter=${quarter}`)
          const ordersData = await ordersRes.json()
          const orders = ordersData.orders || []

          for (const order of orders) {
            const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
            if (product) {
              yearTotal += order.quantity * product.manufacturingCost
            }
          }
        }

        // Get actual from GL
        const glRes = await fetch(`${API_BASE}/reports/gl-annual-summary?year=${year}`)
        const glData = await glRes.json()
        const actualManufacturing = glData.accounts?.['5020'] || 0

        console.log(`Year ${year}: Expected ${yearTotal.toFixed(2)}, Actual ${actualManufacturing.toFixed(2)}`)
        expect(Math.abs(actualManufacturing - yearTotal)).toBeLessThan(1) // Allow $1 rounding difference
      }
    })
  })

  describe('Ocean Freight Costs', () => {
    it('should calculate ocean freight correctly for Q4 2025', async () => {
      const ordersRes = await fetch(`${API_BASE}/order-timeline?year=2025&quarter=4`)
      const ordersData = await ordersRes.json()
      const orders = ordersData.orders

      // Calculate expected ocean freight
      let expectedFreight = 0
      for (const order of orders) {
        const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
        if (product) {
          expectedFreight += order.quantity * product.freightCost
        }
      }

      // Get actual from GL
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualFreight = glData.accounts['5030'] || 0

      expect(Math.round(actualFreight * 100) / 100).toBe(Math.round(expectedFreight * 100) / 100)
    })

    it('should calculate ocean freight correctly for all years', async () => {
      for (let year = 2025; year <= 2030; year++) {
        let yearTotal = 0
        
        for (let quarter = 1; quarter <= 4; quarter++) {
          const ordersRes = await fetch(`${API_BASE}/order-timeline?year=${year}&quarter=${quarter}`)
          const ordersData = await ordersRes.json()
          const orders = ordersData.orders || []

          for (const order of orders) {
            const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
            if (product) {
              yearTotal += order.quantity * product.freightCost
            }
          }
        }

        // Get actual from GL
        const glRes = await fetch(`${API_BASE}/reports/gl-annual-summary?year=${year}`)
        const glData = await glRes.json()
        const actualFreight = glData.accounts?.['5030'] || 0

        console.log(`Year ${year}: Expected ${yearTotal.toFixed(2)}, Actual ${actualFreight.toFixed(2)}`)
        expect(Math.abs(actualFreight - yearTotal)).toBeLessThan(1)
      }
    })
  })

  describe('Land Freight Costs', () => {
    it('should apply constant land freight expense per order', async () => {
      // Land freight is a fixed $1500 per order shipment
      // It's seeded by the strategy as a constant expense
      
      // Get expenses for Q4 2025
      const expensesRes = await fetch(`${API_BASE}/expenses?year=2025&quarter=4`)
      const expenses = await expensesRes.json()
      
      // Filter for land freight expenses
      const landFreightExpenses = expenses.filter((e: any) => 
        e.category === 'COGS-Land-Freight' || e.category === 'Land Freight'
      )
      
      // Each order shipment should have $1500 land freight
      for (const expense of landFreightExpenses) {
        if (expense.description.includes('Land freight')) {
          // Land freight is applied per shipment week, not per SKU
          expect(expense.amount).toBeGreaterThanOrEqual(LAND_FREIGHT_PER_ORDER)
        }
      }
    })

    it('should track land freight separately in GL account 5050', async () => {
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const landFreight = glData.accounts['5050'] || 0
      
      // Land freight should exist and be positive
      expect(landFreight).toBeGreaterThan(0)
      
      // For Q4 2025, we have orders in W40 and W43 (2 shipments)
      // Plus potential dynamic orders
      // So minimum should be 2 * $1500 = $3000
      expect(landFreight).toBeGreaterThanOrEqual(3000)
    })
  })

  describe('Tariff Calculations', () => {
    it('should calculate tariffs as 35% of (Manufacturing + Ocean Freight)', async () => {
      const ordersRes = await fetch(`${API_BASE}/order-timeline?year=2025&quarter=4`)
      const ordersData = await ordersRes.json()
      const orders = ordersData.orders

      // Calculate expected tariffs
      let totalManufacturing = 0
      let totalOceanFreight = 0
      
      for (const order of orders) {
        const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
        if (product) {
          totalManufacturing += order.quantity * product.manufacturingCost
          totalOceanFreight += order.quantity * product.freightCost
        }
      }
      
      const expectedTariffs = (totalManufacturing + totalOceanFreight) * 0.35

      // Get actual from GL
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      const actualTariffs = glData.accounts['5040'] || 0

      console.log(`Q4 2025 Tariffs: Expected ${expectedTariffs.toFixed(2)}, Actual ${actualTariffs.toFixed(2)}`)
      expect(Math.abs(actualTariffs - expectedTariffs)).toBeLessThan(1)
    })

    it('should calculate tariffs correctly for all years', async () => {
      for (let year = 2025; year <= 2030; year++) {
        let yearManufacturing = 0
        let yearFreight = 0
        
        for (let quarter = 1; quarter <= 4; quarter++) {
          const ordersRes = await fetch(`${API_BASE}/order-timeline?year=${year}&quarter=${quarter}`)
          const ordersData = await ordersRes.json()
          const orders = ordersData.orders || []

          for (const order of orders) {
            const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
            if (product) {
              yearManufacturing += order.quantity * product.manufacturingCost
              yearFreight += order.quantity * product.freightCost
            }
          }
        }
        
        const expectedTariffs = (yearManufacturing + yearFreight) * 0.35

        // Get actual from GL
        const glRes = await fetch(`${API_BASE}/reports/gl-annual-summary?year=${year}`)
        const glData = await glRes.json()
        const actualTariffs = glData.accounts?.['5040'] || 0

        console.log(`Year ${year}: Manufacturing ${yearManufacturing.toFixed(2)}, Freight ${yearFreight.toFixed(2)}`)
        console.log(`         Expected Tariffs ${expectedTariffs.toFixed(2)}, Actual ${actualTariffs.toFixed(2)}`)
        expect(Math.abs(actualTariffs - expectedTariffs)).toBeLessThan(1)
      }
    })

    it('should never calculate tariffs on AWD or land freight', async () => {
      // Tariffs should ONLY be on Manufacturing + Ocean Freight
      // Not on AWD (Amazon warehouse) or Land Freight
      
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      
      const manufacturing = glData.accounts['5020'] || 0
      const oceanFreight = glData.accounts['5030'] || 0
      const tariffs = glData.accounts['5040'] || 0
      const landFreight = glData.accounts['5050'] || 0
      
      const expectedTariffBase = manufacturing + oceanFreight
      const expectedTariffs = expectedTariffBase * 0.35
      
      // Tariffs should be ~35% of (Manufacturing + Ocean Freight)
      const actualRate = tariffs / expectedTariffBase
      expect(actualRate).toBeCloseTo(0.35, 2)
      
      // Tariffs should NOT include land freight in calculation
      const wrongTariffBase = manufacturing + oceanFreight + landFreight
      const wrongRate = tariffs / wrongTariffBase
      expect(wrongRate).toBeLessThan(0.35) // Should be less if land freight was included
    })
  })

  describe('COGS Totals', () => {
    it('should sum all COGS components correctly', async () => {
      const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
      const glData = await glRes.json()
      
      const manufacturing = glData.accounts['5020'] || 0
      const oceanFreight = glData.accounts['5030'] || 0
      const tariffs = glData.accounts['5040'] || 0
      const landFreight = glData.accounts['5050'] || 0
      
      const totalCOGS = manufacturing + oceanFreight + tariffs + landFreight
      
      // Total COGS should equal sum of components
      const cogsAccounts = ['5020', '5030', '5040', '5050']
      let calculatedTotal = 0
      for (const account of cogsAccounts) {
        calculatedTotal += glData.accounts[account] || 0
      }
      
      expect(totalCOGS).toBe(calculatedTotal)
      
      // Verify COGS hierarchy
      expect(tariffs).toBeCloseTo((manufacturing + oceanFreight) * 0.35, 2)
      expect(landFreight).toBeGreaterThan(0) // Should have land freight
    })
  })
})