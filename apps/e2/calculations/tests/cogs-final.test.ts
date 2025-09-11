/**
 * Final COGS Verification Tests
 */

import { describe, it, expect } from 'vitest'

const API_BASE = 'http://localhost:4321/api'

// Helper to aggregate GL entries by account
function aggregateGLByAccount(entries: any[]): Record<string, number> {
  const accounts: Record<string, number> = {}
  for (const entry of entries) {
    const account = entry.accountCode
    const amount = entry.amount
    if (!accounts[account]) {
      accounts[account] = 0
    }
    // For expense accounts, debits are positive
    // For revenue accounts, credits are negative
    accounts[account] += amount
  }
  return accounts
}

describe('COGS Final Verification', () => {
  
  it('should verify Q4 2025 COGS calculations', async () => {
    // Get GL entries for Q4 2025
    const glRes = await fetch(`${API_BASE}/gl/entries?year=2025&quarter=4`)
    const glData = await glRes.json()
    const entries = glData.entries || []
    
    // Aggregate by account
    const accounts = aggregateGLByAccount(entries)
    
    const manufacturing = accounts['5020'] || 0
    const oceanFreight = accounts['5030'] || 0
    const tariffs = accounts['5040'] || 0
    const landFreight = accounts['5031'] || accounts['5050'] || 0 // Could be either code
    
    console.log('\n=== Q4 2025 COGS Components ===')
    console.log(`Manufacturing (5020): $${manufacturing.toFixed(2)}`)
    console.log(`Ocean Freight (5030): $${oceanFreight.toFixed(2)}`)
    console.log(`Tariffs (5040): $${tariffs.toFixed(2)}`)
    console.log(`Land Freight (5031/5050): $${landFreight.toFixed(2)}`)
    console.log(`Total COGS: $${(manufacturing + oceanFreight + tariffs + landFreight).toFixed(2)}`)
    
    // Verify tariffs are 35% of (Manufacturing + Ocean Freight)
    const expectedTariffs = (manufacturing + oceanFreight) * 0.35
    const tariffRate = manufacturing + oceanFreight > 0 ? tariffs / (manufacturing + oceanFreight) : 0
    
    console.log('\n=== Tariff Verification ===')
    console.log(`Manufacturing + Ocean Freight: $${(manufacturing + oceanFreight).toFixed(2)}`)
    console.log(`Expected Tariffs (35%): $${expectedTariffs.toFixed(2)}`)
    console.log(`Actual Tariffs: $${tariffs.toFixed(2)}`)
    console.log(`Actual Rate: ${(tariffRate * 100).toFixed(1)}%`)
    console.log(`Difference: $${Math.abs(tariffs - expectedTariffs).toFixed(2)}`)
    
    // Test assertions
    expect(manufacturing).toBeCloseTo(45286.56, 2)
    expect(oceanFreight).toBeCloseTo(8689.26, 2)
    expect(tariffs).toBeCloseTo(18891.53, 2)
    expect(Math.abs(tariffRate - 0.35)).toBeLessThan(0.01) // Within 1% of 35%
  })

  it('should verify all years tariff calculations', async () => {
    console.log('\n=== Tariff Verification for All Years ===')
    
    const yearlyData: Record<number, any> = {}
    
    // Collect data for all years
    for (let year = 2025; year <= 2030; year++) {
      yearlyData[year] = { manufacturing: 0, freight: 0, tariffs: 0 }
      
      for (let quarter = 1; quarter <= 4; quarter++) {
        const glRes = await fetch(`${API_BASE}/gl/entries?year=${year}&quarter=${quarter}`)
        const glData = await glRes.json()
        const entries = glData.entries || []
        
        const accounts = aggregateGLByAccount(entries)
        yearlyData[year].manufacturing += accounts['5020'] || 0
        yearlyData[year].freight += accounts['5030'] || 0
        yearlyData[year].tariffs += accounts['5040'] || 0
      }
    }
    
    // Verify each year
    for (let year = 2025; year <= 2030; year++) {
      const data = yearlyData[year]
      const expectedTariffs = (data.manufacturing + data.freight) * 0.35
      const actualRate = data.manufacturing + data.freight > 0 
        ? data.tariffs / (data.manufacturing + data.freight) 
        : 0
      
      console.log(`\nYear ${year}:`)
      console.log(`  Manufacturing: $${data.manufacturing.toFixed(2)}`)
      console.log(`  Ocean Freight: $${data.freight.toFixed(2)}`)
      console.log(`  FOB Total: $${(data.manufacturing + data.freight).toFixed(2)}`)
      console.log(`  Expected Tariffs (35%): $${expectedTariffs.toFixed(2)}`)
      console.log(`  Actual Tariffs: $${data.tariffs.toFixed(2)}`)
      console.log(`  Actual Rate: ${(actualRate * 100).toFixed(1)}%`)
      console.log(`  Difference: $${Math.abs(data.tariffs - expectedTariffs).toFixed(2)}`)
      
      if (data.manufacturing > 0) {
        expect(Math.abs(actualRate - 0.35)).toBeLessThan(0.01) // Within 1%
      }
    }
  })

  it('should verify Amazon expenses are calculated correctly', async () => {
    // Get GL entries for Q4 2025
    const glRes = await fetch(`${API_BASE}/gl/entries?year=2025&quarter=4`)
    const glData = await glRes.json()
    const entries = glData.entries || []
    
    const accounts = aggregateGLByAccount(entries)
    
    // Amazon expense accounts
    const advertising = accounts['5310'] || 0
    const awd = accounts['5032'] || 0
    const revenue = Math.abs(accounts['4010'] || 0) // Revenue is negative
    
    console.log('\n=== Q4 2025 Amazon Expenses ===')
    console.log(`Gross Revenue: $${revenue.toFixed(2)}`)
    console.log(`Advertising (5310): $${advertising.toFixed(2)}`)
    console.log(`AWD (5032): $${awd.toFixed(2)}`)
    
    // Calculate TACoS
    const tacos = revenue > 0 ? advertising / revenue : 0
    console.log(`TACoS: ${(tacos * 100).toFixed(1)}%`)
    
    // Referral fees should be 15% of revenue
    const expectedReferral = revenue * 0.15
    console.log(`\nExpected Referral (15% of revenue): $${expectedReferral.toFixed(2)}`)
    
    // Test that values exist and are reasonable
    expect(revenue).toBeGreaterThan(0)
    expect(advertising).toBeGreaterThan(0)
    expect(awd).toBeGreaterThan(0)
    expect(tacos).toBeGreaterThan(0.05) // Should be at least 5%
    expect(tacos).toBeLessThan(0.20) // Should be less than 20%
  })

  it('should verify total COGS hierarchy', async () => {
    const glRes = await fetch(`${API_BASE}/gl/entries?year=2025&quarter=4`)
    const glData = await glRes.json()
    const entries = glData.entries || []
    
    const accounts = aggregateGLByAccount(entries)
    
    // COGS components
    const manufacturing = accounts['5020'] || 0
    const oceanFreight = accounts['5030'] || 0
    const tariffs = accounts['5040'] || 0
    const landFreight = accounts['5031'] || accounts['5050'] || 0
    
    const totalCOGS = manufacturing + oceanFreight + tariffs + landFreight
    
    console.log('\n=== COGS Hierarchy Verification ===')
    console.log('Direct Costs:')
    console.log(`  Manufacturing: $${manufacturing.toFixed(2)}`)
    console.log(`  Ocean Freight: $${oceanFreight.toFixed(2)}`)
    console.log(`  Subtotal (FOB): $${(manufacturing + oceanFreight).toFixed(2)}`)
    console.log('\nDerived Costs:')
    console.log(`  Tariffs (35% of FOB): $${tariffs.toFixed(2)}`)
    console.log(`  Land Freight: $${landFreight.toFixed(2)}`)
    console.log(`\nTotal COGS: $${totalCOGS.toFixed(2)}`)
    
    // Verify relationships
    const expectedTariffs = (manufacturing + oceanFreight) * 0.35
    expect(Math.abs(tariffs - expectedTariffs)).toBeLessThan(1)
    expect(totalCOGS).toBeGreaterThan(50000) // Should be substantial
  })
})