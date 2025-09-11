import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create a default warehouse if it doesn't exist
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      code: 'MAIN',
      name: 'Main Warehouse',
      address: '123 Main St, City, State 12345',
      type: 'OWNED',
      active: true
    }
  })

  // Create a default category
  const category = await prisma.category.upsert({
    where: { id: 'default-category' },
    update: {},
    create: {
      id: 'default-category',
      name: 'General'
    }
  })

  // Define SKUs to create
  const skus = [
    'CS 007',
    'CS 008', 
    'CS 009',
    'CS 010',
    'CS 011',
    'CS 012',
    'CS CDS 001',
    'CS CDS 002'
  ]

  // Create products and inventory for each SKU
  for (const sku of skus) {
    // Create product
    const product = await prisma.product.upsert({
      where: { sku: sku },
      update: {},
      create: {
        sku: sku,
        title: `Product ${sku}`,
        description: `Description for product ${sku}`,
        brand: 'CS Brand',
        categoryId: category.id,
        cost: 100.00,
        weight: 1.0,
        length: 10.0,
        width: 10.0,
        height: 10.0
      }
    })

    // Create inventory entry
    await prisma.inventory.upsert({
      where: {
        productId_warehouseId: {
          productId: product.id,
          warehouseId: warehouse.id
        }
      },
      update: {
        sku: sku
      },
      create: {
        sku: sku,
        productId: product.id,
        warehouseId: warehouse.id,
        quantityOnHand: 100,
        quantityReserved: 0,
        quantityAvailable: 100,
        reorderPoint: 20
      }
    })
  }

  console.log('Seed data created successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })