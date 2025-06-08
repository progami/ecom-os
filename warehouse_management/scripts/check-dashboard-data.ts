import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkData() {
  try {
    // Check inventory
    const inventory = await prisma.inventoryBalance.aggregate({
      _sum: { currentCartons: true },
      _count: true
    })
    
    // Check active SKUs
    const activeSkus = await prisma.inventoryBalance.findMany({
      where: { currentCartons: { gt: 0 } },
      select: { skuId: true },
      distinct: ['skuId']
    })
    
    // Check invoices
    const pendingInvoices = await prisma.invoice.count({
      where: { status: 'pending' }
    })
    
    const allInvoices = await prisma.invoice.count()
    
    // Check calculated costs
    const costs = await prisma.calculatedCost.aggregate({
      _sum: { finalExpectedCost: true },
      _count: true
    })
    
    // Check transactions
    const transactions = await prisma.inventoryTransaction.count()
    
    // Check warehouses
    const warehouses = await prisma.warehouse.count()
    
    console.log('=== Dashboard Data Summary ===')
    console.log('Total Inventory (cartons):', inventory._sum.currentCartons || 0)
    console.log('Inventory Items:', inventory._count)
    console.log('Active SKUs:', activeSkus.length)
    console.log('Total SKUs:', await prisma.sku.count())
    console.log('Pending Invoices:', pendingInvoices)
    console.log('Total Invoices:', allInvoices)
    console.log('Calculated Costs Count:', costs._count)
    console.log('Total Calculated Costs:', costs._sum.finalExpectedCost || 0)
    console.log('Total Transactions:', transactions)
    console.log('Total Warehouses:', warehouses)
    
    // Check latest transaction date
    const latestTransaction = await prisma.inventoryTransaction.findFirst({
      orderBy: { transactionDate: 'desc' }
    })
    console.log('Latest Transaction:', latestTransaction?.transactionDate)
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkData()