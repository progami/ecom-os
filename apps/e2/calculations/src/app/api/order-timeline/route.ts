import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/utils/database'
import { getWeekNumber, getWeekDateRange, getWeeksInYear } from '@/lib/utils/weekHelpers'
import logger from '@/utils/logger'
import { CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts'
import { v4 as uuidv4 } from 'uuid'

// Helper function to safely convert to number with NaN validation
function safeNumber(value: any, fallback: number = 0): number {
  const num = Number(value)
  if (isNaN(num) || !isFinite(num)) {
    logger.warn(`Invalid number conversion: ${value}`)
    return fallback
  }
  return num
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
  const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : Math.ceil((new Date().getMonth() + 1) / 3)
  
  // Get active strategy if not provided
  const activeStrategy = await prisma.budgetStrategy.findFirst({
    where: { isActive: true }
  })
  
  const strategyId = searchParams.get('strategyId') || activeStrategy?.id
  
  if (!strategyId) {
    // Return empty data if no strategy exists
    return NextResponse.json({ orders: [], weeksOfStock: [] })
  }

  try {
    // Calculate week range for the specific quarter
    const startWeek = (quarter - 1) * 13 + 1
    const weeksInYear = getWeeksInYear(year)
    const endWeek = quarter === 4 ? weeksInYear : Math.min(quarter * 13, 52)
    
    // Get date range for the quarter using week numbers
    const startWeekRange = getWeekDateRange(year, startWeek)
    const endWeekRange = getWeekDateRange(year, endWeek)

    // Fetch ALL orders for the year (needed for inventory calculation on client)
    const allOrders = await prisma.orderTimeline.findMany({
      where: {
        strategyId,
        year,
        quarter
      },
      orderBy: [
        { week: 'asc' },
        { sku: 'asc' }
      ]
    })

    // No need to filter since we're fetching only the specific quarter
    const quarterOrders = allOrders

    // Return only the orders for this quarter
    return NextResponse.json({ 
      orders: quarterOrders
    })
  } catch (error) {
    console.error('Error fetching order timeline:', error)
    return NextResponse.json({ error: 'Failed to fetch order timeline' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { changes, year, quarter, strategyId } = body;
    
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      );
    }
    
    // Get active strategy if not provided
    let activeStrategyId = strategyId;
    if (!activeStrategyId) {
      const activeStrategy = await prisma.budgetStrategy.findFirst({
        where: { isActive: true }
      });
      activeStrategyId = activeStrategy?.id;
    }
    
    if (!activeStrategyId) {
      return NextResponse.json(
        { error: 'No active strategy. Please create and activate a budget strategy first.' },
        { status: 400 }
      );
    }
    
    // Get all products for COGS calculation
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        OR: [
          { strategyId: activeStrategyId },
          { strategyId: null }
        ]
      }
    });
    
    const productMap = new Map(products.map(p => [p.sku, p]));
    
    // Process all changes in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const processedChanges = [];
      
      for (const change of changes) {
        const { week, rowId: sku, value: quantity } = change;
        
        // Calculate week dates
        const weekRange = getWeekDateRange(year, week);
        const weekStarting = weekRange.start;
        
        // Delete existing order and related COGS with GL entries
        const existingExpenses = await tx.expense.findMany({
          where: {
            strategyId: activeStrategyId,
            date: weekStarting,
            sku,
            type: 'order-generated'
          }
        });
        
        // Delete GL entries for existing expenses
        if (existingExpenses.length > 0) {
          const expenseGLLinks = await tx.expenseGLEntry.findMany({
            where: {
              expenseId: {
                in: existingExpenses.map(e => e.id)
              }
            }
          });
          
          if (expenseGLLinks.length > 0) {
            await tx.expenseGLEntry.deleteMany({
              where: {
                expenseId: {
                  in: existingExpenses.map(e => e.id)
                }
              }
            });
            
            await tx.gLEntry.deleteMany({
              where: {
                id: {
                  in: expenseGLLinks.map(link => link.glEntryId)
                }
              }
            });
          }
        }
        
        await tx.orderTimeline.deleteMany({
          where: {
            strategyId: activeStrategyId,
            year,
            week,
            sku
          }
        });
        
        await tx.expense.deleteMany({
          where: {
            strategyId: activeStrategyId,
            date: weekStarting,
            sku,
            type: 'order-generated'
          }
        });
        
        // Only create new records if quantity > 0
        if (quantity > 0) {
          // Create order timeline record
          const orderTimeline = await tx.orderTimeline.create({
            data: {
              strategyId: activeStrategyId,
              year,
              week,
              quarter,
              sku,
              quantity
            }
          });
          
          // Get product for COGS calculation
          const product = productMap.get(sku);
          if (product) {
            // Create COGS expense entries
            const manufacturing = safeNumber(product.manufacturing);
            const freight = safeNumber(product.freight);
            // Tariff is 35% of (Manufacturing + Ocean Freight)
            const tariffRate = safeNumber(product.tariffRate, 0.35);
            const tariff = (manufacturing + freight) * tariffRate;
            const awd = safeNumber(product.awd);
            
            // Create individual COGS entries for each component with GL entries
            if (manufacturing > 0) {
              const manufacturingExpense = await tx.expense.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  weekStarting,
                  category: 'COGS-Manufacturing',
                  subcategory: sku,
                  description: `Manufacturing for ${sku} - ${quantity} units`,
                  amount: manufacturing * quantity,
                  type: 'order-generated',
                  isCOGS: true,
                  sku,
                  quantity,
                  unitCost: manufacturing
                }
              });
              
              // Create GL entries for Manufacturing COGS
              const mfgPairId = uuidv4();
              const mfgDebitGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '5020', // Manufacturing
                  accountCategory: 'Expense',
                  description: `Manufacturing for ${sku} - ${quantity} units`,
                  debit: manufacturing * quantity,
                  credit: 0,
                  reference: `cogs-mfg-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: manufacturingExpense.id,
                    pairId: mfgPairId,
                    entryType: 'cogs-manufacturing'
                  }
                }
              });
              
              const mfgCreditGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '1000', // Business Bank Account
                  accountCategory: 'Asset',
                  description: `Manufacturing for ${sku} - ${quantity} units`,
                  debit: 0,
                  credit: manufacturing * quantity,
                  reference: `cogs-mfg-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: manufacturingExpense.id,
                    pairId: mfgPairId,
                    entryType: 'cogs-manufacturing'
                  }
                }
              });
              
              // Link expense to GL entries
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: manufacturingExpense.id,
                  glEntryId: mfgDebitGL.id
                }
              });
              
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: manufacturingExpense.id,
                  glEntryId: mfgCreditGL.id
                }
              });
            }
            
            if (freight > 0) {
              const freightExpense = await tx.expense.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  weekStarting,
                  category: 'COGS-Freight',
                  subcategory: sku,
                  description: `Freight for ${sku} - ${quantity} units`,
                  amount: freight * quantity,
                  type: 'order-generated',
                  isCOGS: true,
                  sku,
                  quantity,
                  unitCost: freight
                }
              });
              
              // Create GL entries for Freight COGS
              const freightPairId = uuidv4();
              const freightDebitGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '5030', // Ocean Freight
                  accountCategory: 'Expense',
                  description: `Ocean Freight for ${sku} - ${quantity} units`,
                  debit: freight * quantity,
                  credit: 0,
                  reference: `cogs-freight-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: freightExpense.id,
                    pairId: freightPairId,
                    entryType: 'cogs-freight'
                  }
                }
              });
              
              const freightCreditGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '1000', // Business Bank Account
                  accountCategory: 'Asset',
                  description: `Ocean Freight for ${sku} - ${quantity} units`,
                  debit: 0,
                  credit: freight * quantity,
                  reference: `cogs-freight-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: freightExpense.id,
                    pairId: freightPairId,
                    entryType: 'cogs-freight'
                  }
                }
              });
              
              // Link expense to GL entries
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: freightExpense.id,
                  glEntryId: freightDebitGL.id
                }
              });
              
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: freightExpense.id,
                  glEntryId: freightCreditGL.id
                }
              });
            }
            
            if (tariff > 0) {
              const tariffExpense = await tx.expense.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  weekStarting,
                  category: 'COGS-Tariff',
                  subcategory: sku,
                  description: `Tariff for ${sku} - ${quantity} units`,
                  amount: tariff * quantity,
                  type: 'order-generated',
                  isCOGS: true,
                  sku,
                  quantity,
                  unitCost: tariff
                }
              });
              
              // Create GL entries for Tariff COGS
              const tariffPairId = uuidv4();
              const tariffDebitGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '5040', // Tariffs
                  accountCategory: 'Expense',
                  description: `Tariffs for ${sku} - ${quantity} units`,
                  debit: tariff * quantity,
                  credit: 0,
                  reference: `cogs-tariff-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: tariffExpense.id,
                    pairId: tariffPairId,
                    entryType: 'cogs-tariff'
                  }
                }
              });
              
              const tariffCreditGL = await tx.gLEntry.create({
                data: {
                  strategyId: activeStrategyId,
                  date: weekStarting,
                  account: '1000', // Business Bank Account
                  accountCategory: 'Asset',
                  description: `Tariffs for ${sku} - ${quantity} units`,
                  debit: 0,
                  credit: tariff * quantity,
                  reference: `cogs-tariff-${year}-W${week}-${sku}`,
                  source: 'order-timeline',
                  metadata: { 
                    year, 
                    week, 
                    sku,
                    quantity,
                    expenseId: tariffExpense.id,
                    pairId: tariffPairId,
                    entryType: 'cogs-tariff'
                  }
                }
              });
              
              // Link expense to GL entries
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: tariffExpense.id,
                  glEntryId: tariffDebitGL.id
                }
              });
              
              await tx.expenseGLEntry.create({
                data: {
                  expenseId: tariffExpense.id,
                  glEntryId: tariffCreditGL.id
                }
              });
            }
            
            // AWD is NOT part of COGS - it's an Amazon operational expense
            // AWD will be calculated as part of Amazon expenses in unit sales
          }
          
          processedChanges.push({
            week,
            sku,
            quantity,
            action: 'created',
            id: orderTimeline.id
          });
        } else {
          processedChanges.push({
            week,
            sku,
            quantity: 0,
            action: 'deleted'
          });
        }
      }
      
      return processedChanges;
    });
    
    logger.info(`Updated ${results.length} order timeline records`);
    
    return NextResponse.json({
      success: true,
      updated: results.length,
      changes: results
    });
    
  } catch (error) {
    logger.error('Error in order timeline update:', error);
    return NextResponse.json(
      { error: 'Failed to update order timeline' },
      { status: 500 }
    );
  }
}