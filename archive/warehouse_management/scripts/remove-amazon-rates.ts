import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeAmazonRates() {
  console.log('🗑️  Removing Amazon FBA rates to maintain exactly 31 Excel rates...\n')

  // Find Amazon warehouse
  const amazonWarehouse = await prisma.warehouse.findFirst({
    where: { code: 'AMZN-UK' }
  })

  if (!amazonWarehouse) {
    console.log('Amazon warehouse not found')
    return
  }

  // Check if any rates have calculated costs
  const amazonRates = await prisma.costRate.findMany({
    where: { warehouseId: amazonWarehouse.id },
    include: { calculatedCosts: true }
  })

  console.log(`Found ${amazonRates.length} Amazon FBA rates`)

  // Delete rates without calculated costs
  let deletedCount = 0
  for (const rate of amazonRates) {
    if (rate.calculatedCosts.length === 0) {
      console.log(`Deleting: ${rate.costName}`)
      await prisma.costRate.delete({
        where: { id: rate.id }
      })
      deletedCount++
    } else {
      console.log(`⚠️  Cannot delete "${rate.costName}" - has ${rate.calculatedCosts.length} calculated costs`)
    }
  }

  console.log(`\n✅ Deleted ${deletedCount} Amazon rates`)

  // Verify final count
  const finalCount = await prisma.costRate.count()
  console.log(`\nFinal rate count: ${finalCount}`)
  console.log(finalCount === 31 ? '✅ Successfully restored to exactly 31 rates!' : `⚠️  Have ${finalCount} rates, expected 31`)

  await prisma.$disconnect()
}

removeAmazonRates().catch(console.error)