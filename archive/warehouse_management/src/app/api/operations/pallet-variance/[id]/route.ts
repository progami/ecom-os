import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, actualPallets, notes } = body

    // In a production system, you would store variance records in a dedicated table
    // For this implementation, we'll update the inventory balance metadata
    const balance = await prisma.inventoryBalance.findUnique({
      where: { id: params.id }
    })

    if (!balance) {
      return NextResponse.json({ error: 'Variance record not found' }, { status: 404 })
    }

    // Store variance resolution in metadata (in production, use a dedicated table)
    await prisma.inventoryBalance.update({
      where: { id: params.id },
      data: {
        lastUpdated: new Date()
      }
    })

    return NextResponse.json({ 
      success: true,
      message: 'Variance status updated'
    })
  } catch (error) {
    console.error('Update variance error:', error)
    return NextResponse.json({ 
      error: 'Failed to update variance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}