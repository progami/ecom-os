import { NextRequest, NextResponse } from 'next/server'
import logger from '@/utils/logger'
import { addDays, startOfWeek } from 'date-fns'

// Base configuration for seeding
const STRATEGY_CONFIG = {
  startYear: 2025,
  endYear: 2030,
  baseWeeklyUnits: {
    '6PK - 7M': 2000,
    '12PK - 7M': 1000,
    '1PK - 32M': 500,
    '3PK - 32M': 200
  },
  growthRates: {
    2025: 1.00,  // Base year
    2026: 1.30,  // +30% growth (130% of base)
    2027: 1.56,  // +20% growth (130% × 1.20 = 156% of base)
    2028: 1.79,  // +15% growth (156% × 1.15 = 179% of base)
    2029: 2.06,  // +15% growth (179% × 1.15 = 206% of base)
    2030: 2.37   // +15% growth (206% × 1.15 = 237% of base)
  },
  monthlyOperatingExpenses: [
    { accountCode: '5100', amount: 7700 }, // Payroll
    { accountCode: '5110', amount: 730.80 }, // Payroll Tax
    { accountCode: '5120', amount: 1258 }, // Contract Salaries
    { accountCode: '5200', amount: 500 }, // Rent
    { accountCode: '5210', amount: 100 }, // Utilities
    { accountCode: '5220', amount: 70 }, // Telephone & Internet
    { accountCode: '5500', amount: 55 } // IT Software
  ]
}

