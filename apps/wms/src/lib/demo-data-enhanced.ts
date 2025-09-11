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

interface Customer {
  id: string
  customerCode: string
  name: string
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  vatNumber: string | null
  isActive: boolean
}

interface DemoDataConfig {
  tx: Prisma.TransactionClient
  adminUserId: string
  staffUserId: string
  warehouses: Warehouse[]
  skus: Sku[]
}

export async function generateEnhancedDemoData(config: DemoDataConfig) {
  const { tx, adminUserId, staffUserId, warehouses, skus } = config
  const currentDate = new Date()
  
  // Create demo customers first
  const customers = await createDemoCustomers(tx)
  
  // Generate realistic inventory flow with integrity rules
  await generateInventoryFlow(tx, {
    adminUserId,
    staffUserId,
    warehouses,
    skus,
    customers,
    currentDate
  })
  
  // Generate financial data with proper relationships
  await generateFinancialData(tx, {
    adminUserId,
    warehouses,
    customers,
    currentDate
  })
}

async function createDemoCustomers(tx: Prisma.TransactionClient): Promise<Customer[]> {
  const customers = await Promise.all([
    tx.customer.create({
      data: {
        customerCode: 'CUST-001',
        name: 'TechWorld Online',
        contactEmail: 'orders@techworld.com',
        contactPhone: '+44 20 7123 4567',
        address: '123 Tech Street, London, EC1A 1AA',
        vatNumber: 'GB123456789',
        isActive: true,
      }
    }),
    tx.customer.create({
      data: {
        customerCode: 'CUST-002',
        name: 'Fashion Express Ltd',
        contactEmail: 'warehouse@fashionexpress.co.uk',
        contactPhone: '+44 161 234 5678',
        address: '456 Fashion Road, Manchester, M1 2AB',
        vatNumber: 'GB987654321',
        isActive: true,
      }
    }),
    tx.customer.create({
      data: {
        customerCode: 'CUST-003',
        name: 'Home & Living Co',
        contactEmail: 'logistics@homeliving.com',
        contactPhone: '+44 141 234 5678',
        address: '789 Home Avenue, Glasgow, G1 3CD',
        vatNumber: 'GB456789123',
        isActive: true,
      }
    }),
  ])
  
  return customers
}

interface InventoryFlowConfig {
  adminUserId: string
  staffUserId: string
  warehouses: Warehouse[]
  skus: Sku[]
  customers: Customer[]
  currentDate: Date
}

