import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { WmsTransactionType } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, referenceNumber, date, items, notes, shipName, containerNumber, attachments } = body

    // Validate transaction type
    if (!type || !['RECEIVE', 'SHIP'].includes(type)) {
      return NextResponse.json({ 
        error: 'Invalid transaction type. Must be RECEIVE or SHIP' 
      }, { status: 400 })
    }

    // Validate required fields
    if (!referenceNumber || !date || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ 
        error: 'Missing required fields: PI/CI/PO number, date, and items' 
      }, { status: 400 })
    }

    // Validate date is not in the future
    const transactionDate = new Date(date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    
    if (isNaN(transactionDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    if (transactionDate > today) {
      return NextResponse.json({ 
        error: 'Transaction date cannot be in the future' 
      }, { status: 400 })
    }

    // Validate date is not too far in the past (e.g., 1 year)
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    if (transactionDate < oneYearAgo) {
      return NextResponse.json({ 
        error: 'Transaction date is too far in the past (max 1 year)' 
      }, { status: 400 })
    }

    // Validate warehouse assignment for staff
    if (session.user.role === 'staff' && !session.user.warehouseId) {
      return NextResponse.json({ error: 'No warehouse assigned' }, { status: 400 })
    }

    const warehouseId = session.user.warehouseId || body.warehouseId

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID required' }, { status: 400 })
    }

    // Check for duplicate transaction (prevent double submission)
    const recentDuplicate = await prisma.wmsInventoryTransaction.findFirst({
      where: {
        referenceId: referenceNumber,
        transactionType: type as WmsTransactionType,
        warehouseId,
        createdAt: {
          gte: new Date(Date.now() - 60000) // Within last minute
        }
      }
    })

    if (recentDuplicate) {
      return NextResponse.json({ 
        error: 'Duplicate transaction detected. A transaction with this reference was just processed.' 
      }, { status: 409 })
    }

    // Check for backdated transactions - prevent inserting transactions before the last transaction
    const lastTransaction = await prisma.wmsInventoryTransaction.findFirst({
      where: { warehouseId },
      orderBy: { transactionDate: 'desc' },
      select: { transactionDate: true, transactionId: true }
    })

    if (lastTransaction && transactionDate < lastTransaction.transactionDate) {
      return NextResponse.json({ 
        error: `Cannot create backdated transactions. The last transaction in this warehouse was on ${lastTransaction.transactionDate.toLocaleDateString()}. New transactions must have a date on or after this date.`,
        details: {
          lastTransactionDate: lastTransaction.transactionDate,
          attemptedDate: transactionDate,
          lastTransactionId: lastTransaction.transactionId
        }
      }, { status: 400 })
    }

    // Validate all items before processing
    for (const item of items) {
      // Validate item structure
      if (!item.skuCode || !item.batchLot || typeof item.cartons !== 'number') {
        return NextResponse.json({ 
          error: `Invalid item structure. Each item must have skuCode, batchLot, and cartons` 
        }, { status: 400 })
      }
      
      // Validate cartons is a positive integer
      if (!Number.isInteger(item.cartons) || item.cartons <= 0) {
        return NextResponse.json({ 
          error: `Cartons must be positive integers. Invalid value for SKU ${item.skuCode}: ${item.cartons}` 
        }, { status: 400 })
      }
      
      // Validate maximum cartons (prevent unrealistic values)
      if (item.cartons > 99999) {
        return NextResponse.json({ 
          error: `Cartons value too large for SKU ${item.skuCode}. Maximum allowed: 99,999` 
        }, { status: 400 })
      }
      
      // Validate pallets if provided
      if (item.pallets !== undefined && item.pallets !== null) {
        if (!Number.isInteger(item.pallets) || item.pallets < 0 || item.pallets > 9999) {
          return NextResponse.json({ 
            error: `Pallets must be integers between 0 and 9,999. Invalid value for SKU ${item.skuCode}` 
          }, { status: 400 })
        }
      }
      
      // Validate batch/lot is not empty
      if (!item.batchLot || item.batchLot.trim() === '') {
        return NextResponse.json({ 
          error: `Batch/Lot is required for SKU ${item.skuCode}` 
        }, { status: 400 })
      }
    }

    // Check for duplicate SKU/batch combinations in the request
    const itemKeys = new Set()
    for (const item of items) {
      const key = `${item.skuCode}-${item.batchLot}`
      if (itemKeys.has(key)) {
        return NextResponse.json({ 
          error: `Duplicate SKU/Batch combination found: ${item.skuCode} - ${item.batchLot}` 
        }, { status: 400 })
      }
      itemKeys.add(key)
    }

    // Verify all SKUs exist and check inventory for SHIP transactions
    for (const item of items) {
      const sku = await prisma.wmsSku.findFirst({
        where: { skuCode: item.skuCode }
      })

      if (!sku) {
        return NextResponse.json({ 
          error: `SKU ${item.skuCode} not found. Please create the SKU first.` 
        }, { status: 400 })
      }

      // For SHIP transactions, verify inventory availability
      if (type === 'SHIP') {
        const balance = await prisma.wmsInventoryBalance.findFirst({
          where: {
            warehouseId,
            skuId: sku.id,
            batchLot: item.batchLot,
          }
        })
        
        if (!balance || balance.currentCartons < item.cartons) {
          return NextResponse.json({ 
            error: `Insufficient inventory for SKU ${item.skuCode} batch ${item.batchLot}. Available: ${balance?.currentCartons || 0}, Requested: ${item.cartons}` 
          }, { status: 400 })
        }
      }
    }

    // Get warehouse for transaction ID generation
    const warehouse = await prisma.wmsWarehouse.findUnique({
      where: { id: warehouseId }
    })
    
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Create transactions for each item
    const transactions = []
    
    for (const item of items) {
      // Get SKU (already validated above)
      const sku = await prisma.wmsSku.findFirst({
        where: { skuCode: item.skuCode }
      })
      
      if (!sku) {
        throw new Error(`SKU not found: ${item.skuCode}`)
      }

      // Generate transaction ID in format similar to Excel data
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const sequenceNum: number = transactions.length + 1
      const transactionId = `${warehouse.code}-${type.slice(0, 3)}-${timestamp}-${sequenceNum.toString().padStart(3, '0')}`
      
      // Calculate pallet values
      let calculatedStoragePalletsIn = null
      let calculatedShippingPalletsOut = null
      let palletVarianceNotes = null
      let batchShippingCartonsPerPallet = item.shippingCartonsPerPallet
      
      if (type === 'RECEIVE' && item.storageCartonsPerPallet > 0) {
        calculatedStoragePalletsIn = Math.ceil(item.cartons / item.storageCartonsPerPallet)
        if (item.pallets !== calculatedStoragePalletsIn) {
          palletVarianceNotes = `Storage pallet variance: Actual ${item.pallets}, Calculated ${calculatedStoragePalletsIn} (${item.cartons} cartons @ ${item.storageCartonsPerPallet}/pallet)`
        }
      } else if (type === 'SHIP') {
        // For SHIP, get the batch-specific config from inventory balance
        const balance = await prisma.wmsInventoryBalance.findFirst({
          where: {
            warehouseId,
            skuId: sku.id,
            batchLot: item.batchLot,
          }
        })
        
        if (balance?.shippingCartonsPerPallet) {
          batchShippingCartonsPerPallet = balance.shippingCartonsPerPallet
          calculatedShippingPalletsOut = Math.ceil(item.cartons / batchShippingCartonsPerPallet)
          if (item.pallets !== calculatedShippingPalletsOut) {
            palletVarianceNotes = `Shipping pallet variance: Actual ${item.pallets}, Calculated ${calculatedShippingPalletsOut} (${item.cartons} cartons @ ${batchShippingCartonsPerPallet}/pallet)`
          }
        }
      }
      
      const transaction = await prisma.wmsInventoryTransaction.create({
        data: {
          transactionId,
          warehouseId,
          skuId: sku.id,
          batchLot: item.batchLot || 'NONE',
          transactionType: type as WmsTransactionType,
          referenceId: referenceNumber,
          cartonsIn: type === 'RECEIVE' ? item.cartons : 0,
          cartonsOut: type === 'SHIP' ? item.cartons : 0,
          storagePalletsIn: type === 'RECEIVE' ? (item.pallets || 0) : 0,
          shippingPalletsOut: type === 'SHIP' ? (item.pallets || 0) : 0,
          storageCartonsPerPallet: type === 'RECEIVE' ? item.storageCartonsPerPallet : null,
          shippingCartonsPerPallet: type === 'RECEIVE' ? item.shippingCartonsPerPallet : (type === 'SHIP' ? batchShippingCartonsPerPallet : null),
          notes,
          shipName: type === 'RECEIVE' ? shipName : null,
          containerNumber: type === 'RECEIVE' ? containerNumber : null,
          attachments: type === 'RECEIVE' && attachments ? attachments : null,
          transactionDate: new Date(date),
          pickupDate: new Date(date), // Set pickup date same as transaction date
          createdById: session.user.id,
        }
      })

      transactions.push(transaction)

      // Update inventory balance
      const balance = await prisma.wmsInventoryBalance.findFirst({
        where: {
          warehouseId,
          skuId: sku.id,
          batchLot: item.batchLot || 'NONE',
        }
      })

      const currentBalance = balance?.currentCartons || 0
      const newBalance = type === 'RECEIVE' 
        ? currentBalance + item.cartons
        : currentBalance - item.cartons

      // Additional check to prevent negative inventory
      if (newBalance < 0) {
        return NextResponse.json({ 
          error: `Operation would result in negative inventory for SKU ${item.skuCode} batch ${item.batchLot}` 
        }, { status: 400 })
      }

      // Calculate pallets based on batch-specific config or existing balance config
      let storageCartonsPerPallet = item.storageCartonsPerPallet
      let shippingCartonsPerPallet = item.shippingCartonsPerPallet
      
      // For SHIP transactions, use the config from the existing balance
      if (type === 'SHIP' && balance) {
        storageCartonsPerPallet = balance.storageCartonsPerPallet || 1
        shippingCartonsPerPallet = balance.shippingCartonsPerPallet || 1
      }
      
      const currentPallets = storageCartonsPerPallet && newBalance > 0
        ? Math.ceil(newBalance / storageCartonsPerPallet)
        : 0

      if (balance) {
        await prisma.wmsInventoryBalance.update({
          where: { id: balance.id },
          data: {
            currentCartons: Math.max(0, newBalance),
            currentPallets,
            currentUnits: Math.max(0, newBalance) * sku.unitsPerCarton,
            lastTransactionDate: new Date(date),
            // Only update config for RECEIVE transactions
            ...(type === 'RECEIVE' && {
              storageCartonsPerPallet: item.storageCartonsPerPallet,
              shippingCartonsPerPallet: item.shippingCartonsPerPallet,
            }),
          }
        })
      } else if (type === 'RECEIVE' && newBalance > 0) {
        await prisma.wmsInventoryBalance.create({
          data: {
            warehouseId,
            skuId: sku.id,
            batchLot: item.batchLot || 'NONE',
            currentCartons: newBalance,
            currentPallets,
            currentUnits: newBalance * sku.unitsPerCarton,
            storageCartonsPerPallet: item.storageCartonsPerPallet,
            shippingCartonsPerPallet: item.shippingCartonsPerPallet,
            lastTransactionDate: new Date(date),
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${transactions.length} transactions created`,
      transactionIds: transactions.map(t => t.transactionId),
    })
  } catch (error) {
    console.error('Transaction error:', error)
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Prevent updates to maintain immutability
export async function PUT(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be modified',
    message: 'To correct errors, please create an adjustment transaction (ADJUST_IN or ADJUST_OUT)'
  }, { status: 405 })
}

// Prevent deletes to maintain immutability
export async function DELETE(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be deleted',
    message: 'The inventory ledger maintains a permanent audit trail. To correct errors, please create an adjustment transaction'
  }, { status: 405 })
}