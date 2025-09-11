/**
 * Order Timeline Generation for E2 Conservative Strategy
 * Implements 4-week safety stock with 14-week forward coverage ordering
 */

import { getSalesData, getProductSKUs } from './sales'
import { API_BASE, INITIAL_ORDERS, ORDERING_RULES, TIMELINE } from './business-logic'

interface OrderData {
  week: number
  year: number  
  quarter: number
  sku: string
  quantity: number
}

export async function seedOrderTimeline(strategyId?: string): Promise<OrderData[]> {
  console.log('2. CREATING ORDER TIMELINE (HARDCODED + DYNAMIC)...')
  console.log('  Initial hardcoded orders for W36 2025 and W2 2026')
  console.log('  Dynamic ordering: immediate delivery when stock < 4 weeks')
  console.log('  Order quantity: sum of next 14 weeks demand')
  
  // Check for active strategy
  if (!strategyId) {
    const strategiesRes = await fetch(`${API_BASE}/strategies`)
    const strategies = await strategiesRes.json()
    const activeStrategy = strategies.find((s: any) => s.isActive)
    if (!activeStrategy) {
      console.error('❌ No active strategy found.')
      return []
    }
    strategyId = activeStrategy.id
  }
  
  // Get sales data to calculate order requirements - need ALL years for lookahead
  console.log('  Loading sales data for all years (2025-2030)...')
  const salesData: any[] = []
  for (let year = 2025; year <= 2030; year++) {
    const yearData = await getSalesData(year)
    salesData.push(...yearData)
  }
  console.log(`  Loaded ${salesData.length} total sales records`)
  const productSKUs = await getProductSKUs()
  
  // Load ALL existing orders from database to track inventory properly
  console.log('  Loading existing orders from database...')
  const existingOrders: OrderData[] = []
  for (let year = 2025; year <= 2030; year++) {
    for (let q = 1; q <= 4; q++) {
      const ordersRes = await fetch(`${API_BASE}/order-timeline?year=${year}&quarter=${q}`)
      if (ordersRes.ok) {
        const ordersJson = await ordersRes.json()
        const orders = ordersJson.orders || []
        orders.forEach((order: any) => {
          existingOrders.push({
            week: order.week,
            year: order.year,
            quarter: Math.ceil((order.week <= 13 ? 1 : order.week <= 26 ? 2 : order.week <= 39 ? 3 : 4)),
            sku: order.sku,
            quantity: order.quantity
          })
        })
      }
    }
  }
  console.log(`  Found ${existingOrders.length} existing orders in database`)
  
  // Get initial orders from business logic configuration
  const initialOrders = INITIAL_ORDERS.getAllInitialOrders()
  
  // Build map of ALL orders (existing + hardcoded) by year-week-sku
  const existingOrdersMap: Record<string, number> = {}
  existingOrders.forEach(order => {
    const key = `${order.year}-${order.week}-${order.sku}`
    existingOrdersMap[key] = order.quantity
  })
  
  // Add hardcoded orders to the map so we don't create duplicates
  initialOrders.forEach(order => {
    const key = `${order.year}-${order.week}-${order.sku}`
    existingOrdersMap[key] = order.quantity
  })
  
  // Build sales map by year, week, and SKU
  const salesMap: Record<number, Record<number, Record<string, number>>> = {}
  for (const sale of salesData) {
    if (!salesMap[sale.year]) salesMap[sale.year] = {}
    if (!salesMap[sale.year][sale.week]) salesMap[sale.year][sale.week] = {}
    salesMap[sale.year][sale.week][sale.sku] = sale.units
  }
  
  const orderData: OrderData[] = []
  
  // Add hardcoded orders
  console.log(`  Added ${initialOrders.length} hardcoded initial orders`)
  orderData.push(...initialOrders)
  
  // DYNAMIC ORDER GENERATION
  // Track inventory levels for each SKU
  const inventory: Record<string, number> = {}
  productSKUs.forEach(sku => inventory[sku] = 0)
  
  // Don't pre-add hardcoded orders - they'll be added when we reach their weeks
  
  let dynamicOrderCount = 0
  
  // Process each week from W36 2025 (when first orders arrive) to end of 2030
  for (let year = 2025; year <= 2030; year++) {
    const startWeek = year === 2025 ? 36 : 1  // Start from W36 for 2025 (first orders)
    const endWeek = year === 2026 ? 53 : 52  // 2026 has 53 weeks
    
    for (let week = startWeek; week <= endWeek; week++) {
      const quarter = Math.ceil((week <= 13 ? 1 : week <= 26 ? 2 : week <= 39 ? 3 : 4))
      
      // Process each SKU
      for (const sku of productSKUs) {
        // Check if we have ANY existing order (hardcoded or dynamic) for this week/SKU
        const orderKey = `${year}-${week}-${sku}`
        const existingOrderQty = existingOrdersMap[orderKey] || 0
        
        // Add existing order to inventory if it exists
        if (existingOrderQty > 0) {
          inventory[sku] += existingOrderQty
        }
        
        // Get this week's sales (will deduct later)
        const weekSales = salesMap[year]?.[week]?.[sku] || 0
        
        
        // Calculate forward-looking demand to determine if reorder is needed
        let totalFutureDemand = 0
        for (let fw = 0; fw < ORDERING_RULES.ORDER_HORIZON_WEEKS; fw++) {
          let checkWeek = week + fw
          let checkYear = year
          
          // Handle year rollover
          if (checkWeek > 52 && checkYear !== 2026) {
            checkWeek -= 52
            checkYear += 1
          } else if (checkWeek > 53 && checkYear === 2026) {
            checkWeek -= 53
            checkYear += 1
          }
          
          const futureDemand = salesMap[checkYear]?.[checkWeek]?.[sku] || 0
          totalFutureDemand += futureDemand
        }
        
        const avgWeeklyDemand = totalFutureDemand / ORDERING_RULES.ORDER_HORIZON_WEEKS
        const weeksOfStock = avgWeeklyDemand > 0 ? inventory[sku] / avgWeeklyDemand : 999
        
        // Reorder if stock falls below minimum weeks threshold
        // But skip if we already have an order for this week/SKU
        if (weeksOfStock < ORDERING_RULES.MIN_STOCK_WEEKS && year <= TIMELINE.END_YEAR && existingOrderQty === 0) {
          // Calculate order quantity: sum of next 14 weeks demand
          let orderQty = 0
          for (let fw = 0; fw < ORDERING_RULES.ORDER_HORIZON_WEEKS; fw++) {
            let checkWeek = week + fw
            let checkYear = year
            
            // Handle year rollover
            if (checkWeek > 52 && checkYear !== 2026) {
              checkWeek -= 52
              checkYear += 1
            } else if (checkWeek > 53 && checkYear === 2026) {
              checkWeek -= 53
              checkYear += 1
            }
            
            if (checkYear <= 2030) {
              orderQty += salesMap[checkYear]?.[checkWeek]?.[sku] || 0
            }
          }
          
          if (orderQty > 0) {
            orderData.push({
              week,
              year,
              quarter,
              sku,
              quantity: Math.round(orderQty)
            })
            
            // Add to inventory (immediate delivery assumed)
            inventory[sku] += orderQty
            dynamicOrderCount++
          }
        }
        
        // NOW deduct this week's sales (happens at END of week)
        inventory[sku] -= weekSales
      }
    }
  }
  
  console.log(`  Generated ${dynamicOrderCount} dynamic orders (${orderData.length} total including hardcoded)`)
  
  // Send order data to API by year and quarter
  let totalOrdersCreated = 0
  const ordersByYearQuarter: Record<string, OrderData[]> = {}
  
  for (const order of orderData) {
    const key = `${order.year}-Q${order.quarter}`
    if (!ordersByYearQuarter[key]) {
      ordersByYearQuarter[key] = []
    }
    ordersByYearQuarter[key].push(order)
  }
  
  for (const [yearQuarter, quarterOrders] of Object.entries(ordersByYearQuarter)) {
    const [year, q] = yearQuarter.split('-Q')
    
    const response = await fetch(`${API_BASE}/order-timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changes: quarterOrders.map(o => ({
          week: o.week,
          rowId: o.sku,
          value: o.quantity
        })),
        year: parseInt(year),
        quarter: parseInt(q),
        strategyId
      })
    })
    
    if (response.ok) {
      totalOrdersCreated += quarterOrders.length
      console.log(`    ${year} Q${q}: ${quarterOrders.length} records`)
    } else {
      console.log(`    ${year} Q${q}: Failed - ${response.statusText}`)
    }
  }
  
  console.log(`  ✅ Created ${totalOrdersCreated} order records total`)
  
  return orderData
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOrderTimeline().then(data => {
    console.log(`\n📦 Order timeline created with ${data.length} records`)
    process.exit(0)
  })
}