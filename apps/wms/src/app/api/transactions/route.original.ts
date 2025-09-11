import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { businessLogger, perfLogger } from '@/lib/logger/index'
import { sanitizeForDisplay } from '@/lib/security/input-sanitization'
// handleTransactionCosts removed - costs are handled via frontend pre-filling
import { parseLocalDateTime } from '@/lib/utils/date-helpers'
export const dynamic = 'force-dynamic'

interface TransactionItem {
  skuId?: string
  skuCode?: string
  batchLot?: string
  cartons?: number
  cartonsIn?: number
  cartonsOut?: number
  pallets?: number
  storagePalletsIn?: number
  shippingPalletsOut?: number
  storageCartonsPerPallet?: number
  shippingCartonsPerPallet?: number
  unitsPerCarton?: number
}

interface CostItem {
  costType: string
  costName: string
  quantity: number
  unitRate: number
  totalCost: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const _includeAttachments = searchParams.get('includeAttachments') === 'true'

    const transactions = await prisma.inventoryTransaction.findMany({
      take: limit,
      orderBy: { transactionDate: 'desc' },
      select: {
        id: true,
        transactionDate: true,
        transactionType: true,
        batchLot: true,
        referenceId: true,
        cartonsIn: true,
        cartonsOut: true,
        storagePalletsIn: true,
        shippingPalletsOut: true,
        createdAt: true,
        shipName: true,
        trackingNumber: true,
        pickupDate: true,
        attachments: true,
        storageCartonsPerPallet: true,
        shippingCartonsPerPallet: true,
        unitsPerCarton: true,
        supplier: true,
        // Use snapshot data
        warehouseCode: true,
        warehouseName: true,
        skuCode: true,
        skuDescription: true,
        createdById: true,
        createdByName: true
      }
    })

    // Extract notes from attachments for each transaction and add nested objects for backward compatibility
    const transactionsWithNotes = transactions.map(transaction => {
      let notes = null;
      if (transaction.attachments && Array.isArray(transaction.attachments)) {
        const notesAttachment = (transaction.attachments as Array<Record<string, unknown>>).find(att => att.type === 'notes');
        if (notesAttachment) {
          notes = notesAttachment.content;
        }
      }
      
      return {
        ...transaction,
        notes,
        // Add nested objects for backward compatibility
        warehouse: {
          id: '', // No longer have warehouse ID
          code: transaction.warehouseCode,
          name: transaction.warehouseName
        },
        sku: {
          id: '', // No longer have SKU ID
          skuCode: transaction.skuCode,
          description: transaction.skuDescription
        },
        createdBy: {
          id: transaction.createdById,
          fullName: transaction.createdByName
        }
      };
    });

