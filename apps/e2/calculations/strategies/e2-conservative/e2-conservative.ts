#!/usr/bin/env npx tsx
/**
 * E2 Conservative Strategy Seeding Script
 * Uses modular components for clean organization
 */

import { seedProducts } from './products'
import { seedSales, seedMultiChannelRevenue } from './sales'
import { seedOrderTimeline } from './orders'
import { seedExpenses } from './expenses'
import { seedBankStatementExpenses } from './expense-rules/bank-statement'
import createInventoryAdjustments from './inventory-adjustments'
import createCashbackEntries from './cashback'
import { API_BASE, TIMELINE, FINANCIAL } from './business-logic'

async function seedE2Conservative() {
  console.log('🚀 SEEDING E2 CONSERVATIVE STRATEGY VIA API')
  console.log('=' .repeat(60))
  
  // Check server is running
  try {
    const response = await fetch(`${API_BASE}/products`)
    if (!response.ok) throw new Error('Server not responding')
  } catch (error) {
    console.error('\n❌ Server is not running. Start it with: npm run dev')
    console.error('   Error:', error)
    process.exit(1)
  }
  
  // 0. Seed Amazon FBA fees (must be done before products!)
  console.log('\n0. SEEDING AMAZON FBA FEES...')
  const { execSync } = await import('child_process')
  execSync('npx tsx scripts/seed-amazon-fba-fees.ts', { stdio: 'inherit', cwd: '/Users/jarraramjad/Documents/ecom_os/E2/calculations' })
  
  // Get active strategy
  console.log('\n🔍 CHECKING FOR ACTIVE STRATEGY...')
  const strategyResponse = await fetch(`${API_BASE}/strategies`)
  if (!strategyResponse.ok) {
    console.error('❌ Failed to fetch strategies')
    process.exit(1)
  }
  const strategies = await strategyResponse.json()
  const activeStrategy = strategies.find((s: any) => s.isActive)
  
  if (!activeStrategy) {
    console.error('❌ No active strategy found. Please create and activate a strategy first.')
    console.log('   Available strategies:', strategies.map((s: any) => `${s.name} (${s.isActive ? 'active' : 'inactive'})`).join(', '))
    process.exit(1)
  }
  
  console.log(`  ✅ Found active strategy: ${activeStrategy.name} (ID: ${activeStrategy.id})`)
  
  // Clean up existing data
  const { cleanStrategyData } = await import('./clean')
  await cleanStrategyData(activeStrategy.id)
  
  // 1. Seed products
  console.log('\n1. SEEDING PRODUCTS...')
  await seedProducts(activeStrategy.id)
  
  // 2. Create opening balance
  console.log('\n2. CREATING OPENING BALANCE...')
  const openingBalanceDate = new Date(TIMELINE.OPENING_BALANCE_DATE)
  
  const openingBalanceResponse = await fetch(`${API_BASE}/gl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addEntries',
      strategyId: activeStrategy.id,
      data: [
        {
          date: openingBalanceDate,
          account: '1000',
          accountCategory: 'Asset',
          description: 'Opening Balance - Cash',
          debit: FINANCIAL.OPENING_CASH_BALANCE,
          credit: 0,
          reference: TIMELINE.OPENING_BALANCE_REFERENCE
        },
        {
          date: openingBalanceDate,
          account: '3000',
          accountCategory: 'Equity',
          description: 'Opening Balance - Owner\'s Equity',
          debit: 0,
          credit: FINANCIAL.OPENING_CASH_BALANCE,
          reference: TIMELINE.OPENING_BALANCE_REFERENCE
        }
      ]
    })
  })
  
  if (openingBalanceResponse.ok) {
    console.log(`  ✅ Created opening balance entries: ${FINANCIAL.HELPERS?.formatCurrency?.(FINANCIAL.OPENING_CASH_BALANCE) || '$' + FINANCIAL.OPENING_CASH_BALANCE.toLocaleString()} cash`)
  }
  
  // 3. Seed sales data
  console.log('\n3. SEEDING SALES DATA...')
  await seedSales(activeStrategy.id)
  
  // 4. Seed order timeline
  console.log('\n4. SEEDING ORDER TIMELINE...')
  await seedOrderTimeline(activeStrategy.id)
  
  // 5. Create operating expenses using expense rules
  console.log('\n5. CREATING OPERATING EXPENSES...')
  await seedExpenses(activeStrategy.id)
  
  // 5.1. Create bank statement expenses
  console.log('\n5.1 CREATING BANK STATEMENT EXPENSES...')
  await seedBankStatementExpenses(activeStrategy.id, API_BASE)
  
  // 6. Create multi-channel revenue (Walmart and Retail)
  console.log('\n6. CREATING MULTI-CHANNEL REVENUE...')
  await seedMultiChannelRevenue(activeStrategy.id)
  
  // 7. Create year-end inventory adjustments
  console.log('\n7. CREATING YEAR-END INVENTORY ADJUSTMENTS...')
  await createInventoryAdjustments(activeStrategy.id)
  
  // 8. Create cashback entries based on actual expenses
  console.log('\n8. CREATING CASHBACK ENTRIES...')
  await createCashbackEntries(activeStrategy.id)
  
  console.log('\n' + '=' .repeat(60))
  console.log('✅ E2 CONSERVATIVE STRATEGY DATA SEEDED')
  console.log('=' .repeat(60))
}

// Run the script
seedE2Conservative().catch(console.error)