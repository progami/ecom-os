import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
export const dynamic = 'force-dynamic'

// WarehouseSkuConfig model removed in v0.5.0
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: _id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { message: 'WarehouseSkuConfig functionality removed in v0.5.0' },
      { status: 501 }
    )
  } catch (_error) {
    // console.error('Error fetching warehouse config:', error)
    return NextResponse.json(
      { message: 'Failed to fetch configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: _id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { message: 'WarehouseSkuConfig functionality removed in v0.5.0' },
      { status: 501 }
    )
  } catch (_error) {
    // console.error('Error updating warehouse config:', error)
    return NextResponse.json(
      { message: 'Failed to update configuration' },
      { status: 500 }
    )
  }
}