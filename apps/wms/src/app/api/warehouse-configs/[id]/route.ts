import { NextRequest, NextResponse } from 'next/server'
import { withAuthAndParams } from '@/lib/api/auth-wrapper'
export const dynamic = 'force-dynamic'

// WarehouseSkuConfig model removed in v0.5.0
export const GET = withAuthAndParams(async (request, params, session) => {
 try {
 const { id: _id } = params as { id: string }

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
})

export const PUT = withAuthAndParams(async (request, params, session) => {
 try {
 const { id: _id } = params as { id: string }

 if (session.user.role !== 'admin') {
 return NextResponse.json(
 { message: 'Unauthorized' },
 { status: 403 }
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
})