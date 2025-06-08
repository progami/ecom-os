import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCostRates() {
  console.log('📊 Checking cost rates in the database...\n')

  // Expected rates based on seed data and documentation
  const expectedRates = {
    'FMC': [
      { category: 'Storage', name: 'Storage cost per pallet / week', value: 3.9, unit: 'pallet/week' },
      { category: 'Container', name: 'Container unload', value: 350, unit: 'container' },
      { category: 'Pallet', name: 'Pallet shipment', value: 30, unit: 'pallet' }
    ],
    'VGLOBAL': [
      { category: 'Storage', name: 'Storage cost per pallet / week', value: 2.6, unit: 'pallet/week' }
    ],
    'AMAZON-FBA-UK': [
      // Non-peak (Jan-Sep)
      { category: 'Storage', name: 'Standard Size Storage (Non-peak)', value: 0.75, unit: 'cubic foot/month', effectiveDate: '2024-01-01', endDate: '2024-09-30' },
      { category: 'Storage', name: 'Oversize Storage (Non-peak)', value: 0.53, unit: 'cubic foot/month', effectiveDate: '2024-01-01', endDate: '2024-09-30' },
      // Peak (Oct-Dec)
      { category: 'Storage', name: 'Standard Size Storage (Peak)', value: 2.40, unit: 'cubic foot/month', effectiveDate: '2024-10-01', endDate: '2024-12-31' },
      { category: 'Storage', name: 'Oversize Storage (Peak)', value: 1.65, unit: 'cubic foot/month', effectiveDate: '2024-10-01', endDate: '2024-12-31' }
    ]
  }

  // Get all warehouses
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { code: 'asc' }
  })

  // Get all cost rates
  const allRates = await prisma.costRate.findMany({
    include: { warehouse: true },
    orderBy: [
      { warehouse: { code: 'asc' } },
      { costCategory: 'asc' },
      { costName: 'asc' }
    ]
  })

  // Check each warehouse
  for (const warehouse of warehouses) {
    console.log(`\n${warehouse.code} Warehouse (${warehouse.name})`)
    console.log('='.repeat(50))

    const warehouseRates = allRates.filter(r => r.warehouseId === warehouse.id)
    const expectedWarehouseRates = expectedRates[warehouse.code] || []

    if (warehouseRates.length === 0) {
      console.log('❌ No rates found in database')
      if (expectedWarehouseRates.length > 0) {
        console.log('   Expected rates:')
        expectedWarehouseRates.forEach(rate => {
          console.log(`   - ${rate.category}: ${rate.name} = £${rate.value} per ${rate.unit}`)
        })
      }
    } else {
      console.log('Current rates in database:')
      warehouseRates.forEach(rate => {
        const status = rate.isActive ? '✅' : '❌'
        console.log(`${status} ${rate.costCategory}: ${rate.costName} = £${rate.costValue} per ${rate.unitOfMeasure}`)
        if (rate.effectiveDate) {
          console.log(`   Effective: ${rate.effectiveDate.toISOString().split('T')[0]}${rate.endDate ? ` to ${rate.endDate.toISOString().split('T')[0]}` : ''}`)
        }
      })

      // Check for missing rates
      if (expectedWarehouseRates.length > 0) {
        console.log('\nComparison with expected rates:')
        for (const expected of expectedWarehouseRates) {
          const found = warehouseRates.find(r => 
            r.costCategory === expected.category && 
            r.costName === expected.name
          )
          if (!found) {
            console.log(`❌ Missing: ${expected.category} - ${expected.name}`)
          } else if (found.costValue !== expected.value) {
            console.log(`⚠️  Value mismatch for ${expected.name}: DB has £${found.costValue}, expected £${expected.value}`)
          } else {
            console.log(`✅ Correct: ${expected.name}`)
          }
        }
      }
    }
  }

  // Summary
  console.log('\n\nSUMMARY')
  console.log('='.repeat(50))
  console.log(`Total warehouses: ${warehouses.length}`)
  console.log(`Total cost rates: ${allRates.length}`)
  console.log(`Active rates: ${allRates.filter(r => r.isActive).length}`)
  console.log(`Inactive rates: ${allRates.filter(r => !r.isActive).length}`)

  await prisma.$disconnect()
}

checkCostRates().catch(console.error)