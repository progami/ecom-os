import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api/auth-wrapper'

// Finance reports functionality reduced in v0.5.0 - Invoice models removed
export const GET = withAuth(async (request, _session) => {
 const searchParams = request.nextUrl.searchParams
 const reportType = searchParams.get('type')

 // Return empty data for now - invoice-related reports are removed
 return NextResponse.json({
 type: reportType,
 data: [],
 summary: {
 total: 0,
 message: 'Invoice-related reports have been removed in v0.5.0'
 }
 })
})
