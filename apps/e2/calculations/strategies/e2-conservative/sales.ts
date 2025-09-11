/**
 * Sales forecasting for E2 Conservative Strategy
 * Generates sales data with 10% quarterly growth
 */

import { API_BASE, TIMELINE, SALES_CONFIG, BATCH_CONFIG, HELPERS } from './business-logic'

interface SalesData {
  week: number
  year: number
  quarter: number
  sku: string
  units: number
}

// Starting baseline for Week 40, 2025
const baseline: Record<string, number> = {
  '6PK - 7M': 1500,
  '12PK - 7M': 300,
  '1PK - 32M': 200,
  '3PK - 32M': 100
}

// Helper function to determine if a year has 53 weeks
function getWeeksInYear(year: number): number {
  const jan1 = new Date(year, 0, 1)
  const jan1Day = jan1.getDay() || 7
  
  if (jan1Day === 4) return 53
  
  const dec31 = new Date(year, 11, 31)
  const dec31Day = dec31.getDay() || 7
  
  if (dec31Day === 4) return 53
  
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
  if (isLeapYear && (jan1Day === 3 || dec31Day === 5)) return 53
  
  return 52
}

// Calculate weekly growth rate from quarterly growth rate
function calcWeeklyRate(quarterlyRate: number, weeksInQuarter: number): number {
  return Math.pow(1 + quarterlyRate, 1 / weeksInQuarter) - 1
}

