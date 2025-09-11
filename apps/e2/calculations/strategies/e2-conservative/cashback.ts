#!/usr/bin/env npx tsx
/**
 * Create cashback entries based on actual expenses
 * Cashback rate configured in business logic
 */

import { API_BASE, FINANCIAL } from './business-logic'

export default async function createCashbackEntries(strategyId: string) {
  console.log('💳 CREATING CASHBACK ENTRIES...')
  
  // Eligible expense accounts for cashback: Operating expenses (except payroll/tax) + Advertising
  const CASHBACK_ELIGIBLE_ACCOUNTS = [
    // Operating expenses (EXCLUDING 5100 Payroll and 5110 Payroll Tax)
    '5120', '5130', '5140', '5150', '5160', '5170', '5180', '5190', // Operating expenses
    '5200', '5210', '5220', '5230', '5240', '5250', '5260', '5270', '5280', '5290',
    '5300', '5310', '5320', '5330', '5340', '5350', '5360', '5370', '5380', '5390', // Including 5310 (Advertising - can be paid with credit card)
    '5400', '5410', '5420', '5430', '5440', '5450', '5460', '5470', '5480', '5490',
    '5500', '5510', '5520', '5530', '5540', '5550', '5560', '5570', '5580', '5590',
    '5600', '5610', '5620', '5630', '5640', '5650', '5660', '5670', '5680', '5690',
    '5700', '5710', // Travel and Meals - can be paid with credit card
    // EXCLUDING 5720 (Depreciation) - non-cash expense
    '5730', '5740', '5750', '5760', '5770', '5780', '5790',
    '5800', '5810', '5820', '5830', '5840', '5850', '5860', '5870', '5880', '5890',
    '5900', '5910', '5920', '5930', '5940', '5950', '5960', '5970', '5980', '5990'
  ]
  
  // Get all GL entries for eligible accounts
  const response = await fetch(`${API_BASE}/gl/raw-entries?strategyId=${strategyId}`)
  if (!response.ok) {
    console.error('Failed to fetch GL entries')
    return
  }
  
  const { entries } = await response.json()
  
  // Calculate monthly cashback
  const monthlyTotals: Record<string, number> = {}
  
  for (const entry of entries) {
    if (CASHBACK_ELIGIBLE_ACCOUNTS.includes(entry.account) && entry.debit > 0) {
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = 0
      }
      
      monthlyTotals[monthKey] += entry.debit
    }
  }
  
  // Create cashback entries (1.5% of eligible expenses)
  const cashbackEntries = []
  
  console.log(`  Found ${Object.keys(monthlyTotals).length} months with eligible expenses`)
  
  for (const [monthKey, total] of Object.entries(monthlyTotals)) {
    const cashbackAmount = total * FINANCIAL.CASHBACK_RATE
    if (cashbackAmount > 0) {
      const [year, month] = monthKey.split('-')
      // Post cashback on last day of month
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
      const date = new Date(`${year}-${month}-${lastDay}`)
      
      // Credit to cash (1000), debit to interest income (4900)
      cashbackEntries.push({
        date: date.toISOString(),
        account: '1000',
        accountCategory: 'Asset',
        description: `Credit Card Cashback - ${monthKey}`,
        debit: cashbackAmount,
        credit: 0,
        reference: `CASHBACK-${monthKey}`
      })
      
      cashbackEntries.push({
        date: date.toISOString(),
        account: '4900',
        accountCategory: 'Revenue',
        description: `Credit Card Cashback - ${monthKey}`,
        debit: 0,
        credit: cashbackAmount,
        reference: `CASHBACK-${monthKey}`
      })
    }
  }
  
  // Post cashback entries to GL
  if (cashbackEntries.length > 0) {
    const glResponse = await fetch(`${API_BASE}/gl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'addEntries',
        strategyId,
        data: cashbackEntries
      })
    })
    
    if (glResponse.ok) {
      const totalCashback = Object.values(monthlyTotals).reduce((sum, total) => sum + total * FINANCIAL.CASHBACK_RATE, 0)
      console.log(`  ✅ Created ${cashbackEntries.length / 2} monthly cashback entries`)
      console.log(`     Total cashback: $${totalCashback.toFixed(2)}`)
    } else {
      const errorText = await glResponse.text()
      console.error('  ❌ Failed to create cashback entries:', errorText)
    }
  }
}

// Run if called directly
if (require.main === module) {
  const strategyId = process.argv[2]
  if (!strategyId) {
    console.error('Usage: npx tsx cashback.ts <strategyId>')
    process.exit(1)
  }
  createCashbackEntries(strategyId).catch(console.error)
}