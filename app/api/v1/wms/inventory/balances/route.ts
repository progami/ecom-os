import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const warehouseId = searchParams.get('warehouseId') || (session.user as any).warehouseId
    const date = searchParams.get('date')
    const showZeroStock = searchParams.get('showZeroStock') === 'true'
    const skuCode = searchParams.get('skuCode')

    // If point-in-time date is provided, calculate balances from transactions
    if (date) {
      const pointInTime = new Date(date)
      pointInTime.setHours(23, 59, 59, 999)
      
      console.log(`Point-in-time query for date: ${date}, parsed as: ${pointInTime.toISOString()}`)
      
      // Build where clause for transactions
      const transactionWhere: any = {
        transactionDate: { lte: pointInTime }
      }
      
      if (session.user.role === 'staff' && (session.user as any).warehouseId) {
        transactionWhere.warehouseId = (session.user as any).warehouseId
      } else if (warehouseId) {
        transactionWhere.warehouseId = warehouseId
      } else {
        // Exclude Amazon warehouse when not querying specific warehouse
        transactionWhere.warehouse = {
          NOT: {
            OR: [
              { code: 'AMZN' },
              { code: 'AMZN-UK' }
            ]
          }
        }
      }
      
      // Fetch all transactions up to the date
      const transactions = await prisma.wmsInventoryTransaction.findMany({
        where: transactionWhere,
        include: {
          warehouse: true,
          sku: true
        },
        orderBy: [
          { transactionDate: 'asc' },
          { createdAt: 'asc' }
        ]
      })
      
      // Calculate balances from transactions
      const balances = new Map<string, any>()
      
      for (const transaction of transactions) {
        const key = `${transaction.warehouseId}-${transaction.skuId}-${transaction.batchLot}`
        const current = balances.get(key) || {
          id: key,
          warehouse: transaction.warehouse,
          sku: transaction.sku,
          batchLot: transaction.batchLot,
          currentCartons: 0,
          currentPallets: 0,
          currentUnits: 0,
          lastTransactionDate: null
        }
        
        current.currentCartons += transaction.cartonsIn - transaction.cartonsOut
        current.currentUnits = current.currentCartons * ((transaction.sku as any).unitsPerCarton || 1)
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
      for (const [key, balance] of balances.entries()) {
        if (balance.currentCartons > 0) {
          // First try to use pallet configuration from transactions
          if (balance.storageCartonsPerPallet) {
            balance.currentPallets = Math.ceil(balance.currentCartons / balance.storageCartonsPerPallet)
          } else {
            // Fall back to warehouse config
            const config = await prisma.wmsWarehouseSkuConfig.findFirst({
              where: {
                warehouseId: balance.warehouse.id,
                skuId: balance.sku.id,
                effectiveDate: { lte: pointInTime },
                OR: [
                  { endDate: null },
                  { endDate: { gte: pointInTime } }
                ]
              },
              orderBy: { effectiveDate: 'desc' }
            })
            
            if (config) {
              balance.currentPallets = Math.ceil(balance.currentCartons / config.storageCartonsPerPallet)
              balance.storageCartonsPerPallet = config.storageCartonsPerPallet
              balance.shippingCartonsPerPallet = config.shippingCartonsPerPallet
            } else {
              // Default to 1 carton per pallet if no config found
              balance.currentPallets = balance.currentCartons
              balance.storageCartonsPerPallet = 1
              balance.shippingCartonsPerPallet = 1
            }
          }
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
      
      console.log(`Point-in-time results: ${results.length} items with positive stock`)
      
      return NextResponse.json(results)
    }

    // Regular current balance query
    const where: any = {}
    
    if (warehouseId) {
      where.warehouseId = warehouseId
    } else {
      // Exclude Amazon warehouse when not querying specific warehouse
      where.warehouse = {
        NOT: {
          OR: [
            { code: 'AMZN' },
            { code: 'AMZN-UK' }
          ]
        }
      }
    }

    // Only show items with positive inventory unless explicitly requested
    if (!showZeroStock) {
      where.currentCartons = { gt: 0 }
    }

    // Filter by SKU code if provided
    if (skuCode) {
      where.sku = { skuCode }
    }

    const balances = await prisma.wmsInventoryBalance.findMany({
      where,
      include: {
        warehouse: true,
        sku: true,
      },
      orderBy: [
        { sku: { skuCode: 'asc' } },
        { batchLot: 'asc' }
      ]
    })

    return NextResponse.json(balances)
  } catch (error) {
    console.error('Error fetching inventory balances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory balances' },
      { status: 500 }
    )
  }
}