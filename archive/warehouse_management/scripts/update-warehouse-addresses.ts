import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateWarehouseAddresses() {
  console.log('🏢 Updating warehouse addresses...')

  try {
    // Update FMC warehouse - keep existing name, update address only
    const fmcUpdate = await prisma.warehouse.update({
      where: { code: 'FMC' },
      data: {
        address: 'Star Business Centre, Marsh Wy, Rainham RM13 8UP, UK',
      },
    })
    console.log('✅ Updated FMC address')

    // Update VGlobal warehouse with Trans Global address (they are the same)
    const vGlobalUpdate = await prisma.warehouse.update({
      where: { code: 'VGLOBAL' },
      data: {
        address: 'Unit 2, Bulrush Close, Finedon Road, Wellingborough, NN8 4FU, UK',
        contactEmail: 'dale.ashton@trans-global.com',
        contactPhone: '+447789332674',
      },
    })
    console.log('✅ Updated VGlobal (Trans Global) address')

    // Update 4AS warehouse - keep existing name, update address and contact
    const fourAS = await prisma.warehouse.update({
      where: { code: '4AS' },
      data: {
        address: 'Unit E, 1 Glenburn Rd, East Kilbride, Glasgow, G74 5BA, UK',
        contactEmail: 'support@4asglobal.com',
        contactPhone: '+447926124504',
      },
    })
    console.log('✅ Updated 4AS address')

    // List all warehouses
    console.log('\n📋 All warehouses:')
    const allWarehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    })
    
    allWarehouses.forEach(w => {
      console.log(`- ${w.code}: ${w.name}`)
      console.log(`  Address: ${w.address}`)
      console.log(`  Contact: ${w.contactEmail} | ${w.contactPhone}`)
      console.log(`  Active: ${w.isActive}`)
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error updating warehouses:', error)
    throw error
  }
}

updateWarehouseAddresses()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })