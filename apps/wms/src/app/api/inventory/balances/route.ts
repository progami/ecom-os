import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getPaginationParams, getPaginationSkipTake, createPaginatedResponse } from '@/lib/database/pagination'
import { sanitizeSearchQuery } from '@/lib/security/input-sanitization'
import { calculateUnits } from '@/lib/utils/unit-calculations'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId') || session.user.warehouseId
    const date = searchParams.get('date')
    const showZeroStock = searchParams.get('showZeroStock') === 'true'
    const skuCode = searchParams.get('skuCode')
    
    // Get pagination params
    const paginationParams = getPaginationParams(req)

    // Always calculate balances from transactions (runtime calculation)
    const pointInTime = date ? new Date(date) : new Date()
    // Set to end of day to include all transactions from today
    pointInTime.setHours(23, 59, 59, 999)
    
    // Build where clause for transactions
    const transactionWhere: Prisma.InventoryTransactionWhereInput = {
      transactionDate: { lte: pointInTime }
    }
    
    if (session.user.role === 'staff' && session.user.warehouseId) {
      // Get warehouse code for staff user's warehouse
      const staffWarehouse = await prisma.warehouse.findUnique({
        where: { id: session.user.warehouseId },
        select: { code: true }
      })
      if (staffWarehouse) {
        transactionWhere.warehouseCode = staffWarehouse.code
      }
    } else if (warehouseId) {
      // Get warehouse code for specified warehouse
      const warehouse = await prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { code: true }
      })
      if (warehouse) {
        transactionWhere.warehouseCode = warehouse.code
      }
    } else {
      // Exclude Amazon warehouse when not querying specific warehouse
      transactionWhere.NOT = {
        OR: [
          { warehouseCode: 'AMZN' },
          { warehouseCode: 'AMZN-UK' }
        ]
      }
    }
    
    // Add SKU filter if provided
    if (skuCode) {
      transactionWhere.skuCode = {
        contains: sanitizeSearchQuery(skuCode),
        mode: 'insensitive'
      }
    }
    
    // Fetch all transactions up to the date
    const transactions = await prisma.inventoryTransaction.findMany({
      where: transactionWhere,
      orderBy: [
        { transactionDate: 'asc' },
        { createdAt: 'asc' }
      ]
    })
    
    // Get warehouse mapping for IDs
    const warehouseCodes = [...new Set(transactions.map(t => t.warehouseCode))]
    const warehouses = await prisma.warehouse.findMany({
      where: { code: { in: warehouseCodes } },
      select: { id: true, code: true }
    })
    const warehouseMap = new Map(warehouses.map(w => [w.code, w.id]))
    
    // Get SKU mapping for IDs
    const skuCodes = [...new Set(transactions.map(t => t.skuCode))]
    const skus = await prisma.sku.findMany({
      where: { skuCode: { in: skuCodes } },
      select: { id: true, skuCode: true }
    })
    const skuMap = new Map(skus.map(s => [s.skuCode, s.id]))
    
    // Calculate balances from transactions
    const balances = new Map<string, {
      id: string;
      warehouseId: string;
      warehouseName: string;
      skuId: string;
      skuCode: string;
      skuDescription: string;
      batchLot: string;
      quantity: number;
      unitsPerCarton: number;
      currentCartons: number;
      currentPallets: number;
      palletCapacity: number;
    }>()
    
    for (const transaction of transactions) {
      const key = `${transaction.warehouseCode}-${transaction.skuCode}-${transaction.batchLot}`
      const current = balances.get(key) || {
        id: key,
        warehouseId: warehouseMap.get(transaction.warehouseCode) || transaction.warehouseCode,
        skuId: skuMap.get(transaction.skuCode) || transaction.skuCode,
        warehouse: {
          code: transaction.warehouseCode,
          name: transaction.warehouseName
        },
        sku: {
          skuCode: transaction.skuCode,
          description: transaction.skuDescription,
          unitsPerCarton: transaction.unitsPerCarton
        },
        batchLot: transaction.batchLot,
        currentCartons: 0,
        currentPallets: 0,
        currentUnits: 0,
        unitsPerCarton: transaction.unitsPerCarton || 1,
        lastTransactionDate: null,
        lastUpdated: new Date()
      }
      
      current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
      // Use transaction-specific unitsPerCarton if available, fallback to SKU master
      current.currentUnits = calculateUnits(current.currentCartons, transaction, { unitsPerCarton: transaction.unitsPerCarton })
      current.lastTransactionDate = transaction.transactionDate
      
      // Store pallet configuration from transaction if available
      if (transaction.storageCartonsPerPallet) {
        current.storageCartonsPerPallet = transaction.storageCartonsPerPallet
      }
      if (transaction.shippingCartonsPerPallet) {
        current.shippingCartonsPerPallet = transaction.shippingCartonsPerPallet
      }
      
      balances.set(key, current)
    }
    
    // Calculate pallets for each balance
    for (const [, balance] of balances.entries()) {
      if (balance.currentCartons > 0) {
        // Use pallet configuration from transactions if available
        if (balance.storageCartonsPerPallet && balance.storageCartonsPerPallet > 0) {
          balance.currentPallets = Math.ceil(balance.currentCartons / balance.storageCartonsPerPallet)
        } else {
          // Default to 1 carton per pallet if no config found
          balance.currentPallets = balance.currentCartons
          balance.storageCartonsPerPallet = 1
          balance.shippingCartonsPerPallet = 1
        }
      } else {
        balance.currentPallets = 0
      }
    }
    
    // Convert to array and filter
    let results = Array.from(balances.values())
    
    if (!showZeroStock) {
      results = results.filter(b => b.currentCartons > 0)
    }
    
    // Sort results
    results.sort((a, b) => {
      if (a.sku.skuCode !== b.sku.skuCode) return a.sku.skuCode.localeCompare(b.sku.skuCode)
      return a.batchLot.localeCompare(b.batchLot)
    })
    
    // For non-date queries, enhance with batch attribute data
    if (!date) {
      const enhancedBalances = await Promise.all(results.map(async (balance) => {
        // Find the initial RECEIVE transaction for this batch
        const receiveTransaction = await prisma.inventoryTransaction.findFirst({
          where: {
            skuCode: balance.sku.skuCode,
            batchLot: balance.batchLot,
            warehouseCode: balance.warehouse.code,
            transactionType: 'RECEIVE'
          },
          orderBy: {
            transactionDate: 'asc'
          }
        })
        
        return {
          ...balance,
          receiveTransaction: receiveTransaction ? {
            createdBy: {
              fullName: receiveTransaction.createdByName
            },
            transactionDate: receiveTransaction.transactionDate
          } : undefined
        }
      }))
      
      // Apply pagination
      const { skip, take } = getPaginationSkipTake(paginationParams)
      const paginatedResults = enhancedBalances.slice(skip, skip + take)
      
      return NextResponse.json(createPaginatedResponse(paginatedResults, enhancedBalances.length, paginationParams))
    }
    
    // For date queries, return all results without pagination
    return NextResponse.json(results)
  } catch (_error) {
    // console.error('Error fetching inventory balances:', _error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory balances', details: _error instanceof Error ? _error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}