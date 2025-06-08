import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Warehouse coordinates
const warehouseCoordinates = {
  FMC: { 
    // Star Business Centre, Marsh Wy, Rainham RM13 8UP, UK
    latitude: 51.4960,
    longitude: 0.1876
  },
  VGLOBAL: { 
    // Unit 2, Bulrush Close, Finedon Road, Wellingborough, NN8 4FU, UK
    latitude: 52.3123,
    longitude: -0.6941
  },
  '4AS': { 
    // Unit E, 1 Glenburn Rd, East Kilbride, Glasgow, G74 5BA, UK
    latitude: 55.7644,
    longitude: -4.1769
  }
}

async function updateWarehouseCoordinates() {
  console.log('🗺️  Updating warehouse coordinates...')

  try {
    for (const [code, coords] of Object.entries(warehouseCoordinates)) {
      const updated = await prisma.warehouse.update({
        where: { code },
        data: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      })
      console.log(`✅ Updated ${updated.name} coordinates: ${coords.latitude}, ${coords.longitude}`)
    }

    // Display all warehouses with coordinates
    console.log('\n📍 All warehouse locations:')
    const allWarehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    })
    
    allWarehouses.forEach(w => {
      console.log(`- ${w.name} (${w.code})`)
      if (w.latitude && w.longitude) {
        console.log(`  📍 Coordinates: ${w.latitude}, ${w.longitude}`)
        console.log(`  🗺️  Google Maps: https://www.google.com/maps?q=${w.latitude},${w.longitude}`)
      }
      console.log('')
    })

  } catch (error) {
    console.error('❌ Error updating coordinates:', error)
    throw error
  }
}

updateWarehouseCoordinates()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })