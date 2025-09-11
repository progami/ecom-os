/**
 * Simplified COGS Tests - Tests core calculations
 */

import { describe, it, expect } from 'vitest'

const API_BASE = 'http://localhost:4321/api'

// Product definitions from strategy
const PRODUCTS = {
  '6PK - 7M': { manufacturing: 0.57, freight: 0.10, tariffRate: 0.35 },
  '12PK - 7M': { manufacturing: 1.14, freight: 0.25, tariffRate: 0.35 },
  '1PK - 32M': { manufacturing: 0.40, freight: 0.08, tariffRate: 0.35 },
  '3PK - 32M': { manufacturing: 1.20, freight: 0.21, tariffRate: 0.35 }
}

describe('COGS Verification Tests', () => {
  it('should verify Q4 2025 COGS calculations are correct', async () => {
    // Get GL report for Q4 2025
    const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
    const glData = await glRes.json()
    
    const manufacturing = glData.accounts['5020'] || 0
    const oceanFreight = glData.accounts['5030'] || 0
    const tariffs = glData.accounts['5040'] || 0
    const landFreight = glData.accounts['5050'] || 0
    
    console.log('\n=== Q4 2025 COGS Components ===')
    console.log(`Manufacturing: $${manufacturing.toFixed(2)}`)
    console.log(`Ocean Freight: $${oceanFreight.toFixed(2)}`)
    console.log(`Tariffs: $${tariffs.toFixed(2)}`)
    console.log(`Land Freight: $${landFreight.toFixed(2)}`)
    console.log(`Total COGS: $${(manufacturing + oceanFreight + tariffs + landFreight).toFixed(2)}`)
    
    // Verify tariff calculation (35% of Manufacturing + Ocean Freight)
    const expectedTariffs = (manufacturing + oceanFreight) * 0.35
    console.log(`\nExpected Tariffs (35% of Mfg+Freight): $${expectedTariffs.toFixed(2)}`)
    console.log(`Actual Tariffs: $${tariffs.toFixed(2)}`)
    console.log(`Difference: $${Math.abs(tariffs - expectedTariffs).toFixed(2)}`)
    
    // Test that tariffs are calculated correctly
    expect(Math.abs(tariffs - expectedTariffs)).toBeLessThan(1)
    
    // Test that all components exist
    expect(manufacturing).toBeGreaterThan(0)
    expect(oceanFreight).toBeGreaterThan(0)
    expect(tariffs).toBeGreaterThan(0)
    expect(landFreight).toBeGreaterThan(0)
  })

  it('should verify order quantities match expected values', async () => {
    // Hardcoded orders from strategy
    const expectedOrders = {
      '6PK - 7M': 12544 + 29440, // W40 + W43
      '12PK - 7M': 4096 + 9696,
      '1PK - 32M': 1680 + 4032,
      '3PK - 32M': 840 + 1950
    }
    
    // Get order timeline
    const ordersRes = await fetch(`${API_BASE}/order-timeline?year=2025&quarter=4`)
    const ordersData = await ordersRes.json()
    const orders = ordersData.orders || []
    
    // Sum quantities by SKU
    const actualOrders: Record<string, number> = {}
    for (const order of orders) {
      if (!actualOrders[order.sku]) {
        actualOrders[order.sku] = 0
      }
      actualOrders[order.sku] += order.quantity
    }
    
    console.log('\n=== Q4 2025 Order Quantities ===')
    for (const sku of Object.keys(expectedOrders)) {
      const expected = expectedOrders[sku as keyof typeof expectedOrders]
      const actual = actualOrders[sku] || 0
      console.log(`${sku}: Expected ${expected}, Actual ${actual}`)
      expect(actual).toBe(expected)
    }
  })

  it('should calculate manufacturing costs correctly', async () => {
    // Get orders
    const ordersRes = await fetch(`${API_BASE}/order-timeline?year=2025&quarter=4`)
    const ordersData = await ordersRes.json()
    const orders = ordersData.orders || []
    
    // Calculate expected manufacturing
    let expectedMfg = 0
    for (const order of orders) {
      const product = PRODUCTS[order.sku as keyof typeof PRODUCTS]
      if (product) {
        expectedMfg += order.quantity * product.manufacturing
      }
    }
    
    // Get actual from GL
    const glRes = await fetch(`${API_BASE}/reports/gl-report?year=2025&quarter=4`)
    const glData = await glRes.json()
    const actualMfg = glData.accounts['5020'] || 0
    
    console.log('\n=== Manufacturing Cost Verification ===')
    console.log(`Expected: $${expectedMfg.toFixed(2)}`)
    console.log(`Actual: $${actualMfg.toFixed(2)}`)
    console.log(`Difference: $${Math.abs(actualMfg - expectedMfg).toFixed(2)}`)
    
    expect(Math.abs(actualMfg - expectedMfg)).toBeLessThan(1)
  })

  it('should verify all years have correct tariff calculations', async () => {
    console.log('\n=== Tariff Verification for All Years ===')
    
    for (let year = 2025; year <= 2030; year++) {
      // Get GL data for full year
      let yearMfg = 0
      let yearFreight = 0
      let yearTariffs = 0
      
      for (let q = 1; q <= 4; q++) {
        const glRes = await fetch(`${API_BASE}/reports/gl-report?year=${year}&quarter=${q}`)
        const glData = await glRes.json()
        
        yearMfg += glData.accounts?.['5020'] || 0
        yearFreight += glData.accounts?.['5030'] || 0
        yearTariffs += glData.accounts?.['5040'] || 0
      }
      
      const expectedTariffs = (yearMfg + yearFreight) * 0.35
      const tariffRate = yearMfg + yearFreight > 0 ? yearTariffs / (yearMfg + yearFreight) : 0
      
      console.log(`\nYear ${year}:`)
      console.log(`  Manufacturing: $${yearMfg.toFixed(2)}`)
      console.log(`  Ocean Freight: $${yearFreight.toFixed(2)}`)
      console.log(`  FOB Total: $${(yearMfg + yearFreight).toFixed(2)}`)
      console.log(`  Expected Tariffs (35%): $${expectedTariffs.toFixed(2)}`)
      console.log(`  Actual Tariffs: $${yearTariffs.toFixed(2)}`)
      console.log(`  Actual Rate: ${(tariffRate * 100).toFixed(1)}%`)
      console.log(`  Difference: $${Math.abs(yearTariffs - expectedTariffs).toFixed(2)}`)
      
      if (yearMfg > 0) { // Only test years with data
        expect(Math.abs(tariffRate - 0.35)).toBeLessThan(0.01) // Within 1% of 35%
      }
    }
  })
})