async function generateInventoryFlow(tx: Prisma.TransactionClient, config: InventoryFlowConfig) {
  const { adminUserId, staffUserId, warehouses, skus, customers, currentDate } = config
  
  // Track inventory state for each SKU/warehouse/batch combination
  const inventoryState = new Map<string, number>()
  
  // 1. Initial receiving - establish base inventory
  for (const warehouse of warehouses) {
    for (const sku of skus) {
      // Determine which customer owns this inventory
      const customer = customers[Math.floor(Math.random() * customers.length)]
      
      // Create 1-3 batch lots per SKU
      const numBatches = Math.floor(Math.random() * 3) + 1
      
      for (let b = 0; b < numBatches; b++) {
        const batchLot = `LOT-${currentDate.getFullYear()}${String(b + 1).padStart(3, '0')}-${sku.skuCode}`
        const receiveDate = new Date(currentDate.getTime() - (90 - b * 30) * 24 * 60 * 60 * 1000) // 90, 60, 30 days ago
        const cartons = Math.floor(Math.random() * 200) + 100 // 100-300 cartons
        
        // Get warehouse SKU config
        const config = await tx.warehouseSkuConfig.findFirst({
          where: { warehouseId: warehouse.id, skuId: sku.id }
        })
        
        const storagePallets = Math.ceil(cartons / (config?.storageCartonsPerPallet || 48))
        
        // Create receive transaction
        const receiveTransaction = await tx.inventoryTransaction.create({
          data: {
            transactionId: generateTransactionId('RCV'),
            warehouseId: warehouse.id,
            skuId: sku.id,
            customerId: customer.id,
            batchLot,
            transactionType: 'RECEIVE',
            cartonsIn: cartons,
            storagePalletsIn: storagePallets,
            transactionDate: receiveDate,
            createdById: staffUserId,
            storageCartonsPerPallet: config?.storageCartonsPerPallet,
            trackingNumber: `ASN-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`,
            notes: `Initial stock for ${customer.name}`,
          }
        })
        
        // Create inventory balance
        await tx.inventoryBalance.create({
          data: {
            warehouseId: warehouse.id,
            skuId: sku.id,
            customerId: customer.id,
            batchLot,
            currentCartons: cartons,
            currentPallets: storagePallets,
            currentUnits: cartons * sku.unitsPerCarton,
            lastTransactionDate: receiveDate,
            storageCartonsPerPallet: config?.storageCartonsPerPallet,
            shippingCartonsPerPallet: config?.shippingCartonsPerPallet,
          }
        })
        
        // Track inventory state
        const key = `${warehouse.id}-${sku.id}-${batchLot}`
        inventoryState.set(key, cartons)
        
        // Create storage ledger entry
        await tx.storageLedger.create({
          data: {
            warehouseId: warehouse.id,
            skuId: sku.id,
            customerId: customer.id,
            batchLot,
            transactionId: receiveTransaction.id,
            transactionType: 'RECEIVE',
            snapshotDate: receiveDate,
            openingCartons: 0,
            inboundCartons: cartons,
            outboundCartons: 0,
            closingCartons: cartons,
            averagePallets: storagePallets,
            storageCartonsPerPallet: config?.storageCartonsPerPallet,
          }
        })
      }
    }
  }
  
  // 2. Generate realistic shipping patterns
  const shipDays = 60 // Ship over last 60 days
  
  for (let day = shipDays; day > 0; day--) {
    const shipDate = new Date(currentDate.getTime() - day * 24 * 60 * 60 * 1000)
    const numShipments = Math.floor(Math.random() * 10) + 5 // 5-15 shipments per day
    
    for (let s = 0; s < numShipments; s++) {
      // Select random warehouse, sku, and customer
      const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)]
      const sku = skus[Math.floor(Math.random() * skus.length)]
      
      // Find available inventory for this SKU in this warehouse
      const availableInventory = await tx.inventoryBalance.findMany({
        where: {
          warehouseId: warehouse.id,
          skuId: sku.id,
          currentCartons: { gt: 0 }
        },
        include: {
          sku: true,
          customer: true
        },
        orderBy: { lastTransactionDate: 'asc' } // FIFO
      })
      
      if (availableInventory.length === 0) continue
      
      // Calculate shipment size (realistic order sizes)
      const totalAvailable = availableInventory.reduce((sum, inv) => sum + inv.currentCartons, 0)
      const shipmentSize = Math.min(
        Math.floor(Math.random() * 50) + 10, // 10-60 cartons per order
        Math.floor(totalAvailable * 0.3) // Don't ship more than 30% of available
      )
      
      if (shipmentSize < 5) continue // Skip very small shipments
      
      // Create shipment transaction(s) respecting batch lots
      let remainingToShip = shipmentSize
      const shipmentId = `SHIP-${String(Math.floor(Math.random() * 100000)).padStart(6, '0')}`
      
      for (const inventory of availableInventory) {
        if (remainingToShip <= 0) break
        
        const cartonsFromBatch = Math.min(remainingToShip, inventory.currentCartons)
        const config = await tx.warehouseSkuConfig.findFirst({
          where: { warehouseId: warehouse.id, skuId: sku.id }
        })
        
        const shippingPallets = Math.ceil(cartonsFromBatch / (config?.shippingCartonsPerPallet || 40))
        
        // Create ship transaction
        const shipTransaction = await tx.inventoryTransaction.create({
          data: {
            transactionId: generateTransactionId('SHP'),
            warehouseId: warehouse.id,
            skuId: sku.id,
            customerId: inventory.customerId,
            batchLot: inventory.batchLot,
            transactionType: 'SHIP',
            cartonsOut: cartonsFromBatch,
            shippingPalletsOut: shippingPallets,
            transactionDate: shipDate,
            createdById: staffUserId,
            shippingCartonsPerPallet: config?.shippingCartonsPerPallet,
            shipName: shipmentId,
            trackingNumber: generateTrackingNumber(),
            notes: `Order fulfillment for ${inventory.customer?.name || 'Customer'}`,
          }
        })
        
        // Update inventory balance
        await tx.inventoryBalance.update({
          where: { id: inventory.id },
          data: {
            currentCartons: inventory.currentCartons - cartonsFromBatch,
            currentPallets: Math.ceil((inventory.currentCartons - cartonsFromBatch) / (config?.storageCartonsPerPallet || 48)),
            currentUnits: (inventory.currentCartons - cartonsFromBatch) * inventory.sku.unitsPerCarton,
            lastTransactionDate: shipDate,
          }
        })
        
        // Update storage ledger
        await tx.storageLedger.create({
          data: {
            warehouseId: warehouse.id,
            skuId: sku.id,
            customerId: inventory.customerId,
            batchLot: inventory.batchLot,
            transactionId: shipTransaction.id,
            transactionType: 'SHIP',
            snapshotDate: shipDate,
            openingCartons: inventory.currentCartons,
            inboundCartons: 0,
            outboundCartons: cartonsFromBatch,
            closingCartons: inventory.currentCartons - cartonsFromBatch,
            averagePallets: Math.ceil((inventory.currentCartons - cartonsFromBatch) / (config?.storageCartonsPerPallet || 48)),
            storageCartonsPerPallet: config?.storageCartonsPerPallet,
          }
        })
        
        remainingToShip -= cartonsFromBatch
      }
    }
  }
  
  // 3. Add some inventory adjustments (cycle counts, damages)
  for (let i = 0; i < 10; i++) {
    const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)]
    const inventory = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId: warehouse.id,
        currentCartons: { gt: 20 }
      },
      include: {
        sku: true
      }
    })
    
    if (!inventory) continue
    
    const adjustmentType = Math.random() > 0.7 ? 'damage' : 'cycle_count'
    const adjustmentQty = adjustmentType === 'damage' 
      ? Math.floor(Math.random() * 5) + 1 // 1-5 cartons damaged
      : Math.floor(Math.random() * 10) - 5 // -5 to +5 cartons variance
    
    if (adjustmentQty === 0) continue
    
    const config = await tx.warehouseSkuConfig.findFirst({
      where: { warehouseId: warehouse.id, skuId: inventory.skuId }
    })
    
    // Create adjustment transaction
    const adjTransaction = await tx.inventoryTransaction.create({
      data: {
        transactionId: generateTransactionId('ADJ'),
        warehouseId: warehouse.id,
        skuId: inventory.skuId,
        customerId: inventory.customerId,
        batchLot: inventory.batchLot,
        transactionType: 'ADJUSTMENT',
        cartonsIn: adjustmentQty > 0 ? adjustmentQty : 0,
        cartonsOut: adjustmentQty < 0 ? Math.abs(adjustmentQty) : 0,
        transactionDate: new Date(currentDate.getTime() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
        createdById: adminUserId,
        notes: adjustmentType === 'damage' ? 'Damaged goods' : 'Cycle count adjustment',
      }
    })
    
    // Update inventory balance
    await tx.inventoryBalance.update({
      where: { id: inventory.id },
      data: {
        currentCartons: inventory.currentCartons + adjustmentQty,
        currentPallets: Math.ceil((inventory.currentCartons + adjustmentQty) / (config?.storageCartonsPerPallet || 48)),
        currentUnits: (inventory.currentCartons + adjustmentQty) * inventory.sku.unitsPerCarton,
        lastTransactionDate: adjTransaction.transactionDate,
      }
    })
  }
  
  // 4. Add some inter-warehouse transfers
  for (let i = 0; i < 5; i++) {
    if (warehouses.length < 2) break
    
    const fromWarehouse = warehouses[0]
    const toWarehouse = warehouses[1]
    
    const inventory = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId: fromWarehouse.id,
        currentCartons: { gt: 50 }
      },
      include: {
        sku: true
      }
    })
    
    if (!inventory) continue
    
    const transferQty = Math.floor(Math.random() * 30) + 20 // 20-50 cartons
    const transferDate = new Date(currentDate.getTime() - Math.floor(Math.random() * 20) * 24 * 60 * 60 * 1000)
    
    // Create transfer out transaction
    await tx.inventoryTransaction.create({
      data: {
        transactionId: generateTransactionId('TRO'),
        warehouseId: fromWarehouse.id,
        skuId: inventory.skuId,
        customerId: inventory.customerId,
        batchLot: inventory.batchLot,
        transactionType: 'TRANSFER_OUT',
        cartonsOut: transferQty,
        transactionDate: transferDate,
        createdById: staffUserId,
        notes: `Transfer to ${toWarehouse.name}`,
      }
    })
    
    // Create transfer in transaction
    await tx.inventoryTransaction.create({
      data: {
        transactionId: generateTransactionId('TRI'),
        warehouseId: toWarehouse.id,
        skuId: inventory.skuId,
        customerId: inventory.customerId,
        batchLot: inventory.batchLot,
        transactionType: 'TRANSFER_IN',
        cartonsIn: transferQty,
        transactionDate: new Date(transferDate.getTime() + 24 * 60 * 60 * 1000), // Next day
        createdById: staffUserId,
        notes: `Transfer from ${fromWarehouse.name}`,
      }
    })
    
    // Update source inventory
    await tx.inventoryBalance.update({
      where: { id: inventory.id },
      data: {
        currentCartons: inventory.currentCartons - transferQty,
        currentPallets: Math.ceil((inventory.currentCartons - transferQty) / (inventory.storageCartonsPerPallet || 48)),
        currentUnits: (inventory.currentCartons - transferQty) * inventory.sku.unitsPerCarton,
        lastTransactionDate: transferDate,
      }
    })
    
    // Create or update destination inventory
    const destInventory = await tx.inventoryBalance.findFirst({
      where: {
        warehouseId: toWarehouse.id,
        skuId: inventory.skuId,
        batchLot: inventory.batchLot
      }
    })
    
    if (destInventory) {
      await tx.inventoryBalance.update({
        where: { id: destInventory.id },
        data: {
          currentCartons: destInventory.currentCartons + transferQty,
          currentPallets: Math.ceil((destInventory.currentCartons + transferQty) / (destInventory.storageCartonsPerPallet || 48)),
          currentUnits: (destInventory.currentCartons + transferQty) * inventory.sku.unitsPerCarton,
          lastTransactionDate: transferDate,
        }
      })
    } else {
      const config = await tx.warehouseSkuConfig.findFirst({
        where: { warehouseId: toWarehouse.id, skuId: inventory.skuId }
      })
      
      await tx.inventoryBalance.create({
        data: {
          warehouseId: toWarehouse.id,
          skuId: inventory.skuId,
          customerId: inventory.customerId,
          batchLot: inventory.batchLot,
          currentCartons: transferQty,
          currentPallets: Math.ceil(transferQty / (config?.storageCartonsPerPallet || 48)),
          currentUnits: transferQty * inventory.sku.unitsPerCarton,
          lastTransactionDate: transferDate,
          storageCartonsPerPallet: config?.storageCartonsPerPallet,
          shippingCartonsPerPallet: config?.shippingCartonsPerPallet,
        }
      })
    }
  }
}

