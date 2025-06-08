import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createAmazonSampleData() {
  try {
    console.log('Creating sample Amazon FBA inventory data...\n')
    
    // Get Amazon warehouse
    const amazonWarehouse = await prisma.warehouse.findFirst({
      where: {
        code: 'AMZN-UK'
      }
    })
    
    if (!amazonWarehouse) {
      console.error('Amazon FBA UK warehouse not found!')
      await prisma.$disconnect()
      return
    }
    
    console.log(`Using warehouse: ${amazonWarehouse.name} (${amazonWarehouse.code})\n`)
    
    // Get system user or create one
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@warehouse.com' }
    })
    
    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: 'system@warehouse.com',
          passwordHash: 'not-used',
          fullName: 'System',
          role: 'admin',
          isActive: false
        }
      })
    }
    
    // Get all SKUs
    const skus = await prisma.sku.findMany()
    
    if (skus.length === 0) {
      console.error('No SKUs found in the database!')
      await prisma.$disconnect()
      return
    }
    
    console.log(`Found ${skus.length} SKUs. Creating Amazon inventory for them...\n`)
    
    // Create sample inventory for each SKU
    for (const sku of skus) {
      // Random quantity between 10 and 100 cartons
      const cartons = Math.floor(Math.random() * 91) + 10
      const transactionId = `AMZN-${Date.now()}-${sku.skuCode}`
      
      console.log(`Adding ${cartons} cartons of ${sku.skuCode} to Amazon FBA...`)
      
      // Create inventory transaction
      await prisma.inventoryTransaction.create({
        data: {
          transactionId,
          warehouseId: amazonWarehouse.id,
          skuId: sku.id,
          batchLot: `AMZN-${new Date().getFullYear()}`,
          transactionType: 'RECEIVE',
          referenceId: `FBA-SHIPMENT-${Math.random().toString(36).substring(7).toUpperCase()}`,
          cartonsIn: cartons,
          cartonsOut: 0,
          storagePalletsIn: Math.ceil(cartons / 10), // Assume 10 cartons per pallet
          shippingPalletsOut: 0,
          transactionDate: new Date(),
          createdById: systemUser.id,
          notes: 'Sample data for Amazon FBA inventory'
        }
      })
      
      // Update or create inventory balance
      const existingBalance = await prisma.inventoryBalance.findUnique({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId: amazonWarehouse.id,
            skuId: sku.id,
            batchLot: `AMZN-${new Date().getFullYear()}`
          }
        }
      })
      
      if (existingBalance) {
        await prisma.inventoryBalance.update({
          where: { id: existingBalance.id },
          data: {
            currentCartons: existingBalance.currentCartons + cartons,
            currentPallets: existingBalance.currentPallets + Math.ceil(cartons / 10),
            currentUnits: existingBalance.currentUnits + (cartons * (sku.unitsPerCarton || 1)),
            lastTransactionDate: new Date()
          }
        })
      } else {
        await prisma.inventoryBalance.create({
          data: {
            warehouseId: amazonWarehouse.id,
            skuId: sku.id,
            batchLot: `AMZN-${new Date().getFullYear()}`,
            currentCartons: cartons,
            currentPallets: Math.ceil(cartons / 10),
            currentUnits: cartons * (sku.unitsPerCarton || 1),
            lastTransactionDate: new Date(),
            storageCartonsPerPallet: 10,
            shippingCartonsPerPallet: 10
          }
        })
      }
    }
    
    // Add some shipments to make it more realistic
    console.log('\nAdding some shipment transactions...')
    
    for (let i = 0; i < 3; i++) {
      const randomSku = skus[Math.floor(Math.random() * skus.length)]
      const shipCartons = Math.floor(Math.random() * 10) + 1
      
      console.log(`Shipping ${shipCartons} cartons of ${randomSku.skuCode} from Amazon FBA...`)
      
      await prisma.inventoryTransaction.create({
        data: {
          transactionId: `AMZN-SHIP-${Date.now()}-${i}`,
          warehouseId: amazonWarehouse.id,
          skuId: randomSku.id,
          batchLot: `AMZN-${new Date().getFullYear()}`,
          transactionType: 'SHIP',
          referenceId: `ORDER-${Math.random().toString(36).substring(7).toUpperCase()}`,
          cartonsIn: 0,
          cartonsOut: shipCartons,
          storagePalletsIn: 0,
          shippingPalletsOut: Math.ceil(shipCartons / 10),
          transactionDate: new Date(),
          createdById: systemUser.id,
          notes: 'Sample shipment from Amazon FBA'
        }
      })
      
      // Update inventory balance
      const balance = await prisma.inventoryBalance.findUnique({
        where: {
          warehouseId_skuId_batchLot: {
            warehouseId: amazonWarehouse.id,
            skuId: randomSku.id,
            batchLot: `AMZN-${new Date().getFullYear()}`
          }
        }
      })
      
      if (balance) {
        await prisma.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            currentCartons: Math.max(0, balance.currentCartons - shipCartons),
            currentPallets: Math.max(0, balance.currentPallets - Math.ceil(shipCartons / 10)),
            currentUnits: Math.max(0, balance.currentUnits - (shipCartons * (randomSku.unitsPerCarton || 1))),
            lastTransactionDate: new Date()
          }
        })
      }
    }
    
    console.log('\nSample Amazon FBA data created successfully!')
    
    // Summary
    const amazonBalances = await prisma.inventoryBalance.findMany({
      where: { warehouseId: amazonWarehouse.id },
      include: { sku: true }
    })
    
    console.log('\nAmazon FBA Inventory Summary:')
    console.log(`Total SKUs with inventory: ${amazonBalances.length}`)
    console.log(`Total cartons: ${amazonBalances.reduce((sum, b) => sum + b.currentCartons, 0)}`)
    console.log(`Total units: ${amazonBalances.reduce((sum, b) => sum + b.currentUnits, 0)}`)
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

createAmazonSampleData()