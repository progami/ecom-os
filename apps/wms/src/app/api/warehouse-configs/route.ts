import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'
export const dynamic = 'force-dynamic'

export const GET = withAuth(async (request, session) => {
 try {

 const searchParams = request.nextUrl.searchParams
 const _warehouseId = searchParams.get('warehouseId')
 const _skuId = searchParams.get('skuId')

 // WarehouseSkuConfig table no longer exists, return empty array
 // TODO: Remove this API endpoint entirely once frontend is updated
 const configs: unknown[] = []

 return NextResponse.json(configs)
 } catch (_error) {
 // console.error('Error fetching warehouse configs:', error)
 return NextResponse.json(
 { message: 'Failed to fetch configurations' },
 { status: 500 }
 )
 }
})

export const POST = withAuth(async (request, session) => {
 try {
 if (session.user.role !== 'admin') {
 return NextResponse.json(
 { message: 'Unauthorized' },
 { status: 403 }
 )
 }

 const data = await request.json()
 
 // WarehouseSkuConfig table no longer exists
 // Return a mock response to prevent frontend errors
 // TODO: Remove this API endpoint entirely once frontend is updated
 
 return NextResponse.json({
 id: 'mock-config-id',
 warehouseId: data.warehouseId,
 skuId: data.skuId,
 storageCartonsPerPallet: data.storageCartonsPerPallet || 100,
 shippingCartonsPerPallet: data.shippingCartonsPerPallet || 100,
 message: 'Configuration saved (mock response - table no longer exists)'
 })
 } catch (_error) {
 // console.error('Error creating warehouse config:', error)
 return NextResponse.json(
 { message: 'Failed to create configuration' },
 { status: 500 }
 )
 }
})