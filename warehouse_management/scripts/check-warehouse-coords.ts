import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWarehouseCoords() {
  const warehouses = await prisma.warehouse.findMany({
    select: {
      code: true,
      name: true,
      latitude: true,
      longitude: true
    }
  })

  console.log('Warehouse Coordinates:')
  warehouses.forEach(w => {
    console.log(`${w.code}: ${w.name}`)
    console.log(`  Lat: ${w.latitude}, Lng: ${w.longitude}`)
  })
}

checkWarehouseCoords()
  .catch(console.error)
  .finally(() => prisma.$disconnect())