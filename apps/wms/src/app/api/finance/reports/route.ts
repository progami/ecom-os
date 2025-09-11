import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Finance reports functionality reduced in v0.5.0 - Invoice models removed
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
}