    return NextResponse.json({ transactions: transactionsWithNotes })
  } catch (_error) {
    // console.error('Failed to fetch transactions:', _error)
    return NextResponse.json({ 
      error: 'Failed to fetch transactions' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bodyText = await request.text()
    // console.log('=== RAW REQUEST BODY ===')
    // console.log(bodyText)
    // console.log('Body includes "items":', bodyText.includes('"items"'))
    // console.log('Body includes "lineItems":', bodyText.includes('"lineItems"'))
    
    const body = JSON.parse(bodyText)
    
    // Log the entire request body for debugging
    // console.log('=== TRANSACTION API REQUEST ===')
    // console.log('Request body:', JSON.stringify(body, null, 2))
    // console.log('Body keys:', Object.keys(body))
    
    const { type, transactionType, referenceNumber, referenceId, date, transactionDate, pickupDate, items, lineItems, shipName, trackingNumber, attachments, notes, 
            warehouseId: bodyWarehouseId, skuId, batchLot, cartonsIn, cartonsOut, storagePalletsIn, shippingPalletsOut, supplier, costs } = body as {
      type?: string
      transactionType?: string  
      referenceNumber?: string
      referenceId?: string
      date?: string
      transactionDate?: string
      pickupDate?: string
      items?: TransactionItem[]
      lineItems?: TransactionItem[]
      shipName?: string
      trackingNumber?: string
      attachments?: Record<string, unknown>[]
      notes?: string
      warehouseId?: string
      skuId?: string
      batchLot?: string
      cartonsIn?: number
      cartonsOut?: number
      storagePalletsIn?: number
      shippingPalletsOut?: number
      supplier?: string
      costs?: CostItem[]
    }
    
    // Log extracted values
    // console.log('Extracted values:', {
    //   type,
    //   transactionType,
    //   referenceNumber,
    //   referenceId,
    //   date,
    //   transactionDate,
    //   itemsLength: items?.length || lineItems?.length,
    //   items: items?.slice(0, 1) || lineItems?.slice(0, 1), // Log first item only
    //   warehouseId: bodyWarehouseId,
    //   hasCosts: !!costs,
    //   costsLength: costs?.length
    // })
    
    // Sanitize text inputs
    const sanitizedReferenceNumber = referenceNumber ? sanitizeForDisplay(referenceNumber) : null
    const sanitizedReferenceId = referenceId ? sanitizeForDisplay(referenceId) : null
    const sanitizedShipName = shipName ? sanitizeForDisplay(shipName) : null
    const sanitizedTrackingNumber = trackingNumber ? sanitizeForDisplay(trackingNumber) : null
    const sanitizedNotes = notes ? sanitizeForDisplay(notes) : null
    const sanitizedSupplier = supplier ? sanitizeForDisplay(supplier) : null

    // Handle both 'type' and 'transactionType' fields for backward compatibility
    const txType = type || transactionType
    const refNumber = sanitizedReferenceNumber || sanitizedReferenceId
    const txDate = date || transactionDate

    // Validate transaction type
    if (!txType || !['RECEIVE', 'SHIP', 'ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
      return NextResponse.json({ 
        error: 'Invalid transaction type. Must be RECEIVE, SHIP, ADJUST_IN, or ADJUST_OUT' 
      }, { status: 400 })
    }

    // Build items array - support both 'items' and 'lineItems' for backward compatibility
    let itemsArray: TransactionItem[] = items || lineItems || []
    if (['ADJUST_IN', 'ADJUST_OUT'].includes(txType)) {
      // For adjustments, create single item from individual fields
      if (!skuId || !batchLot) {
        return NextResponse.json({ 
          error: 'Missing required fields for adjustment: skuId and batchLot' 
        }, { status: 400 })
      }
      
      // Get SKU code from skuId
      const sku = await prisma.sku.findUnique({
        where: { id: skuId }
      })
      
      if (!sku) {
        return NextResponse.json({ 
          error: 'SKU not found' 
        }, { status: 404 })
      }
      
      itemsArray = [{
        skuCode: sku.skuCode,
        batchLot: batchLot,
        cartons: cartonsIn || cartonsOut || 0,
        pallets: storagePalletsIn || shippingPalletsOut || 0
      }]
    }

    // Validate required fields for non-adjustment transactions
    if (['RECEIVE', 'SHIP'].includes(txType)) {
      // console.log('=== VALIDATION CHECK ===')
      // console.log('Transaction type:', txType)
      // console.log('Reference number:', refNumber)
      // console.log('Transaction date:', txDate)
      // console.log('Items array:', {
      //   exists: !!itemsArray,
      //   isArray: Array.isArray(itemsArray),
      //   length: itemsArray?.length,
      //   firstItem: itemsArray?.[0]
      // })
      
      if (!refNumber || !txDate || !itemsArray || !Array.isArray(itemsArray) || itemsArray.length === 0) {
        // console.log('VALIDATION FAILED:', {
        //   hasRefNumber: !!refNumber,
        //   hasTxDate: !!txDate,
        //   hasItemsArray: !!itemsArray,
        //   isItemsArray: Array.isArray(itemsArray),
        //   itemsLength: itemsArray?.length
        // })
        return NextResponse.json({ 
          error: 'Missing required fields: PI/CI/PO number, date, and items',
          debug: {
            refNumber: refNumber || 'MISSING',
            txDate: txDate || 'MISSING',
            itemsLength: itemsArray?.length || 0
          }
        }, { status: 400 })
      }
    }

    // Validate required fields for all transactions
    if (!refNumber || !txDate) {
      return NextResponse.json({ 
        error: 'Missing required fields: reference number and date' 
      }, { status: 400 })
    }

    // Validate date format - use parseLocalDateTime to handle both date and datetime formats
    const transactionDateObj = parseLocalDateTime(txDate)
    
    if (isNaN(transactionDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    // Future date restriction removed - businesses may need to schedule future transactions

    // Historical date validation removed - businesses may need to enter old data for migration or corrections

    // Validate warehouse assignment for staff
    if (session.user.role === 'staff' && !session.user.warehouseId) {
      return NextResponse.json({ error: 'No warehouse assigned' }, { status: 400 })
    }

    const warehouseId = session.user.warehouseId || bodyWarehouseId

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID required' }, { status: 400 })
    }
    
    // Get the full user data for createdByName
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { fullName: true, username: true }
    })
    
    // Log if user lookup fails
    if (!currentUser) {
      // console.error(`User lookup failed for session user ID: ${session.user.id}`)
    }
    
    const createdByName = currentUser?.fullName || currentUser?.username || 'Unknown User'

    // Duplicate check removed - businesses may have legitimate duplicate references
    // (e.g., multiple shipments with same PO number)

    // Backdating check temporarily disabled - businesses need flexibility for corrections
    // TODO: Re-enable with override capability for admins
    /*
    const lastTransaction = await prisma.inventoryTransaction.findFirst({
      where: { warehouseId },
      orderBy: { transactionDate: 'desc' },
      select: { transactionDate: true, id: true }
    })

    if (lastTransaction && transactionDateObj < lastTransaction.transactionDate) {
      return NextResponse.json({ 
        error: `Cannot create backdated transactions. The last transaction in this warehouse was on ${lastTransaction.transactionDate.toLocaleDateString()}. New transactions must have a date on or after this date.`,
        details: {
          lastTransactionDate: lastTransaction.transactionDate,
          attemptedDate: transactionDateObj,
          lastTransactionId: lastTransaction.transactionId
        }
      }, { status: 400 })
    }
    */

    // Validate all items before processing
    for (const item of itemsArray) {
      // Support both 'cartons' and 'cartonsIn' for backward compatibility
      if (item.cartonsIn !== undefined && item.cartons === undefined) {
        item.cartons = item.cartonsIn
      }
      // Support 'cartonsOut' for SHIP transactions
      if (item.cartonsOut !== undefined && item.cartons === undefined) {
        item.cartons = item.cartonsOut
      }
      // Support both 'pallets' and 'storagePalletsIn' for backward compatibility
      if (item.storagePalletsIn !== undefined && item.pallets === undefined) {
        item.pallets = item.storagePalletsIn
      }
      // Support 'shippingPalletsOut' for SHIP transactions
      if (item.shippingPalletsOut !== undefined && item.pallets === undefined) {
        item.pallets = item.shippingPalletsOut
      }
      
      // Handle both skuId and skuCode for backward compatibility
      if (!item.skuCode && item.skuId) {
        // If skuCode is missing but skuId is provided, look it up
        const sku = await prisma.sku.findUnique({
          where: { id: item.skuId }
        })
        if (sku) {
          item.skuCode = sku.skuCode
        }
      }
      
      // Validate item structure
      if (!item.skuCode || !item.batchLot || typeof item.cartons !== 'number') {
        return NextResponse.json({ 
          error: `Invalid item structure. Each item must have skuCode, batchLot, and cartons` 
        }, { status: 400 })
      }
      
      // For RECEIVE transactions, validate storage and shipping configs
      if (txType === 'RECEIVE') {
        if (!item.storageCartonsPerPallet || item.storageCartonsPerPallet <= 0) {
          return NextResponse.json({ 
            error: `Storage configuration required for RECEIVE transactions. Please specify cartons per pallet for storage for SKU ${item.skuCode}` 
          }, { status: 400 })
        }
        if (!item.shippingCartonsPerPallet || item.shippingCartonsPerPallet <= 0) {
          return NextResponse.json({ 
            error: `Shipping configuration required for RECEIVE transactions. Please specify cartons per pallet for shipping for SKU ${item.skuCode}` 
          }, { status: 400 })
        }
      }
      
      // Validate cartons is a positive integer
      if (!Number.isInteger(item.cartons) || item.cartons <= 0) {
        return NextResponse.json({ 
          error: `Cartons must be positive integers. Invalid value for SKU ${item.skuCode}: ${item.cartons}` 
        }, { status: 400 })
      }
      
      // Validate maximum cartons (prevent unrealistic values)
      if (item.cartons > 10000) {
        return NextResponse.json({ 
          error: `Cartons value too large for SKU ${item.skuCode}. Maximum allowed: 10,000` 
        }, { status: 400 })
      }
      
      // Validate pallets if provided
      if (item.pallets !== undefined && item.pallets !== null) {
        if (!Number.isInteger(item.pallets) || item.pallets < 0 || item.pallets > 5000) {
          return NextResponse.json({ 
            error: `Pallets must be integers between 0 and 5,000. Invalid value for SKU ${item.skuCode}` 
          }, { status: 400 })
        }
      }
      
      // Validate and sanitize batch/lot
      if (!item.batchLot || item.batchLot.trim() === '') {
        return NextResponse.json({ 
          error: `Batch/Lot is required for SKU ${item.skuCode}` 
        }, { status: 400 })
      }
      
      // Validate batch lot is numeric for RECEIVE transactions
      if (txType === 'RECEIVE' && !/^\d+$/.test(item.batchLot.trim())) {
        // Log warning but don't block for now to avoid breaking existing workflows
        // console.warn(`Non-numeric batch lot for SKU ${item.skuCode}: ${item.batchLot}`)
        // In future, enforce this validation:
        // return NextResponse.json({ 
        //   error: `Batch/Lot must be numeric for SKU ${item.skuCode}. Got: ${item.batchLot}` 
        // }, { status: 400 })
      }
      
      item.batchLot = sanitizeForDisplay(item.batchLot)
      item.skuCode = sanitizeForDisplay(item.skuCode)
    }

    // Check for duplicate SKU/batch combinations in the request
    const itemKeys = new Set()
    for (const item of itemsArray) {
      const key = `${item.skuCode}-${item.batchLot}`
      if (itemKeys.has(key)) {
        return NextResponse.json({ 
          error: `Duplicate SKU/Batch combination found: ${item.skuCode} - ${item.batchLot}` 
        }, { status: 400 })
      }
      itemKeys.add(key)
    }

    // Get warehouse for transaction ID generation
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId }
    })
    
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Verify all SKUs exist and check inventory for SHIP transactions
    for (const item of itemsArray) {
      const sku = await prisma.sku.findFirst({
        where: { skuCode: item.skuCode }
      })

      if (!sku) {
        return NextResponse.json({ 
          error: `SKU ${item.skuCode} not found. Please create the SKU first.` 
        }, { status: 400 })
      }

      // For SHIP and ADJUST_OUT transactions, verify inventory availability
      if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
        // Calculate current balance from transactions
        const transactions = await prisma.inventoryTransaction.findMany({
          where: {
            warehouseCode: warehouse.code,
            skuCode: sku.skuCode,
            batchLot: item.batchLot,
            transactionDate: { lte: transactionDateObj }
          }
        })
        
        let currentCartons = 0
        for (const txn of transactions) {
          currentCartons += txn.cartonsIn - txn.cartonsOut
        }
        
        if (currentCartons < item.cartons) {
          return NextResponse.json({ 
            error: `Insufficient inventory for SKU ${item.skuCode} batch ${item.batchLot}. Available: ${currentCartons}, Requested: ${item.cartons}` 
          }, { status: 400 })
        }
      }
    }

    // Start performance tracking
    const startTime = Date.now();
    
    // Create transactions with proper database transaction and locking
    const result = await prisma.$transaction(async (tx) => {
        const transactions = [];
        
        // Pre-fetch all SKUs to reduce queries
        const skuCodes = itemsArray.map((item: TransactionItem) => item.skuCode).filter(Boolean);
        const skus = await tx.sku.findMany({
          where: { skuCode: { in: skuCodes as string[] } }
        });
        const skuMap = new Map(skus.map(sku => [sku.skuCode, sku]));
        
        for (const item of itemsArray) {
          const sku = skuMap.get(item.skuCode!);
          if (!sku) {
            throw new Error(`SKU not found: ${item.skuCode}`);
          }

          // Calculate pallet values
          let calculatedStoragePalletsIn = null
          let calculatedShippingPalletsOut = null
          const _palletVarianceNotes = null
          let batchShippingCartonsPerPallet = item.shippingCartonsPerPallet
      
          if (['RECEIVE', 'ADJUST_IN'].includes(txType)) {
            // For adjustments, use provided pallets value directly
            if (txType === 'ADJUST_IN' && item.pallets) {
              calculatedStoragePalletsIn = item.pallets
            } else if (item.storageCartonsPerPallet && item.storageCartonsPerPallet > 0) {
              calculatedStoragePalletsIn = Math.ceil((item.cartons || 0) / item.storageCartonsPerPallet)
              if (item.pallets !== calculatedStoragePalletsIn) {
                const _palletVarianceNotes = `Storage pallet variance: Actual ${item.pallets}, Calculated ${calculatedStoragePalletsIn} (${item.cartons} cartons @ ${item.storageCartonsPerPallet}/pallet)`
              }
            }
          } else if (['SHIP', 'ADJUST_OUT'].includes(txType)) {
            // For SHIP, get the batch-specific config from the original RECEIVE transaction
            const originalReceive = await tx.inventoryTransaction.findFirst({
              where: {
                warehouseCode: warehouse.code,
                skuCode: sku.skuCode,
                batchLot: item.batchLot,
                transactionType: 'RECEIVE'
              },
              orderBy: { transactionDate: 'asc' }
            });
            
            if (txType === 'ADJUST_OUT' && item.pallets) {
              calculatedShippingPalletsOut = item.pallets
            } else if (originalReceive?.shippingCartonsPerPallet) {
              batchShippingCartonsPerPallet = originalReceive.shippingCartonsPerPallet
              calculatedShippingPalletsOut = Math.ceil((item.cartons || 0) / batchShippingCartonsPerPallet)
              if (item.pallets !== calculatedShippingPalletsOut) {
                const _palletVarianceNotes2 = `Shipping pallet variance: Actual ${item.pallets}, Calculated ${calculatedShippingPalletsOut} (${item.cartons} cartons @ ${batchShippingCartonsPerPallet}/pallet)`
              }
            }
          }
      
          // Use the provided reference number (commercial invoice) directly
          const referenceId = refNumber
          
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
              batchLot: item.batchLot || 'NONE',
              transactionType: txType as TransactionType,
              referenceId: referenceId,
              cartonsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? (item.cartons || 0) : 0,
              cartonsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? (item.cartons || 0) : 0,
              storagePalletsIn: ['RECEIVE', 'ADJUST_IN'].includes(txType) ? (item.storagePalletsIn || item.pallets || calculatedStoragePalletsIn || 0) : 0,
              shippingPalletsOut: ['SHIP', 'ADJUST_OUT'].includes(txType) ? (item.shippingPalletsOut || item.pallets || calculatedShippingPalletsOut || 0) : 0,
              storageCartonsPerPallet: txType === 'RECEIVE' ? item.storageCartonsPerPallet : null,
              shippingCartonsPerPallet: txType === 'RECEIVE' ? item.shippingCartonsPerPallet : (txType === 'SHIP' ? batchShippingCartonsPerPallet : null),
              shipName: txType === 'RECEIVE' ? sanitizedShipName : null,
              trackingNumber: sanitizedTrackingNumber || null,
              supplier: txType === 'RECEIVE' ? sanitizedSupplier : null,
              attachments: (() => {
                const combinedAttachments = attachments || [];
                // Add notes as a special attachment entry for all transaction types
                if (sanitizedNotes) {
                  return [...combinedAttachments, { type: 'notes', content: sanitizedNotes }];
                }
                return combinedAttachments.length > 0 ? combinedAttachments : null;
              })(),
              transactionDate: parseLocalDateTime(txDate),
              pickupDate: pickupDate ? parseLocalDateTime(pickupDate) : parseLocalDateTime(txDate), // Use provided pickup date or default to transaction date
              createdById: session.user.id,
              createdByName: createdByName,
              unitsPerCarton: item.unitsPerCarton || sku.unitsPerCarton // Capture units per carton - prefer provided value, fallback to SKU master
            }
          })

          transactions.push(transaction)

          // Save costs to CostLedger if provided manually
          if (costs && Array.isArray(costs) && costs.length > 0) {
            for (const cost of costs) {
              if (cost.totalCost && cost.totalCost > 0) {
                // Map frontend cost types to database enum values
                let costCategory: 'Container' | 'Carton' | 'Pallet' | 'transportation' = 'Container'
                if (cost.costType === 'container') {
                  costCategory = 'Container'
                } else if (cost.costType === 'carton') {
                  costCategory = 'Carton'
                } else if (cost.costType === 'pallet') {
                  costCategory = 'Pallet'
                } else if (cost.costType === 'transportation') {
                  costCategory = 'transportation'
                }
                
                await tx.costLedger.create({
                  data: {
                    transactionId: transaction.id,
                    costCategory: costCategory as 'Container' | 'Carton' | 'Pallet' | 'transportation',
                    costName: cost.costName || '',
                    quantity: cost.quantity || 1,
                    unitRate: cost.unitRate || 0,
                    totalCost: cost.totalCost || 0,
                    warehouseCode: warehouse.code,
                    warehouseName: warehouse.name,
                    createdByName: createdByName,
                    createdAt: transactionDateObj
                  }
                })
              }
            }
          }
          // Note: RECEIVE transaction costs are pre-filled by the frontend based on warehouse cost rates
          // and sent as part of the costs array, so they're handled by the manual cost path above
        }

        // Inventory balances are now calculated at runtime from transactions
        // No need to update a separate balance table
        
        return transactions;
    });

    const duration = Date.now() - startTime;
    
    // Log successful transaction completion
    businessLogger.info('Inventory transaction completed successfully', {
      transactionType: txType,
      referenceNumber: refNumber,
      warehouseId,
      transactionCount: result.length,
      transactionIds: result.map(t => t.id),
      totalCartons: itemsArray.reduce((sum: number, item: TransactionItem) => sum + (item.cartons || 0), 0),
      duration,
      userId: session.user.id
    });
    
    // Log performance metrics
    perfLogger.log('Transaction processing completed', {
      transactionType: txType,
      itemCount: itemsArray.length,
      duration,
      avgDurationPerItem: duration / itemsArray.length
    });
    
    // Cost calculation is now handled automatically by Prisma middleware
    // The middleware will detect transactions with costs and process them
    // No manual trigger needed!
    
    return NextResponse.json({
      success: true,
      message: `${result.length} transactions created`,
      transactionIds: result.map(t => t.id), // Return UUIDs for navigation
    })
  } catch (error: unknown) {
    // console.error('Transaction error:', error);
    // console.error('Error stack:', error.stack);
    
    // Check for specific error types
    if (error.message?.includes('Insufficient inventory')) {
      return NextResponse.json({ 
        error: error.message
      }, { status: 400 })
    }
    
    if (error.message?.includes('could not serialize') || 
        error.message?.includes('deadlock') ||
        error.message?.includes('concurrent update')) {
      return NextResponse.json({ 
        error: 'Transaction conflict detected. Please try again.',
        details: 'Another transaction is modifying the same inventory. Please retry your request.'
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: 'Failed to create transaction',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Prevent updates to maintain immutability
export async function PUT(_request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be modified',
    message: 'To correct errors, please create an adjustment transaction (ADJUST_IN or ADJUST_OUT)'
  }, { status: 405 })
}

// Prevent deletes to maintain immutability
export async function DELETE(_request: NextRequest) {
  return NextResponse.json({ 
    error: 'Inventory transactions are immutable and cannot be deleted',
    message: 'The inventory ledger maintains a permanent audit trail. To correct errors, please create an adjustment transaction'
  }, { status: 405 })
}