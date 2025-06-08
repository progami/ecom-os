import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const skuCode = params.id // Using id parameter but it contains skuCode
    
    // Get the SKU
    const sku = await prisma.sku.findFirst({
      where: { skuCode }
    })
    
    if (!sku) {
      return NextResponse.json(
        { message: 'SKU not found' },
        { status: 404 }
      )
    }

    // Find all batch numbers for this SKU
    const allTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        skuId: sku.id,
        batchLot: {
          not: {
            in: ['', 'N/A', 'NA', '-']
          }
        }
      },
      select: {
        batchLot: true
      },
      distinct: ['batchLot']
    })

    let nextBatchNumber = 1
    let lastBatch: string | null = null
    
    if (allTransactions.length > 0) {
      // Extract numeric values and find the highest
      const batchNumbers = allTransactions
        .map(t => {
          const match = t.batchLot.match(/(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(n => !isNaN(n) && n > 0)
      
      if (batchNumbers.length > 0) {
        const maxBatch = Math.max(...batchNumbers)
        nextBatchNumber = maxBatch + 1
        // Find the actual batch string with the max number
        lastBatch = allTransactions.find(t => {
          const match = t.batchLot.match(/(\d+)/)
          return match && parseInt(match[1]) === maxBatch
        })?.batchLot || null
      }
    }

    return NextResponse.json({
      skuCode,
      lastBatch: lastBatch,
      nextBatchNumber,
      suggestedBatchLot: `${nextBatchNumber}`
    })
  } catch (error) {
    console.error('Error getting next batch number:', error)
    return NextResponse.json(
      { message: 'Failed to get next batch number' },
      { status: 500 }
    )
  }
}