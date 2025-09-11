import { PrismaClient } from '@prisma/client'

/**
 * Clean all data for a given strategy
 * Including products table
 */
export async function cleanStrategyData(strategyId: string): Promise<void> {
  const prisma = new PrismaClient()
  
  console.log('🧹 CLEANING ALL EXISTING DATA FOR CURRENT STRATEGY...')
  console.log('   (Including products table)')
  
  try {
    // 1. Delete expense-GL relationships (must come before GL entries)
    const expenseGLDeleted = await prisma.expenseGLEntry.deleteMany({
      where: { Expense: { strategyId } }
    })
    if (expenseGLDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${expenseGLDeleted.count} expense-GL relationships`)
    }
    
    // 2. Delete unit sales-GL relationships (must come before GL entries)
    const unitSalesGLDeleted = await prisma.unitSalesGLEntry.deleteMany({
      where: { UnitSales: { strategyId } }
    })
    if (unitSalesGLDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${unitSalesGLDeleted.count} unit sales-GL relationships`)
    }
    
    // 3. Delete GL entries directly by strategyId AND orphaned manual entries
    const glDeleted = await prisma.gLEntry.deleteMany({
      where: { 
        OR: [
          { strategyId },
          // Also delete manual entries without a strategy (orphaned/bad data)
          { 
            AND: [
              { source: 'manual' },
              { strategyId: null },
              { description: { contains: 'IT infrastructure' } }
            ]
          }
        ]
      }
    })
    if (glDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${glDeleted.count} GL entries (including orphaned manual entries)`)
    }
    
    // 4. Delete Expenses
    const expensesDeleted = await prisma.expense.deleteMany({
      where: { strategyId }
    })
    if (expensesDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${expensesDeleted.count} expense records`)
    }
    
    // 5. Delete UnitSales
    const unitSalesDeleted = await prisma.unitSales.deleteMany({
      where: { strategyId }
    })
    if (unitSalesDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${unitSalesDeleted.count} unit sales records`)
    }
    
    // 6. Delete OrderTimeline
    const ordersDeleted = await prisma.orderTimeline.deleteMany({
      where: { strategyId }
    })
    if (ordersDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${ordersDeleted.count} order timeline records`)
    }
    
    // 7. Delete Products
    const productsDeleted = await prisma.product.deleteMany({
      where: { strategyId }
    })
    if (productsDeleted.count > 0) {
      console.log(`  🗑️  Deleted ${productsDeleted.count} products`)
    }
    
    console.log('  ✅ Successfully wiped all data for current strategy (including products)')
  } finally {
    await prisma.$disconnect()
  }
}