export async function seedSales(strategyId?: string): Promise<SalesData[]> {
  console.log('1. CREATING SALES DATA...')
  
  // Check for active strategy
  if (!strategyId) {
    const strategiesRes = await fetch(`${API_BASE}/strategies`)
    const strategies = await strategiesRes.json()
    const activeStrategy = strategies.find((s: any) => s.isActive)
    if (!activeStrategy) {
      console.error('❌ No active strategy found. Please create and activate a strategy first.')
      return []
    }
    strategyId = activeStrategy.id
  }
  
  const salesData: SalesData[] = []
  const currentValues = { ...baseline }
  
  // Generate sales data from Q4 2025 to Q4 2030
  for (let year = 2025; year <= 2030; year++) {
    const startQ = year === 2025 ? 4 : 1
    const endQ = 4
    
    for (let quarter = startQ; quarter <= endQ; quarter++) {
      let startWeek = (quarter - 1) * 13 + 1
      let endWeek = quarter * 13
      
      const weeksInYear = getWeeksInYear(year)
      if (quarter === 4) {
        endWeek = weeksInYear
      } else {
        endWeek = Math.min(endWeek, 52)
      }
      
      if (year === TIMELINE.START_YEAR && quarter === 4) {
        startWeek = TIMELINE.BUSINESS_START_WEEK
      }
      
      let quarterlyGrowthRate = SALES_CONFIG.QUARTERLY_GROWTH_RATE
      const weeksInQuarter = endWeek - startWeek + 1
      const weeklyGrowthRate = calcWeeklyRate(quarterlyGrowthRate, weeksInQuarter)
      
      for (let week = startWeek; week <= endWeek; week++) {
        for (const [sku, value] of Object.entries(currentValues)) {
          const units = Math.round(value)
          salesData.push({
            week,
            year,
            quarter,
            sku,
            units
          })
          
          currentValues[sku] = value * (1 + weeklyGrowthRate)
        }
      }
    }
  }
  
  // Send sales data to API by year and quarter
  let totalSalesCreated = 0
  const salesByYearQuarter: Record<string, SalesData[]> = {}
  
  for (const sale of salesData) {
    const key = `${sale.year}-Q${sale.quarter}`
    
    if (!salesByYearQuarter[key]) {
      salesByYearQuarter[key] = []
    }
    salesByYearQuarter[key].push(sale)
  }
  
  for (const [yearQuarter, quarterSales] of Object.entries(salesByYearQuarter)) {
    const [year, q] = yearQuarter.split('-Q')
    
    const response = await fetch(`${API_BASE}/unit-sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: quarterSales.map(s => ({
          week: s.week,
          rowId: s.sku,
          value: s.units
        })),
        year: parseInt(year),
        quarter: parseInt(q),
        strategyId
      })
    })
    
    if (response.ok) {
      totalSalesCreated += quarterSales.length
      console.log(`    ${year} Q${q}: ${quarterSales.length} records`)
    } else {
      console.log(`    ${year} Q${q}: Failed - ${response.statusText}`)
    }
  }
  
  console.log(`  ✅ Created ${totalSalesCreated} sales records total`)
  
  return salesData
}

// Get sales data from API
export async function getSalesData(year?: number): Promise<SalesData[]> {
  let url = `${API_BASE}/unit-sales`
  if (year) {
    url += `?year=${year}`
  }
  
  const response = await fetch(url)
  if (!response.ok) {
    console.error('Failed to fetch sales data')
    return []
  }
  
  const data = await response.json()
  const sales: SalesData[] = []
  
  // API now returns week/quarter/year directly - no date conversion needed!
  for (const item of data.unitSales || data) {
    sales.push({
      week: item.week,
      year: item.year,
      quarter: item.quarter,
      sku: item.sku,
      units: item.units
    })
  }
  
  return sales
}

// Get product SKUs from API
export async function getProductSKUs(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/products`)
  if (!response.ok) {
    console.error('Failed to fetch products')
    return []
  }
  
  const products = await response.json()
  return products.map((p: any) => p.sku)
}

// Seed multi-channel revenue (Walmart and Retail) based on Amazon sales
export async function seedMultiChannelRevenue(strategyId?: string): Promise<void> {
  console.log('2. CREATING MULTI-CHANNEL REVENUE...')
  
  // Check for active strategy
  if (!strategyId) {
    const strategiesRes = await fetch(`${API_BASE}/strategies`)
    const strategies = await strategiesRes.json()
    const activeStrategy = strategies.find((s: any) => s.isActive)
    if (!activeStrategy) {
      console.error('❌ No active strategy found. Please create and activate a strategy first.')
      return
    }
    strategyId = activeStrategy.id
  }
  
  // Get all Amazon sales data to calculate revenue (all years)
  const amazonSales: any[] = []
  for (let year = 2025; year <= 2030; year++) {
    const yearData = await getSalesData(year)
    amazonSales.push(...yearData)
  }
  
  // Get products with pricing
  const productsRes = await fetch(`${API_BASE}/products?strategyId=${strategyId}`)
  const products = await productsRes.json()
  
  // Create pricing map
  const pricingMap: Record<string, number> = {}
  for (const product of products) {
    pricingMap[product.sku] = product.pricing || 0
  }
  
  // Helper function to get week date range
  function getWeekDateRange(year: number, week: number) {
    const firstDayOfYear = new Date(year, 0, 1)
    const dayOfWeek = firstDayOfYear.getDay()
    const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek)
    const firstMonday = new Date(year, 0, 1 + daysToMonday)
    const weekStart = new Date(firstMonday)
    weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    return { start: weekStart, end: weekEnd }
  }
  
  // Prepare GL entries for multi-channel revenue - weekly per SKU
  const glEntries = []
  
  for (const sale of amazonSales) {
    const { week, year, quarter, sku, units } = sale
    const price = pricingMap[sku] || 0
    const amazonRevenue = units * price
    
    // Calculate week dates and payment date (2 weeks after sale)
    const weekRange = getWeekDateRange(year, week)
    const paymentWeek = week + 2
    let adjustedPaymentWeek = paymentWeek
    let paymentYear = year
    
    if (paymentWeek > 52) {
      adjustedPaymentWeek = paymentWeek - 52
      paymentYear = year + 1
    }
    
    // Cap payment date at December 31 of end year
    if (paymentYear > TIMELINE.END_YEAR) {
      paymentYear = TIMELINE.END_YEAR
      adjustedPaymentWeek = 52
    }
    
    const paymentWeekRange = getWeekDateRange(paymentYear, adjustedPaymentWeek)
    const paymentDate = paymentWeekRange.start
    
    // Walmart: percentage of Amazon revenue from configured start
    if (year > SALES_CONFIG.WALMART_START.year || (year === SALES_CONFIG.WALMART_START.year && quarter >= SALES_CONFIG.WALMART_START.quarter)) {
      const walmartUnits = Math.round(units * SALES_CONFIG.WALMART_PERCENTAGE)
      const walmartRevenue = amazonRevenue * SALES_CONFIG.WALMART_PERCENTAGE
      if (walmartRevenue > 0) {
        // Revenue entry (cash to bank, revenue credit)
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Walmart Revenue - ${sku} (${walmartUnits} units) - W${week} sales paid W${adjustedPaymentWeek}`,
          debit: walmartRevenue,
          credit: 0,
          reference: `WALMART-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year, units: walmartUnits, paymentWeek: adjustedPaymentWeek, paymentYear }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '4001',
          accountCategory: 'Revenue',
          description: `Walmart Revenue - ${sku} (${walmartUnits} units) - W${week} sales paid W${adjustedPaymentWeek}`,
          debit: 0,
          credit: walmartRevenue,
          reference: `WALMART-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year, units: walmartUnits, paymentWeek: adjustedPaymentWeek, paymentYear }
        })
        
        // Refunds
        const walmartRefunds = walmartRevenue * SALES_CONFIG.WALMART_REFUND_RATE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '4010',
          accountCategory: 'Expense',
          description: `Refunds - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: walmartRefunds,
          credit: 0,
          reference: `WALMART-REFUND-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Refunds - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: 0,
          credit: walmartRefunds,
          reference: `WALMART-REFUND-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        // Walmart Referral Fee
        const walmartReferralFee = walmartRevenue * SALES_CONFIG.WALMART_REFERRAL_FEE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5050',
          accountCategory: 'Expense',
          description: `Referral Fees - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: walmartReferralFee,
          credit: 0,
          reference: `WALMART-REFERRAL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Referral Fees - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: 0,
          credit: walmartReferralFee,
          reference: `WALMART-REFERRAL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        // Walmart Fulfillment Fee (WFS)
        const walmartFulfillmentFee = walmartUnits * SALES_CONFIG.WALMART_FULFILLMENT_FEE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5051',
          accountCategory: 'Expense',
          description: `Fulfillment Fees - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: walmartFulfillmentFee,
          credit: 0,
          reference: `WALMART-WFS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Fulfillment Fees - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: 0,
          credit: walmartFulfillmentFee,
          reference: `WALMART-WFS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        // Advertising (TACoS)
        const walmartAdvertising = walmartRevenue * SALES_CONFIG.WALMART_ADVERTISING_RATE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5310',
          accountCategory: 'Expense',
          description: `Advertising - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: walmartAdvertising,
          credit: 0,
          reference: `WALMART-ADS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Advertising - Walmart - ${sku} (${walmartUnits} units) - W${week}`,
          debit: 0,
          credit: walmartAdvertising,
          reference: `WALMART-ADS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Walmart', sku, week, year }
        })
      }
    }
    
    // Retail: percentage of Amazon revenue from configured start
    if (year > SALES_CONFIG.RETAIL_START.year || (year === SALES_CONFIG.RETAIL_START.year && quarter >= SALES_CONFIG.RETAIL_START.quarter)) {
      const retailUnits = Math.round(units * SALES_CONFIG.RETAIL_PERCENTAGE)
      const retailRevenue = amazonRevenue * SALES_CONFIG.RETAIL_PERCENTAGE
      if (retailRevenue > 0) {
        // Revenue entry (cash to bank, revenue credit)
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Retail Revenue - ${sku} (${retailUnits} units) - W${week} sales paid W${adjustedPaymentWeek}`,
          debit: retailRevenue,
          credit: 0,
          reference: `RETAIL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year, units: retailUnits, paymentWeek: adjustedPaymentWeek, paymentYear }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '4002',
          accountCategory: 'Revenue',
          description: `Retail Revenue - ${sku} (${retailUnits} units) - W${week} sales paid W${adjustedPaymentWeek}`,
          debit: 0,
          credit: retailRevenue,
          reference: `RETAIL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year, units: retailUnits, paymentWeek: adjustedPaymentWeek, paymentYear }
        })
        
        // Refunds (lower for retail)
        const retailRefunds = retailRevenue * SALES_CONFIG.RETAIL_REFUND_RATE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '4010',
          accountCategory: 'Expense',
          description: `Refunds - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: retailRefunds,
          credit: 0,
          reference: `RETAIL-REFUND-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Refunds - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: 0,
          credit: retailRefunds,
          reference: `RETAIL-REFUND-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        // Retail Broker/Distributor Fee
        const retailBrokerFee = retailRevenue * SALES_CONFIG.RETAIL_BROKER_FEE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5050',
          accountCategory: 'Expense',
          description: `Referral Fees - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: retailBrokerFee,
          credit: 0,
          reference: `RETAIL-BROKER-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Referral Fees - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: 0,
          credit: retailBrokerFee,
          reference: `RETAIL-BROKER-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        // Retail Fulfillment/Logistics Fee ($2.00 per unit)
        const retailFulfillmentFee = retailUnits * 2.00
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5051',
          accountCategory: 'Expense',
          description: `Fulfillment Fees - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: retailFulfillmentFee,
          credit: 0,
          reference: `RETAIL-FULFILL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Fulfillment Fees - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: 0,
          credit: retailFulfillmentFee,
          reference: `RETAIL-FULFILL-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        // Advertising (TACoS)
        const retailAdvertising = retailRevenue * SALES_CONFIG.RETAIL_ADVERTISING_RATE
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '5310',
          accountCategory: 'Expense',
          description: `Advertising - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: retailAdvertising,
          credit: 0,
          reference: `RETAIL-ADS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
        
        glEntries.push({
          date: paymentDate.toISOString(),
          account: '1000',
          accountCategory: 'Asset',
          description: `Advertising - Retail - ${sku} (${retailUnits} units) - W${week}`,
          debit: 0,
          credit: retailAdvertising,
          reference: `RETAIL-ADS-${year}-W${week}-${sku}`,
          source: 'multi-channel',
          metadata: { channel: 'Retail', sku, week, year }
        })
      }
    }
  }
  
  // Send GL entries to API in larger batches with parallel processing
  if (glEntries.length > 0) {
    const batchSize = 500 // Increased from 100 to reduce API calls
    const parallelLimit = 5 // Process 5 batches at a time
    const batches = []
    
    // Prepare all batches
    for (let i = 0; i < glEntries.length; i += batchSize) {
      batches.push(glEntries.slice(i, i + batchSize))
    }
    
    console.log(`    Processing ${batches.length} batches (${glEntries.length} total entries)...`)
    
    // Process in parallel groups
    for (let i = 0; i < batches.length; i += parallelLimit) {
      const parallelBatches = batches.slice(i, i + parallelLimit)
      
      const promises = parallelBatches.map(async (batch, index) => {
        const response = await fetch(`${API_BASE}/gl`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'addEntries',
            data: batch,
            strategyId
          })
        })
        
        const batchNum = i + index + 1
        if (response.ok) {
          return { success: true, batchNum, count: batch.length }
        } else {
          return { success: false, batchNum, error: response.statusText }
        }
      })
      
      const results = await Promise.all(promises)
      results.forEach(result => {
        if (result.success) {
          console.log(`    ✓ Batch ${result.batchNum}: ${result.count} entries`)
        } else {
          console.log(`    ✗ Batch ${result.batchNum} failed: ${result.error}`)
        }
      })
    }
    
    console.log(`  ✅ Created ${glEntries.length} multi-channel GL entries total`)
  } else {
    console.log(`  ℹ️  No multi-channel revenue to create (starts Q2 2026 for Walmart, Q1 2027 for Retail)`)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSales().then(data => {
    console.log(`\n📊 Sales forecast created with ${data.length} records`)
    process.exit(0)
  })
}