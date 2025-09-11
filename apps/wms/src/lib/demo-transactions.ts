/**
 * Create demo transactions
 * Uses direct database access but follows the same logic as the API
 * Creates cost ledger entries like the API trigger would
 */

import { Prisma } from '@prisma/client'

interface Warehouse {
  id: string
  code: string
  name: string
  address: string
}

interface Sku {
  id: string
  skuCode: string
  description: string
  unitDimensionsCm: string
  unitWeightKg: number
  cartonDimensionsCm: string
  cartonWeightKg: number
  packagingType: string
  unitsPerCarton: number
}

interface DemoTransactionConfig {
  tx: Prisma.TransactionClient
  adminUserId: string
  staffUserId: string
  warehouses: Warehouse[]
  skus: Sku[]
}

export async function createDemoTransactions(config: DemoTransactionConfig) {
  const { tx, adminUserId, staffUserId, warehouses, skus } = config
  const currentDate = new Date()
  
  // console.log('🚀 Creating demo transactions...')
  
  // Track inventory for logical consistency
  const inventoryMap = new Map<string, number>()
  const createdTransactions: Record<string, unknown>[] = []
  
  try {
    // 1. Create initial inventory (RECEIVE transactions)
    // console.log('📦 Creating initial inventory...')
    // console.log('  Available SKUs:', skus.length)
    
    for (const warehouse of warehouses) {
      // Make sure we have SKUs to work with
      const skusToUse = skus.slice(0, Math.min(5, skus.length))
      if (skusToUse.length === 0) {
        // console.log('  ⚠️ No SKUs available, skipping warehouse', warehouse.code)
        continue
      }
      
      for (const sku of skusToUse) {
        if (!sku || typeof sku !== 'object' || !('skuCode' in sku) || !sku.skuCode) {
          // console.log('  ⚠️ Invalid SKU:', sku)
          continue
        }
        const batchLot = `DEMO-2024-${sku.skuCode}`
        const cartons = 100 + Math.floor(Math.random() * 100) // 100-200 cartons
        const transactionDate = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
        
        const transaction = await tx.inventoryTransaction.create({
          data: {
            // Warehouse snapshot data
            warehouseCode: warehouse.code,
            warehouseName: warehouse.name,
            warehouseAddress: warehouse.address,
            // SKU snapshot data
            skuCode: sku.skuCode,
            skuDescription: sku.description,
            unitDimensionsCm: sku.unitDimensionsCm,
            unitWeightKg: sku.unitWeightKg,
            cartonDimensionsCm: sku.cartonDimensionsCm,
            cartonWeightKg: sku.cartonWeightKg,
            packagingType: sku.packagingType,
            unitsPerCarton: sku.unitsPerCarton,
            // Transaction data
            batchLot,
            transactionType: 'RECEIVE',
            referenceId: `PI-DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            cartonsIn: cartons,
            cartonsOut: 0,
            storagePalletsIn: Math.ceil(cartons / 48),
            shippingPalletsOut: 0,
            storageCartonsPerPallet: 48,
            shippingCartonsPerPallet: 40,
            transactionDate,
            pickupDate: transactionDate,
            supplier: 'Demo Supplier Co.',
            shipName: 'DEMO VESSEL',
            createdById: staffUserId,
            createdByName: 'Demo Staff'
          }
        })
        
        createdTransactions.push(transaction)
        
        // Track inventory
        const key = `${warehouse.code}-${sku.skuCode}-${batchLot}`
        inventoryMap.set(key, cartons)
        
        // console.log(`  ✅ Received ${cartons} cartons of ${sku.skuCode} at ${warehouse.code}`)
        
        // Small delay to avoid ID conflicts
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
    
    // 2. Create some shipments (respecting inventory levels)
    // console.log('🚚 Creating shipment transactions...')
    for (let i = 0; i < 10; i++) {
      const warehouse = warehouses[0]
      const skuIndex = Math.floor(Math.random() * Math.min(5, skus.length))
      const sku = skus[skuIndex]
      
      if (!sku || typeof sku !== 'object' || !('skuCode' in sku) || !sku.skuCode) {
        // console.log('  ⚠️ Invalid SKU at index', skuIndex)
        continue
      }
      
      const batchLot = `DEMO-2024-${sku.skuCode}`
      const key = `${warehouse.code}-${sku.skuCode}-${batchLot}`
      
      const currentInventory = inventoryMap.get(key) || 0
      if (currentInventory < 20) continue // Skip if inventory too low
      
      const shipCartons = Math.min(
        Math.floor(Math.random() * 20) + 10, 
        currentInventory - 10
      )
      
      const transactionDate = new Date(currentDate.getTime() - (20 - i) * 24 * 60 * 60 * 1000)
      
      const transaction = await tx.inventoryTransaction.create({
        data: {
          // Warehouse snapshot data
          warehouseCode: warehouse.code,
          warehouseName: warehouse.name,
          warehouseAddress: warehouse.address,
          // SKU snapshot data
          skuCode: sku.skuCode,
          skuDescription: sku.description,
          unitDimensionsCm: sku.unitDimensionsCm,
          unitWeightKg: sku.unitWeightKg,
          cartonDimensionsCm: sku.cartonDimensionsCm,
          cartonWeightKg: sku.cartonWeightKg,
          packagingType: sku.packagingType,
          unitsPerCarton: sku.unitsPerCarton,
          // Transaction data
          batchLot,
          transactionType: 'SHIP',
          referenceId: `CI-DEMO-${String(i + 1).padStart(5, '0')}`,
          cartonsIn: 0,
          cartonsOut: shipCartons,
          storagePalletsIn: 0,
          shippingPalletsOut: Math.ceil(shipCartons / 40),
          shippingCartonsPerPallet: 40,
          transactionDate,
          pickupDate: transactionDate,
          shipName: `ORDER-${String(i + 1).padStart(5, '0')}`,
          trackingNumber: `TRK${String(Math.floor(Math.random() * 1000000)).padStart(10, '0')}`,
          createdById: staffUserId,
          createdByName: 'Demo Staff'
        }
      })
      
      createdTransactions.push(transaction)
      
      // Update tracked inventory
      inventoryMap.set(key, currentInventory - shipCartons)
      
      // console.log(`  ✅ Shipped ${shipCartons} cartons of ${sku.skuCode} from ${warehouse.code}`)
      
      // Small delay to avoid ID conflicts
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // 3. Create a transaction with costs to test cost ledger
    // console.log('💰 Creating transaction with costs...')
    const warehouse = warehouses[0]
    const sku = skus[0]
    
    if (!warehouse || !sku || typeof sku !== 'object' || !('skuCode' in sku) || !sku.skuCode) {
      // console.log('  ⚠️ Cannot create cost transaction - missing warehouse or SKU')
      return {
        success: true,
        transactions: createdTransactions,
        inventorySummary: Array.from(inventoryMap.entries()).map(([key, cartons]) => ({
          key,
          cartons
        }))
      }
    }
    
    const transactionDate = new Date()
    
    const costTransaction = await tx.inventoryTransaction.create({
      data: {
        // Warehouse snapshot data
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        warehouseAddress: warehouse.address,
        // SKU snapshot data
        skuCode: sku.skuCode,
        skuDescription: sku.description,
        unitDimensionsCm: sku.unitDimensionsCm,
        unitWeightKg: sku.unitWeightKg,
        cartonDimensionsCm: sku.cartonDimensionsCm,
        cartonWeightKg: sku.cartonWeightKg,
        packagingType: sku.packagingType,
        unitsPerCarton: sku.unitsPerCarton,
        // Transaction data
        batchLot: `COST-DEMO-${Date.now()}`,
        transactionType: 'RECEIVE',
        referenceId: `PI-COST-DEMO-${Date.now()}`,
        cartonsIn: 50,
        cartonsOut: 0,
        storagePalletsIn: Math.ceil(50 / 48),
        shippingPalletsOut: 0,
        storageCartonsPerPallet: 48,
        shippingCartonsPerPallet: 40,
        transactionDate,
        pickupDate: transactionDate,
        supplier: 'Demo Cost Supplier',
        createdById: adminUserId,
        createdByName: 'Demo Administrator'
      }
    })
    
    createdTransactions.push(costTransaction)
    
    // Create cost ledger entries for this transaction (simulating what the API trigger does)
    // Using actual cost categories from the cost_rates table
    const costs = {
      handling: 75.00,    // Will use "Carton" category
      storage: 100.00,    // Will use "Storage" category
      container: 150.00,  // Will use "Container" category
      pallet: 25.00       // Will use "Pallet" category
    }
    
    const costEntries = []
    
    // Add handling cost
    if (costs.handling && costs.handling > 0) {
      costEntries.push({
        transactionId: costTransaction.id,
        costCategory: 'Carton' as const,
        costName: 'Inbound Handling',
        quantity: costTransaction.cartonsIn,
        unitRate: costs.handling / costTransaction.cartonsIn,
        totalCost: costs.handling,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        createdByName: 'Demo Administrator',
        createdAt: costTransaction.transactionDate
      })
    }
    
    // Add storage cost
    if (costs.storage && costs.storage > 0) {
      costEntries.push({
        transactionId: costTransaction.id,
        costCategory: 'Storage' as const,
        costName: 'Storage Fee',
        quantity: costTransaction.cartonsIn,
        unitRate: costs.storage / costTransaction.cartonsIn,
        totalCost: costs.storage,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        createdByName: 'Demo Administrator',
        createdAt: costTransaction.transactionDate
      })
    }
    
    // Add container cost
    if (costs.container && costs.container > 0) {
      costEntries.push({
        transactionId: costTransaction.id,
        costCategory: 'Container' as const,
        costName: 'Container Unloading',
        quantity: 1,
        unitRate: costs.container,
        totalCost: costs.container,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        createdByName: 'Demo Administrator',
        createdAt: costTransaction.transactionDate
      })
    }
    
    // Add pallet cost
    if (costs.pallet && costs.pallet > 0) {
      costEntries.push({
        transactionId: costTransaction.id,
        costCategory: 'Pallet' as const,
        costName: 'Pallet handling',
        quantity: costTransaction.storagePalletsIn,
        unitRate: costs.pallet / costTransaction.storagePalletsIn,
        totalCost: costs.pallet,
        warehouseCode: warehouse.code,
        warehouseName: warehouse.name,
        createdByName: 'Demo Administrator',
        createdAt: costTransaction.transactionDate
      })
    }
    
    if (costEntries.length > 0) {
      for (const entry of costEntries) {
        await tx.costLedger.create({
          data: entry
        })
      }
    }
    
    // console.log(`  ✅ Created transaction with ${costEntries.length} cost ledger entries`)
    
    // console.log(`\n✨ Demo transactions complete!`)
    // console.log(`   Created ${createdTransactions.length} transactions`)
    
    return {
      success: true,
      transactions: createdTransactions,
      inventorySummary: Array.from(inventoryMap.entries()).map(([key, cartons]) => ({
        key,
        cartons
      }))
    }
    
  } catch (_error: unknown) {
    // console.error('❌ Demo transaction creation failed:', _error)
    throw _error
  }
}