interface FinancialDataConfig {
  adminUserId: string
  warehouses: Warehouse[]
  customers: Customer[]
  currentDate: Date
}

async function generateFinancialData(tx: Prisma.TransactionClient, config: FinancialDataConfig) {
  const { adminUserId, warehouses, customers, currentDate } = config
  
  
  // Generate invoices for last 3 months
  for (let month = 2; month >= 0; month--) {
    const billingDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - month, 1)
    const billingPeriodStart = new Date(billingDate.getFullYear(), billingDate.getMonth(), 1)
    const billingPeriodEnd = new Date(billingDate.getFullYear(), billingDate.getMonth() + 1, 0)
    
    for (const customer of customers) {
      for (const warehouse of warehouses) {
        // Check if there was activity for this customer/warehouse
        const transactions = await tx.inventoryTransaction.count({
          where: {
            warehouseId: warehouse.id,
            customerId: customer.id,
            transactionDate: {
              gte: billingPeriodStart,
              lte: billingPeriodEnd
            }
          }
        })
        
        if (transactions === 0) continue
        
        // Calculate actual costs based on transactions and storage
        const storageData = await tx.storageLedger.aggregate({
          where: {
            warehouseId: warehouse.id,
            customerId: customer.id,
            snapshotDate: {
              gte: billingPeriodStart,
              lte: billingPeriodEnd
            }
          },
          _sum: {
            averagePallets: true,
            inboundCartons: true,
            outboundCartons: true,
          }
        })
        
        // Get cost rates
        const storageCost = 25.00 // Per pallet per week
        const inboundCost = 1.50 // Per carton
        const outboundCost = 1.75 // Per carton
        
        const weeklyPallets = (storageData._sum.averagePallets || 0) / 4 // Average over 4 weeks
        const storageFees = weeklyPallets * storageCost * 4
        const inboundFees = (storageData._sum.inboundCartons || 0) * inboundCost
        const outboundFees = (storageData._sum.outboundCartons || 0) * outboundCost
        
        const subtotal = storageFees + inboundFees + outboundFees
        if (subtotal < 100) continue // Skip very small invoices
        
        const taxAmount = subtotal * 0.20 // 20% VAT
        const totalAmount = subtotal + taxAmount
        
        // Determine invoice status based on age
        let status = 'draft'
        if (month === 2) {
          status = 'paid'
        } else if (month === 1) {
          status = Math.random() > 0.3 ? 'paid' : 'pending'
        } else {
          status = Math.random() > 0.8 ? 'disputed' : 'pending'
        }
        
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: `INV-${billingDate.getFullYear()}-${String(billingDate.getMonth() + 1).padStart(2, '0')}-${customer.customerCode}-${warehouse.code}`,
            warehouseId: warehouse.id,
            customerId: customer.id,
            billingPeriodStart,
            billingPeriodEnd,
            invoiceDate: new Date(billingPeriodEnd.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days after period end
            issueDate: new Date(billingPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000),
            dueDate: new Date(billingPeriodEnd.getTime() + 37 * 24 * 60 * 60 * 1000), // 30 days payment terms
            subtotal,
            taxAmount,
            totalAmount,
            currency: 'GBP',
            status,
            createdById: adminUserId,
            billingMonth: billingDate.getMonth() + 1,
            billingYear: billingDate.getFullYear(),
          }
        })
        
        // Create line items
        if (storageFees > 0) {
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: invoice.id,
              costCategory: 'Storage',
              costName: 'Pallet Storage',
              quantity: weeklyPallets * 4,
              unitRate: storageCost / 4, // Per pallet per week -> per pallet per month
              amount: storageFees,
            }
          })
        }
        
        if (inboundFees > 0) {
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: invoice.id,
              costCategory: 'Carton',
              costName: 'Inbound Processing',
              quantity: storageData._sum.inboundCartons || 0,
              unitRate: inboundCost,
              amount: inboundFees,
            }
          })
        }
        
        if (outboundFees > 0) {
          await tx.invoiceLineItem.create({
            data: {
              invoiceId: invoice.id,
              costCategory: 'Carton',
              costName: 'Outbound Processing',
              quantity: storageData._sum.outboundCartons || 0,
              unitRate: outboundCost,
              amount: outboundFees,
            }
          })
        }
        
        // Create reconciliation for paid invoices
        if (status === 'paid') {
          for (const category of ['Storage', 'Carton']) {
            const lineItems = await tx.invoiceLineItem.findMany({
              where: {
                invoiceId: invoice.id,
                costCategory: category
              }
            })
            
            const expectedAmount = lineItems.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0)
            if (expectedAmount > 0) {
              const variance = (Math.random() - 0.5) * 0.02 // +/- 2% variance
              const invoicedAmount = expectedAmount * (1 + variance)
              
              await tx.invoiceReconciliation.create({
                data: {
                  invoiceId: invoice.id,
                  costCategory: category,
                  costName: category === 'Storage' ? 'Pallet Storage' : 'Processing Fees',
                  expectedAmount,
                  invoicedAmount,
                  difference: invoicedAmount - expectedAmount,
                  status: Math.abs(variance) < 0.01 ? 'match' : 'mismatch',
                  notes: Math.abs(variance) < 0.01 ? 'Matched within tolerance' : 'Minor variance detected',
                  resolvedById: Math.abs(variance) < 0.01 ? adminUserId : null,
                  resolvedAt: Math.abs(variance) < 0.01 ? new Date() : null,
                }
              })
            }
          }
        }
        
        // Create payment records for paid invoices
        if (status === 'paid') {
          const paymentDate = new Date(invoice.dueDate.getTime() - Math.floor(Math.random() * 10) * 24 * 60 * 60 * 1000)
          
          await tx.invoicePayment.create({
            data: {
              invoiceId: invoice.id,
              paymentDate,
              amount: totalAmount,
              paymentMethod: Math.random() > 0.5 ? 'bank_transfer' : 'credit',
              transactionReference: `PAY-${String(Math.floor(Math.random() * 1000000)).padStart(7, '0')}`,
              notes: 'Payment received',
              createdById: adminUserId,
            }
          })
        }
      }
    }
  }
}

// Helper functions
function generateTransactionId(prefix: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 5).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

function generateTrackingNumber(): string {
  const carriers = ['DHL', 'UPS', 'FDX', 'DPD', 'TNT']
  const carrier = carriers[Math.floor(Math.random() * carriers.length)]
  const number = String(Math.floor(Math.random() * 1000000000)).padStart(10, '0')
  return `${carrier}${number}`
}