// Helper to make internal API calls
async function internalApiCall(endpoint: string, method: string = 'GET', body?: any) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4321'
  const url = `${baseUrl}/api${endpoint}`
  
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API call to ${endpoint} failed: ${response.status} - ${error}`)
  }
  
  return response.json()
}

// Get week date range
function getWeekDateRange(year: number, week: number) {
  const firstDayOfYear = new Date(year, 0, 1)
  const daysToFirstSunday = (7 - firstDayOfYear.getDay()) % 7
  const firstSunday = new Date(year, 0, 1 + daysToFirstSunday)
  const weekStart = new Date(firstSunday)
  weekStart.setDate(firstSunday.getDate() + (week - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  return { start: weekStart, end: weekEnd }
}

export async function POST(request: NextRequest) {
  try {
    const { strategyName, clearExisting = true } = await request.json()
    
    if (!strategyName) {
      return NextResponse.json(
        { error: 'Strategy name is required' },
        { status: 400 }
      )
    }
    
    logger.info(`Executing strategy: ${strategyName}`)
    
    const results = {
      strategy: strategyName,
      salesCreated: 0,
      expensesCreated: 0,
      errors: [] as string[]
    }
    
    // 1. Activate/create the strategy
    try {
      await internalApiCall('/strategies', 'POST', {
        name: strategyName,
        description: `Budget strategy for ${STRATEGY_CONFIG.startYear}-${STRATEGY_CONFIG.endYear}`,
        isActive: true
      })
      logger.info(`Strategy ${strategyName} activated`)
    } catch (error) {
      logger.error('Error activating strategy:', error)
      results.errors.push(`Failed to activate strategy: ${error}`)
    }
    
    // 2. Get current products with latest configurations
    let products: any[] = []
    try {
      products = await internalApiCall('/products', 'GET')
      logger.info(`Loaded ${products.length} products`)
    } catch (error) {
      logger.error('Error loading products:', error)
      return NextResponse.json(
        { error: 'Failed to load products', details: error },
        { status: 500 }
      )
    }
    
    // 3. Create Unit Sales (Revenue)
    logger.info('Creating unit sales...')
    for (let year = STRATEGY_CONFIG.startYear; year <= STRATEGY_CONFIG.endYear; year++) {
      const startWeek = year === 2025 ? 40 : 1  // 2025 starts at W40
      const endWeek = 52
      
      for (let week = startWeek; week <= endWeek; week++) {
        const weekStart = startOfWeek(new Date(year, 0, 1 + (week - 1) * 7), { weekStartsOn: 0 })
        const weekEnd = addDays(weekStart, 6)
        
        for (const [sku, baseUnits] of Object.entries(STRATEGY_CONFIG.baseWeeklyUnits)) {
          const growth = STRATEGY_CONFIG.growthRates[year as keyof typeof STRATEGY_CONFIG.growthRates] || 1
          const units = Math.round(baseUnits * growth)
          
          try {
            await internalApiCall('/unit-sales', 'POST', {
              action: 'updateUnitSales',
              data: {
                year,
                week,
                sku,
                units
              }
            })
            results.salesCreated++
          } catch (error) {
            logger.error(`Error creating sales for ${sku} W${week}:`, error)
            results.errors.push(`Sales ${sku} W${week}: ${error}`)
          }
        }
      }
    }
    
    // 4. Create Operating Expenses
    logger.info('Creating operating expenses...')
    for (let year = STRATEGY_CONFIG.startYear; year <= STRATEGY_CONFIG.endYear; year++) {
      const startWeek = (year === 2025) ? 31 : 1  // Expenses start W31 in 2025
      
      for (let week = startWeek; week <= 52; week++) {
        const weekRange = getWeekDateRange(year, week)
        const isFirstWeekOfMonth = weekRange.start.getUTCDate() <= 7
        
        // Process monthly expenses (only in first week of month)
        if (isFirstWeekOfMonth) {
          for (const expense of STRATEGY_CONFIG.monthlyOperatingExpenses) {
            if (expense.amount === 0) continue
            
            try {
              await internalApiCall('/expense-forecast', 'POST', {
                year,
                week,
                accountCode: expense.accountCode,
                amount: expense.amount
              })
              results.expensesCreated++
            } catch (error) {
              logger.error(`Error creating expense ${expense.accountCode} W${week}:`, error)
              results.errors.push(`Expense ${expense.accountCode} W${week}: ${error}`)
            }
          }
        }
      }
    }
    
    // 5. Create COGS entries (quarterly inventory purchases)
    logger.info('Creating COGS entries...')
    try {
      // Calculate quarterly COGS based on sales volume and growth
      for (let year = STRATEGY_CONFIG.startYear; year <= STRATEGY_CONFIG.endYear; year++) {
        const growth = STRATEGY_CONFIG.growthRates[year as keyof typeof STRATEGY_CONFIG.growthRates] || 1
        
        // Q1-Q4 inventory purchases
        const quarters = [
          { quarter: 1, orderWeek: 1, payWeek: 12 },
          { quarter: 2, orderWeek: 14, payWeek: 25 },
          { quarter: 3, orderWeek: 27, payWeek: 38 },
          { quarter: 4, orderWeek: 40, payWeek: year === 2025 ? 40 : 51 } // 2025 Q4 immediate payment
        ]
        
        for (const q of quarters) {
          // Skip quarters before 2025 Q4
          if (year === 2025 && q.quarter < 4) continue
          
          // Calculate inventory needed for the quarter
          let totalManufacturing = 0
          let totalFreight = 0
          
          for (const [sku, baseUnits] of Object.entries(STRATEGY_CONFIG.baseWeeklyUnits)) {
            const product = products.find(p => p.sku === sku)
            if (product) {
              const quarterlyUnits = baseUnits * growth * 13 // 13 weeks per quarter
              totalManufacturing += quarterlyUnits * parseFloat(product.manufacturing || 0)
              totalFreight += quarterlyUnits * parseFloat(product.freight || 0)
            }
          }
          
          const tariff = totalManufacturing * 0.35
          
          // Create COGS entries via expense API (these will create GL entries)
          const cogsExpenses = [
            { accountCode: '5020', amount: totalManufacturing },
            { accountCode: '5030', amount: totalFreight },
            { accountCode: '5040', amount: tariff }
          ]
          
          for (const cogs of cogsExpenses) {
            try {
              await internalApiCall('/expense-forecast', 'POST', {
                year,
                week: q.payWeek,
                accountCode: cogs.accountCode,
                amount: cogs.amount
              })
              results.expensesCreated++
            } catch (error) {
              logger.error(`Error creating COGS ${cogs.accountCode} Y${year} Q${q.quarter}:`, error)
              results.errors.push(`COGS ${cogs.accountCode} Y${year} Q${q.quarter}: ${error}`)
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error creating COGS entries:', error)
      results.errors.push(`COGS creation failed: ${error}`)
    }
    
    // 6. Trigger GL reconciliation to ensure all entries are created
    logger.info('Triggering GL reconciliation...')
    try {
      await internalApiCall('/gl/reconcile', 'POST', {
        strategyName
      })
    } catch (error) {
      logger.warn('GL reconciliation not available or failed:', error)
      // This is okay - GL entries are created automatically by unit-sales and expense APIs
    }
    
    // Return results
    const success = results.errors.length === 0
    
    return NextResponse.json({
      success,
      message: success 
        ? `Strategy "${strategyName}" executed successfully`
        : `Strategy "${strategyName}" executed with some errors`,
      results
    }, { status: success ? 200 : 207 }) // 207 = Multi-Status (partial success)
    
  } catch (error) {
    logger.error('Failed to execute strategy:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute strategy',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}